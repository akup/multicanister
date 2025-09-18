import { Construct } from "constructs";

import { Vpc as VultrVpc } from "../.gen/providers/vultr/vpc";
import { ApplyCapiCluster } from "./apply_capi_cluster";
import { defaultConfig } from "../config";
import { ControlGateway } from "./control_gateway";
import { DefaultSuffix } from "../lib/default-suffix";
import { ClusterTemplate } from "./cluster_template";
import { Instance as VultrInstance } from "../.gen/providers/vultr/instance";

import * as fs from "fs";
import { ApplyWireguardGatewaySetup } from "./apply_wireguard_gateway_setup";

export interface PrivateK0sModuleProperties {
  region: string,
  haLoadBalancer?: K0sLoadBalancerProperties,
  controlPlaneFirewallRules?: Array<K0sFirewallRuleProperties>,
  clusterName: string,
  branchName?: string,
  vultrApiKey: string,
  snapshotId: string,
  csiProvisionerVersion?: string,
  csiAttacherVersion?: string,
  csiNodeDriverRegistrarVersion?: string,
  ciliumVersion?: string,
  k0sVersion?: string,
  k0sctlVersion?: string,
  helmRepositories?: Array<K0sHelmRepositoryProperties>,
  helmCharts?: Array<K0sHelmChartProperties>
}
export interface K0sLoadBalancerProperties {
  haAlgorithm: "roundrobin" | "leastconnections",
  haHealthResponseTimeout: number,
  haHealthUnhealthyThreshold: number,
  haHealthCheckInterval: number,
  haHealthHealthyThreshold: number,
}

export interface K0sHelmRepositoryProperties {
  name: string,
  url: string
}

export interface K0sHelmChartProperties {
  name: string,
  chartname: string,
  version: string,
  namespace: string,
  values?: string,
}


export interface K0sFirewallRuleProperties {
  port: number,
  ipType: "v4" | "v6",
  source: string
}


//Os will be installed by script
//Os:
//curl "https://api.vultr.com/v2/os" \
//-X GET \
//-H "Authorization: Bearer ${VULTR_API_KEY}"


// {
//   "id": 2136,
//   "name": "Debian 12 x64 (bookworm)",
//   "arch": "x64",
//   "family": "debian"
// }

//TODO: cloud provider switch
//TODO: proxy requests to api.vultr.com via control-gateway
export class PrivateK0sModule extends Construct {
  controlGatewayInstance?: VultrInstance;
  constructor(scope: Construct, id: string, {
    region,
    // haLoadBalancer = {
    //   haAlgorithm: "roundrobin",
    //   haHealthResponseTimeout: 3,
    //   haHealthUnhealthyThreshold: 1,
    //   haHealthCheckInterval: 3,
    //   haHealthHealthyThreshold: 2
    // },
    // controlPlaneFirewallRules = [],
    clusterName,
    branchName,
    vultrApiKey,
    snapshotId,
    //csiProvisionerVersion = defaultConfig.csiProvisionerVersion,
    //csiAttacherVersion = defaultConfig.csiAttacherVersion,
    //csiNodeDriverRegistrarVersion = defaultConfig.csiNodeDriverRegistrarVersion,
    ciliumVersion = defaultConfig.ciliumVersion,
    //k0sVersion = defaultConfig.k0sVersion,
    //k0sctlVersion = defaultConfig.k0sctlVersion,
    // helmRepositories = [{ //TODO: all charts should go throw SecOps workflow
    //   name: "argo",
    //   url: "https://argoproj.github.io/argo-helm"
    // },
    // { //For some reason, cilium is not installing with k0sctl (not starting, but can start in 20 minutes on restarts)
    //   name: "cilium",
    //   url: "https://helm.cilium.io/"
    // }
  //],
    // helmCharts = [{ //TODO: all charts should go throw SecOps workflow
    //   name: "argocd",
    //   chartname: "argo/argo-cd",
    //   version: "8.0.14",
    //   namespace: "argocd"
    // },
    // {
    //   name: "cilium",
    //   chartname: "cilium/cilium",
    //   version: "1.17.4",
    //   namespace: "kube-system"
    // }
  //]
  }: PrivateK0sModuleProperties) {
    super(scope, id);

    let clusterNameSuffix = DefaultSuffix.getSuffix({branchName, region, clusterName})
    const branchNameSuffix = clusterNameSuffix ? "-" + clusterNameSuffix : ""

    //const clusterUuid = new RandomTf(this, "random").randomUuid;

    //const clusterName = `${clusterNameSuffix}-${clusterUuid}`
    
    //TODO: abstract resources. For different providers

    //TODO: setup subnet and mask
    const vpc = new VultrVpc(this, "private_network", {
      description: `Private Network for k0s cluster ${clusterNameSuffix}`,
      region,
      // v4_subnet: element(split("/", var.node_subnet), 0),
      // v4_subnet_mask: element(split("/", var.node_subnet), 1)
    })

    //TODO: setup firewall to allow only traffic for control-gateway on 443 port

    // Create cluster template yaml and save it to manifests/generated/capi-cluster-template.yaml
    const clusterTemplate = new ClusterTemplate({
      clusterName: clusterNameSuffix,
      snapshotId,
    }).generateClusterTemplate(region)

    if (!fs.existsSync(ClusterTemplate.manifestsDir)) {
      fs.mkdirSync(ClusterTemplate.manifestsDir, { recursive: true });
    }
    fs.writeFileSync(
      ClusterTemplate.clusterTemplatePath,
      clusterTemplate
    );


    const controlGateway = new ControlGateway(this, "control_gateway", {
      region, 
      branchName,
      clusterName,
      branchNameSuffix,
      vpc,
      vultrApiKey
    })
    this.controlGatewayInstance = controlGateway.controlGatewayInstance

    new ApplyCapiCluster(this, "apply_capi_cluster", {
      controlGatewayInstance: this.controlGatewayInstance,
      clusterName: clusterNameSuffix,
      vpcId: vpc.id,
      sshKeyId: controlGateway.controlGatewaySshPublicKey?.id!,
      ciliumVersion,
      kubernetesVersion: defaultConfig.kubernetesVersion,
      controlPlanePlan: defaultConfig.controlPlanePlan,
      vultrApiKey,
      vultrCcmVersion: defaultConfig.vultrCcmVersion,
      csiVersions: defaultConfig.csiVersions,
      region,
    })

    //TODO: Add wireguard gateway
    new ApplyWireguardGatewaySetup(this, "apply_wireguard_gateway", {
      controlGatewayInstance: this.controlGatewayInstance,
    })
  }
}