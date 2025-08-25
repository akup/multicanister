import { S3Object } from "@cdktf/provider-aws/lib/s3-object";
import { Construct } from "constructs";
import { s3Bucket } from "../s3_backend";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { TerraformLocal } from "cdktf";
import { DefaultSuffix } from "../lib/default-suffix";

const controllerSshKey = "controller_ssh_key";

export interface ControllerGatewayKeys {
  sshPrivateKey?: string,
  sshPublicKey?: string
}
export class S3Data {
  static controllerGatewayKeys: ControllerGatewayKeys = {}
  static async getControllerSshKeys({branchName, region, clusterName}: {branchName?: string, region?: string, clusterName?: string}): Promise<void> {
    const s3Client = new S3Client({});
    try {
      const key = `${controllerSshKey}-${DefaultSuffix.getSuffix({branchName, region, clusterName})}`
      console.log("controllerSshKeys s3 key", key)
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      }));
      const body = await response.Body?.transformToString();
      this.controllerGatewayKeys = JSON.parse(body || "{}");
    } catch (e) {
      let message = 'Unknown Error'
      if (e instanceof Error) message = e.message
      console.log("no controller ssh keys found in s3", message)
      //If NoSuchKey, it's ok as it was not written to s3 yet or was destroyed, otherwise it's an error
      if (!message.match(/The specified key does not exist/i)) {
        console.error(e)
      }
      this.controllerGatewayKeys = {}
    }
  }
}

export function saveControllerSshKey(scope: Construct, sshPrivateKey: string, sshPublicKey: string,
  {branchName, region, clusterName}: {branchName?: string, region?: string, clusterName?: string}
) {
  const key = `${controllerSshKey}-${DefaultSuffix.getSuffix({branchName, region, clusterName})}`
  console.log("controllerSshKeys s3 key saved at", key)
  //TODO: ephemeral resource
  const controllerGatewaySshKeysObject = new TerraformLocal(scope, "controller_gateway_ssh_keys", {
    sshPrivateKey: sshPrivateKey,
    sshPublicKey: sshPublicKey
  })
  new S3Object(scope, "s3_controller_gateway_ssh_keys", {
    bucket: s3Bucket,
    key,
    content: `\${jsonencode(${controllerGatewaySshKeysObject})}`,
  });
}