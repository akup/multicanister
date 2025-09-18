import { FileProvisioner, RemoteExecProvisioner, TerraformAsset } from "cdktf";
import { Construct } from "constructs";

import { Instance as VultrInstance } from "../.gen/providers/vultr/instance";
//import { LoadBalancer as VultrLoadBalancer } from "../.gen/providers/vultr/load-balancer";
import { Resource as NullResource } from '@cdktf/provider-null/lib/resource';
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { ClusterTemplate } from "./cluster_template";
import { clusterApiConfigurerFolderName, clusterApiConfigurerZipFilename,
  clusterApiConfigurerZipPath, CsiVersions,
  generatedDir, k0sHomeDir, manifestsDir } from "../config";

const capiApplyScriptFilename = "capi_apply.sh"
const defaultsYamlFilename = "defaults.yaml"

const capiConfigsDirName = "capi_configs"
const vultrKubernetesExtensionsDir = `${k0sHomeDir}/vultr-manifests`

export class ApplyCapiCluster extends Construct {
  capiClusterApplyment?: NullResource;
  constructor(scope: Construct, id: string, {
    controlGatewayInstance,
    clusterName,
    vpcId,
    sshKeyId,
    ciliumVersion,
    kubernetesVersion,
    controlPlanePlan,
    vultrApiKey,
    vultrCcmVersion,
    csiVersions,
    region,
  }: {
    controlGatewayInstance: VultrInstance,
    clusterName: string,
    vpcId: string,
    sshKeyId: string,
    ciliumVersion: string,
    kubernetesVersion: string,
    controlPlanePlan: string,
    vultrApiKey: string,
    vultrCcmVersion: string,
    csiVersions: CsiVersions,
    region: string,
  }) {
    super(scope, id);

    const vultrApiFileName = "vultr-api-key.yaml"
    const vultrCsiAccountsFileName = "vultr-csi-accounts.yaml"
    const vultrCsiDriverFileName = "vultr-csi-driver.yaml"
    const vultrCsiStorageClassesFileName = "vultr-csi-storage-classes.yaml"
    const vultrApiKeyManifestContent =
      fs.readFileSync(path.resolve("./manifests", vultrApiFileName), "utf8")
      .replace(/\${vultr_api_key}/g, vultrApiKey)
      .replace(/\${region}/g, region)

    const vultrCcmManifestContent =
      fs.readFileSync(path.resolve(manifestsDir, "vultr-ccm.yaml"), "utf8")
      .replace(/\${vultr_ccm_version}/g, vultrCcmVersion)
    const vultrCsiManifestContent =
      fs.readFileSync(path.resolve(manifestsDir, "vultr-csi.yaml"), "utf8")
      .replace(/\${sig_storage_csi_attacher_version}/g, csiVersions.csiAttacherVersion)
      .replace(/\${sig_storage_csi_resizer_version}/g, csiVersions.csiResizerVersion)
      .replace(/\${vultr_csi_version}/g, csiVersions.vultrCsiVersion)
      .replace(/\${sig_storage_csi_node_driver_registrar_version}/g, csiVersions.csiNodeDriverRegistrarVersion)
    //const vultrCsiManifest = fs.readFileSync(path.resolve(__dirname, "manifests/vultr-csi.yaml"), "utf8")

    
    const vultrApiKeyManifestFilePath = path.resolve(generatedDir, vultrApiFileName)
    fs.writeFileSync(vultrApiKeyManifestFilePath, vultrApiKeyManifestContent)
    const vultrCsiAccountsFilePath = path.resolve(manifestsDir, vultrCsiAccountsFileName)
    const vultrCsiDriverFilePath = path.resolve(manifestsDir, vultrCsiDriverFileName)
    const vultrCsiStorageClassesFilePath = path.resolve(manifestsDir, vultrCsiStorageClassesFileName)

    const vultrCcmFileName = `vultr-ccm-${vultrCcmVersion}.yaml`
    const vultrCcmManifestFilePath = path.resolve(generatedDir, vultrCcmFileName)
    fs.writeFileSync(vultrCcmManifestFilePath, vultrCcmManifestContent)
    const vultrCsiFileName = `vultr-csi-${csiVersions.vultrCsiVersion}.yaml`
    const vultrCsiManifestFilePath = path.resolve(generatedDir, vultrCsiFileName)
    fs.writeFileSync(vultrCsiManifestFilePath, vultrCsiManifestContent)

    const userHomeDir: string = os.homedir();
    const sshKeyPath = path.resolve(`${userHomeDir}/.ssh/id_rsa`)


    //Create trigger for k0s_extensions
    const vultrApiKeyManifestAsset = new TerraformAsset(this, "vultr-api-key-manifest", {
      path: vultrApiKeyManifestFilePath
    });
    const vultrCsiAccountsManifestAsset = new TerraformAsset(this, "vultr-csi-accounts-manifest", {
      path: vultrCsiAccountsFilePath
    });
    const vultrCsiDriverManifestAsset = new TerraformAsset(this, "vultr-csi-driver-manifest", {
      path: vultrCsiDriverFilePath
    });
    const vultrCsiStorageClassesManifestAsset = new TerraformAsset(this, "vultr-csi-storage-classes-manifest", {
      path: vultrCsiStorageClassesFilePath
    });
    const vultrCcmManifestAsset = new TerraformAsset(this, "vultr-ccm-manifest", {
      path: vultrCcmManifestFilePath
    });
    const vultrCsiManifestAsset = new TerraformAsset(this, "vultr-csi-manifest", {
      path: vultrCsiManifestFilePath
    });

    //TODO: install with helm from control gateway


    const vultrKubernetesExtensions = new NullResource(this, "vultr_kubernetes_extensions", {
      dependsOn: [
        controlGatewayInstance
      ],
      triggers: {
        control_gateway: controlGatewayInstance.id,
        vultrApiKey: vultrApiKeyManifestAsset.assetHash,
        vultrCsiAccounts: vultrCsiAccountsManifestAsset.assetHash,
        vultrCsiDriver: vultrCsiDriverManifestAsset.assetHash,
        vultrCsiStorageClasses: vultrCsiStorageClassesManifestAsset.assetHash,
        vultrCcm: vultrCcmManifestAsset.assetHash,
        vultrCsi: vultrCsiManifestAsset.assetHash,
        tr: "test_trigger1"
      },
      connection: {
        type: "ssh",
        user: "root",
        host: controlGatewayInstance.mainIp,
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [{
        type: "remote-exec",
        inline: [
          `mkdir -p ${vultrKubernetesExtensionsDir}`,
        ]
      } as RemoteExecProvisioner, {
        type: "file",
        source: vultrApiKeyManifestFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrApiFileName}`
      } as FileProvisioner, {
        type: "file",
        source: vultrCsiAccountsFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrCsiAccountsFileName}`
      } as FileProvisioner, {
        type: "file",
        source: vultrCsiDriverFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrCsiDriverFileName}`
      } as FileProvisioner, {
        type: "file",
        source: vultrCsiStorageClassesFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrCsiStorageClassesFileName}`
      } as FileProvisioner, {
        type: "file",
        source: vultrCcmManifestFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrCcmFileName}`
      } as FileProvisioner, {
        type: "file",
        source: vultrCsiManifestFilePath,
        destination: `${vultrKubernetesExtensionsDir}/${vultrCsiFileName}`
      } as FileProvisioner]
    })


    // Generate defaults.yaml for cluster API configurer
    const defaultsYamlPath = path.resolve(generatedDir, defaultsYamlFilename);
    const defaultsYamlContent = `# Default configuration values for Cluster API
kubernetesVersion: "${kubernetesVersion}"
controlPlanePlan: "${controlPlanePlan}"
ciliumVersion: "${ciliumVersion}"
`;
    fs.writeFileSync(defaultsYamlPath, defaultsYamlContent);

    
    //Create trigger for cluster api configurer
    const clusterApiConfigurerZipAsset = new TerraformAsset(this, "cluster-api-configurer-zip", {
      path: clusterApiConfigurerZipPath
    });
    const defaultsYamlAsset = new TerraformAsset(this, "defaults-yaml", {
      path: defaultsYamlPath
    });
    const capiApplyScriptAsset = new TerraformAsset(this, "capi-apply-script", {
      path: path.resolve("scripts", capiApplyScriptFilename)
    });

    //Copy capi cluster template and apply it with snapshot and vpc id
    const capiClusterConfigurement = new NullResource(this, "capi_cluster_configurement", {
      dependsOn: [
        controlGatewayInstance
      ],
      triggers: {
        control_gateway: controlGatewayInstance.id,
        clusterApiConfigurerZip: clusterApiConfigurerZipAsset.assetHash,
        defaultsYaml: defaultsYamlAsset.assetHash,
        capiApplyScript: capiApplyScriptAsset.assetHash,
        tr: "test_trigger1"
      },

      connection: {
        type: "ssh",
        user: "root",
        host: controlGatewayInstance.mainIp,
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [{
        type: "remote-exec",
        inline: [
          `mkdir -p ${k0sHomeDir}/${capiConfigsDirName}`,
        ]
      } as RemoteExecProvisioner,{
        type: "file",
        source: clusterApiConfigurerZipAsset.path,
        destination: `/home/k0s/${clusterApiConfigurerZipFilename}`
      } as FileProvisioner,{
        type: "file",
        source: capiApplyScriptAsset.path,
        destination: `/home/k0s/${capiApplyScriptFilename}`
      } as FileProvisioner,{
        type: "remote-exec",
        inline: [
          `rm -rf ${k0sHomeDir}/${clusterApiConfigurerFolderName}`,
          `mkdir -p ${k0sHomeDir}/${clusterApiConfigurerFolderName}`,
          `unzip ${k0sHomeDir}/${clusterApiConfigurerZipFilename} -d ${k0sHomeDir}/${clusterApiConfigurerFolderName}`,
          `rm -f ${k0sHomeDir}/${clusterApiConfigurerZipFilename}`, //clear from zip file
          `chmod +x ${k0sHomeDir}/${capiApplyScriptFilename}`,
        ]
      } as RemoteExecProvisioner,{
        type: "file",
        source: defaultsYamlAsset.path,
        destination: `${k0sHomeDir}/${clusterApiConfigurerFolderName}/${defaultsYamlFilename}`
      }],
    })


    //Trigger on cluster config file change
    const capiConfigAsset = new TerraformAsset(this, "capi-config-yaml", {
      path: ClusterTemplate.clusterTemplatePath
    });

    //Copy capi cluster template and apply it with snapshot and vpc id
    this.capiClusterApplyment = new NullResource(this, "capi_cluster_applyment", {
      dependsOn: [
        capiClusterConfigurement,
        vultrKubernetesExtensions
      ],
      triggers: {
        control_gateway: controlGatewayInstance.id,
        capiConfigYaml: capiConfigAsset.assetHash,
        applyProviderExtentions: vultrKubernetesExtensions.id,
        installConfigurerExtentions: capiClusterConfigurement.id
      },

      connection: {
        type: "ssh",
        user: "root",
        host: controlGatewayInstance.mainIp,
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [{
        type: "remote-exec",
        inline: [
          `mkdir -p ${k0sHomeDir}/${capiConfigsDirName}`,
        ]
      } as RemoteExecProvisioner,{
        type: "file",
        source: ClusterTemplate.clusterTemplatePath,
        destination: `${k0sHomeDir}/${capiConfigsDirName}/${clusterName}.yaml`
      },{
        type: "remote-exec",
        inline: [ //Apply cluster api
          `sed -i 's/$\${VPC_ID}/${vpcId}/g' ${k0sHomeDir}/${capiConfigsDirName}/${clusterName}.yaml`,
          `sed -i 's/$\${SSH_KEY_ID}/${sshKeyId}/g' ${k0sHomeDir}/${capiConfigsDirName}/${clusterName}.yaml`,
          //$1 - cluster name, $2 - capi config file, $3 - kubeconfig file, $4 - cilium version, $5 - vultr kubernetes extensions dir
          // `cd ${k0sHomeDir} && ${capiApplyScriptFilename} "${clusterName}" ` +
          // `"${k0sHomeDir}/${capiConfigsDirName}/${clusterName}.yaml" "${k0sHomeDir}/kubeconfig" ` +
          // `"${ciliumVersion}" "${vultrKubernetesExtensionsDir}"`,
        ]
      } as RemoteExecProvisioner]
    })

    console.log('RUN SHELL FILE:')
    console.log(`cd ${k0sHomeDir} && ${capiApplyScriptFilename} "${clusterName}" ` +
          `"${k0sHomeDir}/${capiConfigsDirName}/${clusterName}.yaml" "${k0sHomeDir}/kubeconfig" ` +
          `"${ciliumVersion}" "${vultrKubernetesExtensionsDir}"`)
  }
}