import { Construct } from "constructs";
import { RemoteProvider } from "../.gen/providers/remote/provider";
import { DataRemoteFile } from "../.gen/providers/remote/data-remote-file";
import { Instance as VultrInstance } from "../.gen/providers/vultr/instance";
import { SshKey as VultrSshKey } from "../.gen/providers/vultr/ssh-key";
import { Vpc as VultrVpc } from "../.gen/providers/vultr/vpc";
import { FileProvisioner, RemoteExecProvisioner, TerraformAsset } from "cdktf";
import path = require("path");
import { defaultConfig, generatedDir } from "../config";
import { Resource as NullResource } from '@cdktf/provider-null/lib/resource';
import { getResourceId } from "../lib/tf-ids";
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import { S3Data, saveControllerSshKey } from "../s3_data";


const installControlGatewayScriptFilename = "install_control_gateway.sh"
const installK0sWithCapiScriptFilename = "install_k0s+capi_deb.sh"

const controlGatewayInstancePlan = defaultConfig.controlGatewayPlan
const osId = defaultConfig.gatewayOsId
export class ControlGateway extends Construct {
  public controlGatewayInstance: VultrInstance;
  public controlGatewaySshPublicKey?: VultrSshKey;

  constructor(scope: Construct, id: string, {
    region,
    branchName,
    clusterName,
    branchNameSuffix,
    vpc,
    vultrApiKey
  }: {
    region: string, branchName?: string, clusterName?: string,
    branchNameSuffix: string,
    vpc: VultrVpc,
    vultrApiKey: string
  }) {
    super(scope, id);

    //Here we setup networking and ufw rules for VPC to communicate between worker and control-plane nodes
    const installControlGatewayScript = new TerraformAsset(this, "install-control-gateway-script", {
      path: path.resolve("scripts", installControlGatewayScriptFilename)
    });

    const installK0sWithCapiScript = new TerraformAsset(this, "install-k0s+capi-script", {
      path: path.resolve("scripts", installK0sWithCapiScriptFilename)
    });

    //Create trigger to recreate control gateway on provision script changes
    const controlGatewayTrigger = new NullResource(this, "control_gateway_trigger", {
      triggers: {
        vpc_id: vpc.id,
        install_control_gateway_script_hash: installControlGatewayScript.assetHash,
        install_k0s_with_capi_script_hash: installK0sWithCapiScript.assetHash
      }
    })

    const userHomeDir: string = os.homedir();
    const sshKeyPath = path.resolve(`${userHomeDir}/.ssh/id_rsa`)
    if (!fs.existsSync(sshKeyPath) || !fs.existsSync(`${sshKeyPath}.pub`)) {
      if (!fs.existsSync(sshKeyPath)) {
        fs.rmSync(sshKeyPath)
      }
      // Generate SSH key synchronously for provisioning
      const sshKeygenResult = spawnSync("ssh-keygen", ["-t", "rsa", "-b", "4096", "-f", `${userHomeDir}/.ssh/id_rsa`, "-q", "-N", ""], { stdio: 'inherit' });
      if (sshKeygenResult.error) {
        console.log(sshKeygenResult.error)
      }
    }

    //Control gateway will be accessed from terraform build machine via it's local ssh key
    const controlProvisionerSshKey = new VultrSshKey(this, "control_provisioner_ssh_key", {
      name: "Provisioner public key",
      sshKey: `\${chomp(file("${sshKeyPath}.pub"))}`
    })


    //Gateway keys stored in s3
    const { sshPrivateKey, sshPublicKey } = S3Data.controllerGatewayKeys;
    const gatewaySshPrivateKeyPath = path.resolve(generatedDir, 'gw_id_rsa')
    const gatewaySshPublicKeyPath = path.resolve(generatedDir, 'gw_id_rsa.pub')
    let gatewaySshPrivateKeyProvisioners: Array<FileProvisioner> = []
    if (sshPrivateKey) {
      fs.writeFileSync(gatewaySshPrivateKeyPath, sshPrivateKey)
      gatewaySshPrivateKeyProvisioners.push({
        type: "file",
        source: gatewaySshPrivateKeyPath,
        destination: `/root/.ssh/id_rsa`
      } as FileProvisioner)
    }
    if (sshPublicKey) {
      fs.writeFileSync(gatewaySshPublicKeyPath, sshPublicKey)
      gatewaySshPrivateKeyProvisioners.push({
        type: "file",
        source: gatewaySshPublicKeyPath,
        destination: `/root/.ssh/id_rsa.pub`
      } as FileProvisioner)
    }

    

    //Create controls securety-gateway. Here surricata should be installed
    //This node will controll provisioned k0s cluster. Nobody can access k0s cluster via kubectl outside the VPC
    //Commands are accepted only via UI on 443 port, where requests are redirected to local 80 via nginx.
    //It is done to decrypt https traffic and provide it to Surricata
    const controlGatewayInstanceName = `control-secured-gateway${branchNameSuffix}`
    this.controlGatewayInstance = new VultrInstance(this, "control_gateway", {
      plan: controlGatewayInstancePlan,
      region: region,
      vpcIds: [vpc.id],
      osId, //Debian 12 x64 (bookworm)
      enableIpv6: true,
      hostname: controlGatewayInstanceName,
      label: controlGatewayInstanceName,
      sshKeyIds: [controlProvisionerSshKey.id],
      connection: {
        type: "ssh",
        user: "root",
        host: "${self.main_ip}",
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [...gatewaySshPrivateKeyProvisioners, {
        type: "file",
        source: installK0sWithCapiScript.path,
        destination: `/tmp/${installK0sWithCapiScriptFilename}`
      } as FileProvisioner, {
        type: "file",
        source: installControlGatewayScript.path,
        destination: `/tmp/${installControlGatewayScriptFilename}`
      } as FileProvisioner, {
        type: "remote-exec",
        inline: [ //Install k0s and capi
          `chmod +x /tmp/${installControlGatewayScriptFilename}`,
          `chmod +x /tmp/${installK0sWithCapiScriptFilename}`,
          `/tmp/${installK0sWithCapiScriptFilename} ${vultrApiKey}`,
          `/tmp/${installControlGatewayScriptFilename} ${sshPrivateKey && sshPublicKey ? "true" : "false"}`,
          `rm -f /tmp/${installK0sWithCapiScriptFilename}`,
          `rm -f /tmp/${installControlGatewayScriptFilename}`,
          'rm -rf /root/.ssh/known_hosts',
        ]
      } as RemoteExecProvisioner],
      lifecycle: {
        replaceTriggeredBy: [getResourceId(controlGatewayTrigger)]
      }
    })

    new RemoteProvider(this, "remote", {
      maxSessions: 2
    })

    //TODO: fix this. Ssh key should be stored in s3 and defined during cdk synth, before plan/apply
    //This construction triggers control gateway replacement on every plan,
    // but will not run on apply if ssh keys stay the same

    //TODO: make sensitive values (need to modify provider)
    const controllerGwSshPublicKey = new DataRemoteFile(this, "controller_gw_ssh_public_key", {
      conn: {
        host: this.controlGatewayInstance.mainIp,
        user: "root",
        privateKey: `\${file("${sshKeyPath}")}`
      },
      path: "/home/k0s/.ssh/id_rsa.pub",
      dependsOn: [this.controlGatewayInstance]
    })
    const controllerGwSshPrivateKey = new DataRemoteFile(this, "controller_gw_ssh_private_key", {
      conn: {
        host: this.controlGatewayInstance.mainIp,
        user: "root",
        privateKey: `\${file("${sshKeyPath}")}`
      },
      path: "/home/k0s/.ssh/id_rsa",
      dependsOn: [this.controlGatewayInstance],
    })

    saveControllerSshKey(this, controllerGwSshPrivateKey.content, controllerGwSshPublicKey.content,
      {branchName, region, clusterName}
    )

    this.controlGatewaySshPublicKey = new VultrSshKey(this, "control_gateway_ssh_key", {
      name: "control_gateway_ssh_key",
      sshKey: `\${chomp(${controllerGwSshPublicKey.content})}`
    })
  }
}