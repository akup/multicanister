import { DataTerraformRemoteStateS3, S3Backend } from "cdktf";
import { Construct } from "constructs";
import { DefaultSuffix } from "../lib/default-suffix";


export const s3RemoteKey = "tf-dex.tfstate";
export const s3Region = "eu-central-1";
export const s3Bucket = "tf-vultr-state-prod-jjo-eu-central-1";

//TODO: recreate with cluster name suffix (current infra should be destroyed first)
export function setS3Backend(
  scope: Construct,
  {
    stackName,
    clusterName,
    backendKey,
    branchName,
    region
  }: {
    stackName?: string,
    clusterName?: string,
    backendKey: string,
    branchName?: string,
    region?: string
  }
) {
  const key = getS3BackendKey({stackName, backendKey, branchName, region, clusterName})
  console.log("setS3Backend key", key)
  new S3Backend(scope, {
    bucket: s3Bucket,
    key,
    region: s3Region,
  });
}

function getS3BackendKey(
  {
    stackName,
    backendKey,
    branchName,
    region,
    clusterName
  }: {
    stackName?: string,
    backendKey: string,
    branchName?: string,
    region?: string,
    clusterName?: string
}) {
  const key = `${stackName ? stackName + "-" : ""}${backendKey}`
  return DefaultSuffix.withSuffix(key, { branchName, region, clusterName })
}

export function getS3RemoteState(
  scope: Construct, state_name: string,
  {
    stackName,
    backendKey,
    branchName,
    region,
    clusterName
  }: {
    stackName?: string,
    backendKey: string,
    branchName?: string,
    region?: string,
    clusterName?: string
  }
) {
  const key = getS3BackendKey({stackName, backendKey, branchName, region, clusterName})
  console.log("getS3RemoteState key", key)
  return new DataTerraformRemoteStateS3(scope, state_name, {
    bucket: s3Bucket,
    key,
    region: s3Region
  });
}