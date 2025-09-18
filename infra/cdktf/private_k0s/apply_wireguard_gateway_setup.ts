import { FileProvisioner, RemoteExecProvisioner, TerraformAsset } from "cdktf";
import { Construct } from "constructs";

import { Instance as VultrInstance } from "../.gen/providers/vultr/instance";
import { Resource as NullResource } from '@cdktf/provider-null/lib/resource';
import * as path from "path";
import * as os from "os";

const wireguardGatewaySetupScriptFilename = "install_wireguard+nginx.sh"  
const wireguardGatewaySetupScriptFilePath = path.resolve("./scripts", wireguardGatewaySetupScriptFilename)

export class ApplyWireguardGatewaySetup extends Construct {
  wireguardGatewaySetupApplyment?: NullResource;
  constructor(scope: Construct, id: string, {
    controlGatewayInstance
  }: {
    controlGatewayInstance: VultrInstance,
  }) {
    super(scope, id);

    const userHomeDir: string = os.homedir();
    const sshKeyPath = path.resolve(`${userHomeDir}/.ssh/id_rsa`)

    //Create trigger for k0s_extensions
    const wireguardGatewaySetupScriptAsset = new TerraformAsset(this, "wireguard_gateway_setup_script", {
      path: wireguardGatewaySetupScriptFilePath
    });

    // Add provisioner to copy the lokiS3Credentials JSON file to the control gateway
    // (add to provisioners array below)
    this.wireguardGatewaySetupApplyment = new NullResource(this, "wireguard_gateway_setup", {
      dependsOn: [
        controlGatewayInstance
      ],
      triggers: {
        control_gateway: controlGatewayInstance.id,
        wireguard_gateway_setup: wireguardGatewaySetupScriptAsset.assetHash,
        tr: "wg_trigger1"
      },
      connection: {
        type: "ssh",
        user: "root",
        host: controlGatewayInstance.mainIp,
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [{
        type: "file",
        source: wireguardGatewaySetupScriptAsset.path,
        destination: `/tmp/${wireguardGatewaySetupScriptFilename}`
      } as FileProvisioner, {
        type: "remote-exec",
        inline: [
          `chmod +x /tmp/${wireguardGatewaySetupScriptFilename}`,
          `/tmp/${wireguardGatewaySetupScriptFilename}`,
          `rm -f /tmp/${wireguardGatewaySetupScriptFilename}`
        ]
      } as RemoteExecProvisioner]
    })
  }
}