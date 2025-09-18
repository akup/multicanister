import { defaultConfig as config } from "../config";
import * as yaml from 'js-yaml';

import * as path from "path";

export class ClusterTemplate {
  static clusterTemplateFilename = "capi-cluster-template.yaml";
  static manifestsDir = path.resolve("manifests", "generated");
  static clusterTemplatePath = path.join(
    ClusterTemplate.manifestsDir,
    ClusterTemplate.clusterTemplateFilename
  );

  private clusterName: string;
  private snapshotId: string;
  private vpcId: string;
  private sshKeyId: string;

  constructor({
    clusterName = "${CLUSTER_NAME}",
    snapshotId = "${SNAPSHOT_ID}",
    vpcId = "${VPC_ID}",
    sshKeyId = "${SSH_KEY_ID}"
  }: {
    clusterName?: string,
    snapshotId?: string,
    vpcId?: string,
    sshKeyId?: string
  }) {
    this.clusterName = clusterName;
    this.snapshotId = snapshotId;
    this.vpcId = vpcId;
    this.sshKeyId = sshKeyId;
  }

  generateClusterTemplate(region: string): string {
    const clusterTemplate = {
      apiVersion: "cluster.x-k8s.io/v1beta1",
      kind: "Cluster",
      metadata: {
        name: this.clusterName
      },
      spec: {
        clusterNetwork: {
          pods: {
            cidrBlocks: ["172.25.0.0/16"]
          },
          services: {
            cidrBlocks: ["172.26.0.0/16"]
          }
        },
        infrastructureRef: {
          apiVersion: "infrastructure.cluster.x-k8s.io/v1",
          kind: "VultrCluster",
          name: this.clusterName
        },
        controlPlaneRef: {
          kind: "KubeadmControlPlane",
          apiVersion: "controlplane.cluster.x-k8s.io/v1beta1",
          name: `${this.clusterName}-control-plane`
        }
      }
    };

    const vultrCluster = {
      apiVersion: "infrastructure.cluster.x-k8s.io/v1beta1",
      kind: "VultrCluster",
      metadata: {
        name: this.clusterName
      },
      spec: {
        region: region
      }
    };

    // Generate MachineDeployment template for control plane
    const kubeadmControlPlane = {
      apiVersion: "controlplane.cluster.x-k8s.io/v1beta1",
      kind: "KubeadmControlPlane",
      metadata: {
        name: `${this.clusterName}-control-plane`
      },
      spec: {
        replicas: config.controlPlaneHighAvailability ? 3 : 1,
        version: config.kubernetesVersion,
        machineTemplate: {
          infrastructureRef: {
            apiVersion: "infrastructure.cluster.x-k8s.io/v1beta1",
            kind: "VultrMachineTemplate",
            name: `${this.clusterName}-control-plane`
          }
        },
        kubeadmConfigSpec: {
          initConfiguration: {
            nodeRegistration: {
              criSocket: "unix:///var/run/containerd/containerd.sock",
              kubeletExtraArgs: {
                "cgroup-driver": "systemd",
                "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                "cloud-provider": "external",
                "provider-id": "vultr://'{{ ds.meta_data[\"instance_id\"] }}'"
              }
            }
          },
          clusterConfiguration: {
            controllerManager: {
              extraArgs: {
                "enable-hostpath-provisioner": "true",
                "cloud-provider": "external"
              }
            },
            apiServer: {
              extraArgs: {
                "cloud-provider": "external"
              }
            }
          },
          joinConfiguration: {
            nodeRegistration: {
              criSocket: "unix:///var/run/containerd/containerd.sock",
              kubeletExtraArgs: {
                "cgroup-driver": "systemd",
                "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                "cloud-provider": "external"
              }
            }
          }
        }
      }
    };

    // Generate VultrMachineTemplate for control plane
    const controlPlaneMachineTemplate = {
      apiVersion: "infrastructure.cluster.x-k8s.io/v1beta1",
      kind: "VultrMachineTemplate",
      metadata: {
        name: `${this.clusterName}-control-plane`
      },
      spec: {
        template: {
          spec: {
            planID: config.controlPlanePlan,
            region: region,
            snapshot_id: this.snapshotId,
            vpc_id: this.vpcId,
            sshKey: [this.sshKeyId]
          }
        }
      }
    };

    // Generate MachineDeployment templates for each worker group
    const workerMachineDeployments = Object.entries(config.workerGroups).map(([groupName, group]) => {
      return {
        apiVersion: "cluster.x-k8s.io/v1beta1",
        kind: "MachineDeployment",
        metadata: {
          name: `${this.clusterName}-${groupName}`,
          labels: {
            "cluster.x-k8s.io/cluster-name": this.clusterName
          }
        },
        spec: {
          clusterName: this.clusterName,
          replicas: group.count,
          selector: {
            matchLabels: {
              "cluster.x-k8s.io/cluster-name": this.clusterName,
            }
          },
          template: {
            metadata: {
              labels: {
                "cluster.x-k8s.io/cluster-name": this.clusterName,
                [`node-role.kubernetes.io/${groupName}`]: "",
              }
            },
            spec: {
              clusterName: this.clusterName,
              version: config.kubernetesVersion,
              bootstrap: {
                configRef: {
                  apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
                  kind: "KubeadmConfigTemplate",
                  name: `${this.clusterName}-${groupName}`
                }
              },
              infrastructureRef: {
                apiVersion: "infrastructure.cluster.x-k8s.io/v1beta1",
                kind: "VultrMachineTemplate",
                name: `${this.clusterName}-${groupName}`
              }
            }
          }
        }
      };
    });

    // Generate VultrMachineTemplate for each worker group
    const vultrWorkerMachineTemplates = Object.entries(config.workerGroups).map(([groupName, group]) => {
      return {
        apiVersion: "infrastructure.cluster.x-k8s.io/v1beta1",
        kind: "VultrMachineTemplate",
        metadata: {
          name: `${this.clusterName}-${groupName}`
        },
        spec: {
          template: {
            spec: {
              planID: group.planId,
              region: region,
              snapshot_id: this.snapshotId,
              vpc_id: this.vpcId,
              sshKey: [this.sshKeyId]
            }
          }
        }
      };
    });

    // Generate KubeadmConfigTemplate for each worker group
    const kubeadmConfigTemplates = Object.entries(config.workerGroups).map(([groupName, group]) => {
      return {
        apiVersion: "bootstrap.cluster.x-k8s.io/v1beta1",
        kind: "KubeadmConfigTemplate",
        metadata: {
          name: `${this.clusterName}-${groupName}`
        },
        spec: {
          template: {
            spec: {
              joinConfiguration: {
                nodeRegistration: {
                  criSocket: "unix:///var/run/containerd/containerd.sock",
                  kubeletExtraArgs: {
                    "cloud-provider": "external",
                    "cgroup-driver": "systemd",
                    "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                  },
                  taints: [{
                    key: "node-role",
                    value: groupName,
                    effect: group.taintEffect || "PreferNoSchedule"
                  }]
                }
              }
            }
          }
        }
      };
    });

    // Combine all resources
    const allResources = [
      clusterTemplate,
      vultrCluster,
      kubeadmControlPlane,
      controlPlaneMachineTemplate,
      ...workerMachineDeployments,
      ...vultrWorkerMachineTemplates,
      ...kubeadmConfigTemplates,
    ];

    // Convert to YAML with proper document separators
    return allResources.map(resource => yaml.dump(resource)).join('---\n');
  }
}