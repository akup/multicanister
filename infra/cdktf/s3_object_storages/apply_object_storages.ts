import { FileProvisioner, RemoteExecProvisioner, TerraformAsset, TerraformLocal } from "cdktf";
import { File as LocalFile } from "@cdktf/provider-local/lib/file";
import { Construct } from "constructs";

import { Resource as NullResource } from '@cdktf/provider-null/lib/resource';
import * as path from "path";
import * as os from "os";
import { k0sHomeDir, lokiSetup } from "../config";
import { DefaultSuffix } from "../lib/default-suffix";

const s3CredentialsDir = `${k0sHomeDir}/s3-credentials`
const lokiS3CredentialsFileName = "loki-s3-credentials.json"
const applyS3CredentialsScriptFilename = "apply_s3_credentials.sh"

//Object storage tiers:
//https://api.vultr.com/v2/object-storage/tiers
//# Legacy Object Storage - 1
//# Standard Object Storage - 2
//# Premium Object Storage - 3
//# Performance Object Storage - 4
//# Accelerated Object Storage - 5

export class ApplyObjectStorages extends Construct {
  objectStoragesApplyment?: NullResource;
  constructor(scope: Construct, id: string, {
    controlGatewayIp,
    lokiS3CredentialsObject,
    branchName,
    region,
    clusterName
  }: {
    controlGatewayIp: string,
    lokiS3CredentialsObject: TerraformLocal,
    branchName?: string,
    region: string,
    clusterName?: string
  }) {
    super(scope, id);

    const userHomeDir: string = os.homedir();
    const sshKeyPath = path.resolve(`${userHomeDir}/.ssh/id_rsa`)

    // Create a local file with the content
    const localCredentialsFile = new LocalFile(this, "local_credentials", {
      filename: path.resolve("./generated", lokiS3CredentialsFileName),
      content: `\${sensitive(jsonencode(${lokiS3CredentialsObject}))}`,
    });

    const applyS3CredentialsScriptAsset = new TerraformAsset(this, "apply-s3-credentials-script", {
      path: path.resolve("scripts", applyS3CredentialsScriptFilename)
    });

    let fullClusterName = DefaultSuffix.getSuffix({branchName, region, clusterName})
    
    // Add provisioner to copy the lokiS3Credentials JSON file to the control gateway
    // (add to provisioners array below)
    new NullResource(this, "object_storages_credentials", {
      dependsOn: [
        localCredentialsFile
      ],
      triggers: {
        control_gateway: controlGatewayIp,
        local_credentials_hash: localCredentialsFile.contentSha256,
        apply_s3_credentials_script_hash: applyS3CredentialsScriptAsset.assetHash,
        tr: "osc_trigger1"
      },
      connection: {
        type: "ssh",
        user: "root",
        host: controlGatewayIp,
        privateKey: `\${file("${sshKeyPath}")}`
      },
      provisioners: [{
        type: "remote-exec",
        inline: [
          `mkdir -p ${s3CredentialsDir}`,
        ]
      } as RemoteExecProvisioner, {
        type: "file",
        source: localCredentialsFile.filename,
        destination: `${s3CredentialsDir}/${lokiS3CredentialsFileName}`
      } as FileProvisioner,{
        type: "file",
        source: applyS3CredentialsScriptAsset.path,
        destination: `${k0sHomeDir}/${applyS3CredentialsScriptFilename}`
      } as FileProvisioner, {
        type: "remote-exec",
        inline: [
          `chmod +x ${k0sHomeDir}/${applyS3CredentialsScriptFilename}`,
          `cd ${k0sHomeDir}`,
          `./${applyS3CredentialsScriptFilename} ${fullClusterName} ${s3CredentialsDir} ${lokiS3CredentialsFileName} ${lokiSetup.lokiS3CredentialsSecretName}`
        ]
      } as RemoteExecProvisioner]
    })

    console.log("apply_object_storages script: ",
      `${k0sHomeDir}/${applyS3CredentialsScriptFilename} ${fullClusterName} ${s3CredentialsDir} ${lokiS3CredentialsFileName} ${lokiSetup.lokiS3CredentialsSecretName}`)
    //TODO: apply S3 credentials to kubernetes secrets LOKI_S3_SECRET_ACCESS_KEY, LOKI_S3_ACCESS_KEY at loki-s3-credentials-secret    
  }
}