import * as path from "path"
import * as fs from "fs"

export const generatedDir = path.resolve('./generated')
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir)
}
export const manifestsDir = path.resolve("manifests");
export const clusterApiConfigurerFolderName = "cluster_api_configurer"
export const clusterApiConfigurerZipFilename = `${clusterApiConfigurerFolderName}.zip`
export const clusterApiConfigurerZipPath = path.resolve(generatedDir, clusterApiConfigurerZipFilename);
export const clusterApiConfigurerDir = path.resolve(clusterApiConfigurerFolderName);

export const k0sHomeDir = "/home/k0s"

export interface CsiVersions {
  csiAttacherVersion: string,
  csiResizerVersion: string,
  vultrCsiVersion: string,
  csiNodeDriverRegistrarVersion: string,
}
export interface WorkerGroup {
  count: number,
  planId: string,
  taintEffect?: string,
}

//Get object storage cluster id
// curl "https://api.vultr.com/v2/object-storage/clusters" \
//   -X GET \
//   -H "Authorization: Bearer {vultrApiKey}"

//TODO: multi-provider regions and
export const defaultConfig = {
  useBranchName: true,
  objectStorageClusterId: 6, //ams
  controlGatewayPlan: "vc2-2c-2gb",
  controlPlaneHighAvailability: true, //This is controller+worker for kubernetes cluster api host
  controlPlanePlan: "vc2-2c-2gb",
  workerGroups: {
    "system-workloads": {
      count: 2,
      planId: "vc2-2c-4gb", //ArgoCD, classes, ingress, wireguard, etc.
      taintEffect: "NoExecute",
    },
    "log-workloads": {
      count: 2,
      planId: "vc2-4c-8gb", //Logs, metrics
    },
    // "defect-dojo-workloads": {
    //   count: 1,
    //   planId: "vc2-4c-8gb",
    // },
    // "pic-workloads": {
    //   count: 1,
    //   planId: "vc2-4c-4gb",
    // },
    // "t-workloads": {
    //   count: 2,
    //   planId: "vc2-2c-2gb",
    // },
    // "backtest-workloads": {
    //   count: 1,
    //   planId: "vc2-6c-16gb",
    // },
    // "jjo-workloads": {
    //   count: 1,
    //   planId: "vc2-2c-4gb",
    // },
    // "ingress-workloads": {
    //   count: 1,
    //   planId: "vc2-1c-2gb",
    // }
  } as Record<string, WorkerGroup>,
  kubernetesVersion: "v1.32.4",
  gatewayOsId: 2136, //Debian 12 x64 (bookworm) (For secured control gateway)
  ciliumVersion: "1.17.4",
  k0sVersion: "v1.33.1+k0s.0",
  k0sctlVersion: "v0.24.0",
  vultrCcmVersion: "v0.14.0",
  csiVersions: {
    csiAttacherVersion: "v4.1.0",
    csiResizerVersion: "v1.7.0",
    vultrCsiVersion: "v0.16.0",
    csiNodeDriverRegistrarVersion: "v2.7.0"
  } as CsiVersions
}

export const lokiSetup = {
  lokiS3CredentialsSecretName: "loki-s3-credentials-secret",
}
