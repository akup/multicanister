import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";
import { VultrProvider } from "./.gen/providers/vultr/provider"
//import { KubernetesProvider } from "@cdktf/provider-kubernetes/lib/provider";

import { getS3RemoteState, s3Region, s3RemoteKey, setS3Backend } from "./s3_backend"
import { PrivateK0sModule } from "./private_k0s";
import { clusterApiConfigurerDir, clusterApiConfigurerZipPath, defaultConfig } from "./config";
import { NullProvider } from "@cdktf/provider-null/lib/provider";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { LocalProvider } from "@cdktf/provider-local/lib/provider";

import { S3Data } from "./s3_data";
import { VultrSnapshotService } from "./lib/vultr-snapshot";
import * as fs from "fs";
import * as archiver from "archiver";
import { S3ObjectStoragesModule } from "./s3_object_storages";
import { S3SetupModule } from "./s3_object_storages/s3_setup";

class KubernetesStack extends TerraformStack {
  constructor(scope: Construct, id: string, {
    clusterName, branchName, regionName, vultrApiKey, snapshotId
  }: {clusterName: string, branchName?: string, regionName: string, vultrApiKey: string, snapshotId: string}) {
    super(scope, id);

    //const githubBranch = (process.env["GITHUB_BRANCH"] ?? "").trim()

    setS3Backend(this, {backendKey: s3RemoteKey, branchName, region: regionName});
    
    //TODO: get vultr image snapshot id

    new AwsProvider(this, "aws", {
      region: s3Region,
    });
    new VultrProvider(this, "vultr", {
      apiKey: vultrApiKey,
    });
    new NullProvider(this, "null");
    new LocalProvider(this, "local");

    const privateK0sModule = new PrivateK0sModule(this, "main_kube", {
      clusterName,
      region: regionName,
      branchName,
      vultrApiKey,
      snapshotId
    })

    const s3ObjectStoragesModule = new S3ObjectStoragesModule(this, "s3_object_storages")

    // Create Terraform outputs for cross-stack references
    new TerraformOutput(this, "object_storage_s3_hostname", {
      value: s3ObjectStoragesModule.objectStorage.s3Hostname,
      description: "S3 hostname for object storage"
    });

    new TerraformOutput(this, "object_storage_s3_access_key", {
      value: s3ObjectStoragesModule.objectStorage.s3AccessKey,
      description: "S3 access key for object storage",
      sensitive: true
    });

    new TerraformOutput(this, "object_storage_s3_secret_key", {
      value: s3ObjectStoragesModule.objectStorage.s3SecretKey,
      description: "S3 secret key for object storage",
      sensitive: true
    });

    new TerraformOutput(this, "control_gateway_ip", {
      value: privateK0sModule.controlGatewayInstance!.mainIp,
      description: "Control gateway IP",
      sensitive: true
    });
  }
}

class SetUpStack extends TerraformStack {
  constructor(scope: Construct, id: string, {
    branchName, clusterName, regionName
  }: {branchName?: string, clusterName?: string, regionName: string}) {
    super(scope, id);

    // Set the same S3 backend as the main stack
    setS3Backend(this, {stackName: "set-up-stack", backendKey: s3RemoteKey, branchName, region: regionName});

    new AwsProvider(this, "aws", {
      region: s3Region,
    });
    new NullProvider(this, "null");
    new LocalProvider(this, "local");

    // Get object storage values from kubernetes-stack using remote state
    //TODO: use valid key
    const kubernetesState = getS3RemoteState(this, "kubernetes_state", {
      //stackName: "kubernetes-stack",
      backendKey: s3RemoteKey,
      branchName,
      region: regionName
    });

    // Create S3 buckets for loki
    new S3SetupModule(this, "s3_setup", {
      s3Hostname: kubernetesState.getString("object_storage_s3_hostname"),
      s3AccessKey: kubernetesState.getString("object_storage_s3_access_key"),
      s3SecretKey: kubernetesState.getString("object_storage_s3_secret_key"),
      controlGatewayIp: kubernetesState.getString("control_gateway_ip"),
      region: regionName,
      branchName,
      clusterName
    })
  }
}

const app = new App();

(async () => {
  //environment variables are extracted in tf_cdk.yml workflow
  const githubBranchName = (process.env["GITHUB_BRANCH_NAME"] ?? "").trim()
  const branchName = defaultConfig.useBranchName ? githubBranchName : undefined
  const regionName = (process.env["REGION_NAME"] ?? "").trim()
  const clusterName = (process.env["CLUSTER_NAME"] ?? "").trim()
  console.log("regionName", regionName)
  console.log("clusterName", clusterName)
  if (!regionName) {
    throw new Error("REGION_NAME is not set")
  }
  if (!clusterName) {
    throw new Error("CLUSTER_NAME is not set")
  }
  console.log(`regionName: ${regionName}, clusterName: ${clusterName}`)
  const controllerSshKeysPromise = S3Data.getControllerSshKeys({branchName, region: regionName, clusterName})

  // Zip cluster API configurer directory
  const output = fs.createWriteStream(clusterApiConfigurerZipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  archive.pipe(output);
  archive.directory(clusterApiConfigurerDir, false);
  const clusterApiConfigurerZipPromise = archive.finalize();
  console.log("Cluster API configurer zip created: ", clusterApiConfigurerDir)

  // Get snapshots from Vultr API
  const vultrApiKey = process.env["VULTR_API_KEY"] ?? ""
  const snapshotIdPromise = VultrSnapshotService.getClusterApiSnapshotId(vultrApiKey);

  const [_controllerSshKeys, _clusterApiConfigurerZip, snapshotId] = 
    await Promise.all([controllerSshKeysPromise, clusterApiConfigurerZipPromise, snapshotIdPromise])

  console.log("Finished zipping cluster API configurer: ", clusterApiConfigurerZipPath)

  if (!snapshotId) {
    throw new Error(`No snapshot ID found for '${VultrSnapshotService.CLUSTER_API_PATTERN}' pattern in Vultr API`);
  }

  // Should be called cluster creation stack
  // It creates gateway with tools to manage cluster and kubernetes cluster using capi
  new KubernetesStack(app, "kubernetes-stack", {
    clusterName,
    branchName,
    regionName,
    vultrApiKey,
    snapshotId
  });

  // Create set up stack that depends on the Kubernetes stack applyment as it uses createdobject storage
  // Should setup object storages, users, kubernetes node-groups, etc.
  new SetUpStack(app, "set-up-stack", {
    branchName,
    clusterName,
    regionName
  });
  
  app.synth();
})();
