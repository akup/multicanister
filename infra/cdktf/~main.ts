import { Construct } from "constructs";
import { App, S3Backend,
  TerraformOutput, TerraformStack, TerraformVariable } from "cdktf";
import { VultrProvider } from "./.gen/providers/vultr/provider";
import { Kubernetes as VultrKubernetes } from "./.gen/providers/vultr/kubernetes";
import { KubernetesProvider } from "@cdktf/provider-kubernetes/lib/provider";

// Kubernetes
//import { KubernetesProvider } from "@cdktf/provider-kubernetes/lib/provider";

const s3RemoteKey = "terraform.tfstate";
const s3Region = "eu-central-1";
const s3Bucket = "tf-vultr-state-prod-jjo-eu-central-1";

function setS3Backend(scope: Construct, backendKey: string) {
  new S3Backend(scope, {
    bucket: s3Bucket,
    key: backendKey,
    region: s3Region,
  });
}

// function getRemoteS3State(scope: Construct, backendKey: string) {
//   return new DataTerraformRemoteStateS3(scope, "remote-state", {
//     bucket: s3Bucket,
//     key: backendKey,
//     region: s3Region,
//   });
// }

class VultrWithKubernetesModule extends Construct {
  public kubernetesClusterEndpoint?: string;
  public kubernetesClusterClientCertificate?: string;
  public kubernetesClusterClientKey?: string;
  public kubernetesClusterClusterCaCertificate?: string;

  constructor(scope: Construct, id: string, vultrApiKey: TerraformVariable) {
    super(scope, id);

    new VultrProvider(this, "vultr", {
      apiKey: vultrApiKey.value,
    });

    const vultrKubernetesCluster = new VultrKubernetes(this, "vultrKubernetesCluster", {
      region: "fra",
      version: "v1.33.0+1",
      label: "my-kubernetes-cluster",
      nodePools: {
        label:       "my-app-nodes",
        plan:        "vc2-2c-4gb",
        nodeQuantity: 1,
        autoScaler:  true,
        minNodes:    1,
        maxNodes:    2,
        taints: [
          { key: "app", value: "my-app", effect: "NoSchedule" },
        ],
      },
    });

    this.kubernetesClusterEndpoint = vultrKubernetesCluster.endpoint;
    this.kubernetesClusterClientCertificate = vultrKubernetesCluster.clientCertificate;
    this.kubernetesClusterClientKey = vultrKubernetesCluster.clientKey;
    this.kubernetesClusterClusterCaCertificate = vultrKubernetesCluster.clusterCaCertificate;
  }
}

class KubernetesModule extends Construct {
  constructor(scope: Construct, id: string,
    vultrKubernetes: VultrWithKubernetesModule
  ) {
    super(scope, id);
    
    //setS3Backend(this, "terraform.tfstate");

    // const remoteState = getRemoteS3State(this, s3RemoteKey);

    // const kubernetesClusterEndpoint = remoteState.getString("kubernetesClusterEndpoint");
    // const kubernetesClusterClientCertificate = remoteState.getString("kubernetesClusterClientCertificate");
    // const kubernetesClusterClientKey = remoteState.getString("kubernetesClusterClientKey");
    // const kubernetesClusterClusterCaCertificate = remoteState.getString("kubernetesClusterClusterCaCertificate");


    // Outputs
    new TerraformOutput(this, "kubernetesClusterEndpoint", {
      value: vultrKubernetes.kubernetesClusterEndpoint
    });
    new TerraformOutput(this, "kubernetesClusterClientCertificate", {
      value: vultrKubernetes.kubernetesClusterClientCertificate,
      sensitive: true
    });
    new TerraformOutput(this, "kubernetesClusterClientKey", {
      value: vultrKubernetes.kubernetesClusterClientKey,
      sensitive: true
    });
    new TerraformOutput(this, "kubernetesClusterClusterCaCertificate", {
      value: vultrKubernetes.kubernetesClusterClusterCaCertificate,
      sensitive: true
    });

    
    //connect to kubernetes
    new KubernetesProvider(this, "kubernetes", {
      host: vultrKubernetes.kubernetesClusterEndpoint,
      clientCertificate: vultrKubernetes.kubernetesClusterClientCertificate,
      clientKey: vultrKubernetes.kubernetesClusterClientKey,
      clusterCaCertificate: vultrKubernetes.kubernetesClusterClusterCaCertificate
    });
  }
}

class KubernetesStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    //TODO: personal for each branch
    setS3Backend(this, s3RemoteKey);

    const vultrApiKey = new TerraformVariable(this, "vultrApiKey", {
      type: "string",
      description: "API key for the Vultr provider",
      sensitive: true,
    });

    const vultrInfraOutput = new VultrWithKubernetesModule(this, "vultr", vultrApiKey);
    new KubernetesModule(this, "kubernetes", vultrInfraOutput);
  }
}

const app = new App();

new KubernetesStack(app, "kubernetes-stack");

app.synth();
