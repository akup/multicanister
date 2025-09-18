#!/usr/bin/env python3
"""
Configuration Handler for Cluster API
Handles cluster configuration processing, YAML conversion, and diff calculation
"""

import yaml
import os
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class WorkerGroup:
    """Worker group configuration"""
    def __init__(self, count: int, plan_id: str, taint_effect: str = None):
        self.count = count
        self.plan_id = plan_id
        self.taint_effect = taint_effect
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "count": self.count,
            "planId": self.plan_id
        }
        if self.taint_effect:
            result["taintEffect"] = self.taint_effect
        return result
    
    def __eq__(self, other):
        if not isinstance(other, WorkerGroup):
            return False
        return (self.count == other.count and 
                self.plan_id == other.plan_id and 
                self.taint_effect == other.taint_effect)
    
    def __hash__(self):
        return hash((self.count, self.plan_id, self.taint_effect))

class ClusterConfig:
    """Cluster configuration model"""
    def __init__(
        self,
        region: str,
        cluster_name: str,
        control_plane_high_availability: bool = True,
        worker_groups: Optional[Dict[str, WorkerGroup]] = None
    ):
        self.region = region
        self.cluster_name = cluster_name
        self.control_plane_high_availability = control_plane_high_availability
        self.worker_groups = worker_groups or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for YAML serialization"""
        return {
            "region": self.region,
            "clusterName": self.cluster_name,
            "controlPlaneHighAvailability": self.control_plane_high_availability,
            "workerGroups": {
                name: group.to_dict() for name, group in self.worker_groups.items()
            }
        }
    
    def __eq__(self, other):
        if not isinstance(other, ClusterConfig):
            return False
        return (
            self.region == other.region and
            self.cluster_name == other.cluster_name and
            self.control_plane_high_availability == other.control_plane_high_availability and
            self.worker_groups == other.worker_groups
        )

class ConfigDiff:
    """Configuration difference result"""
    def __init__(self):
        self.previous_region: Optional[str] = None
        self.previous_control_plane_ha: Optional[bool] = None
        self.worker_groups_added: List[Dict[str, Any]] = []
        self.worker_groups_modified: List[Dict[str, Any]] = []
        self.worker_groups_deleted: List[Dict[str, Any]] = []
        self.has_changes = False

class ConfigurationHandler:
    """Handles cluster configuration processing and storage"""
    
    def __init__(self, config_dir: str = "cluster_configs"):
        self.config_dir = config_dir
        self._ensure_config_dir()
    
    def _ensure_config_dir(self):
        """Ensure configuration directory exists"""
        if not os.path.exists(self.config_dir):
            os.makedirs(self.config_dir)
            logger.info(f"Created configuration directory: {self.config_dir}")
    
    def _get_config_file_path(self, cluster_name: str) -> str:
        """Get the file path for a cluster configuration"""
        safe_name = self._sanitize_filename(cluster_name)
        return os.path.join(self.config_dir, f"{safe_name}.yaml")
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to be filesystem safe"""
        # Replace invalid characters with underscores
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        return filename
    
    def _load_existing_config(self, cluster_name: str) -> Optional[ClusterConfig]:
        """Load existing configuration from file"""
        config_path = self._get_config_file_path(cluster_name)
        
        if not os.path.exists(config_path):
            return None
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            if not data:
                return None
            
            # Parse worker groups
            worker_groups = {}
            if 'workerGroups' in data:
                for name, group_data in data['workerGroups'].items():
                    worker_groups[name] = WorkerGroup(
                        count=group_data.get('count', 0),
                        plan_id=group_data.get('planId', ''),
                        taint_effect=group_data.get('taintEffect')
                    )
            
            return ClusterConfig(
                region=data.get('region', ''),
                cluster_name=data.get('clusterName', cluster_name),
                control_plane_high_availability=data.get('controlPlaneHighAvailability', True),
                worker_groups=worker_groups
            )
            
        except Exception as e:
            logger.error(f"Error loading existing config for {cluster_name}: {e}")
            return None
    
    def _calculate_diff(self, old_config: Optional[ClusterConfig], new_config: ClusterConfig) -> ConfigDiff:
        """Calculate differences between old and new configurations"""
        diff = ConfigDiff()
        
        if old_config is None:
            # New configuration
            diff.worker_groups_added = [
                {
                    "name": name,
                    "config": group.to_dict()
                }
                for name, group in new_config.worker_groups.items()
            ]
            diff.has_changes = True
            return diff
        
        # Check region changes
        if old_config.region != new_config.region:
            diff.previous_region = old_config.region
            diff.has_changes = True
            logger.info(f"Region changed from '{old_config.region}' to '{new_config.region}'")
        
        # Check control plane HA changes
        if old_config.control_plane_high_availability != new_config.control_plane_high_availability:
            diff.previous_control_plane_ha = old_config.control_plane_high_availability
            diff.has_changes = True
            logger.info(f"Control plane HA changed from {old_config.control_plane_high_availability} to {new_config.control_plane_high_availability}")
        
        # Check worker group changes
        old_groups = set(old_config.worker_groups.keys())
        new_groups = set(new_config.worker_groups.keys())
        
        # Added groups
        added = new_groups - old_groups
        if added:
            diff.worker_groups_added = [
                {
                    "name": name,
                    "config": new_config.worker_groups[name].to_dict()
                }
                for name in added
            ]
            diff.has_changes = True
            logger.info(f"Worker groups added: {', '.join(added)}")
        
        # Deleted groups
        deleted = old_groups - new_groups
        if deleted:
            diff.worker_groups_deleted = [
                {
                    "name": name,
                    "config": old_config.worker_groups[name].to_dict()
                }
                for name in deleted
            ]
            diff.has_changes = True
            logger.info(f"Worker groups deleted: {', '.join(deleted)}")
        
        # Modified groups
        common_groups = old_groups & new_groups
        for group_name in common_groups:
            old_group = old_config.worker_groups[group_name]
            new_group = new_config.worker_groups[group_name]
            
            if old_group != new_group:
                changes = {}
                if old_group.count != new_group.count:
                    changes["count"] = {
                        "previous": old_group.count,
                        "new": new_group.count
                    }
                if old_group.plan_id != new_group.plan_id:
                    changes["planId"] = {
                        "previous": old_group.plan_id,
                        "new": new_group.plan_id
                    }
                if old_group.taint_effect != new_group.taint_effect:
                    changes["taintEffect"] = {
                        "previous": old_group.taint_effect,
                        "new": new_group.taint_effect
                    }
                
                diff.worker_groups_modified.append({
                    "name": group_name,
                    "previous_config": old_group.to_dict(),
                    "new_config": new_group.to_dict(),
                    "changes": changes
                })
                diff.has_changes = True
                logger.info(f"Worker group '{group_name}' modified:")
                logger.info(f"  - Count: {old_group.count} -> {new_group.count}")
                logger.info(f"  - Plan ID: {old_group.plan_id} -> {new_group.plan_id}")
                if old_group.taint_effect != new_group.taint_effect:
                    logger.info(f"  - Taint Effect: {old_group.taint_effect} -> {new_group.taint_effect}")
        
        return diff
    
    def _save_config(self, config: ClusterConfig) -> bool:
        """Save configuration to YAML file and generate Kubernetes manifests"""
        try:
            config_path = self._get_config_file_path(config.cluster_name)
            
            # Convert to dictionary and save as YAML
            config_dict = config.to_dict()
            
            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config_dict, f, default_flow_style=False, indent=2, sort_keys=False)
            
            logger.info(f"Configuration saved to: {config_path}")
            
            # Generate Kubernetes manifests
            self._generate_kubernetes_manifests(config)
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
            return False
    
    def _generate_kubernetes_manifests(self, config: ClusterConfig):
        """Generate Kubernetes manifests for the cluster"""
        try:
            # Create capi_kubernetes directory structure
            capi_dir = os.path.join("capi_kubernetes", config.cluster_name)
            os.makedirs(capi_dir, exist_ok=True)
            
            # Generate cluster template YAML
            cluster_template = self._generate_cluster_template(config)
            
            # Save cluster template
            template_path = os.path.join(capi_dir, "cluster-template.yaml")
            with open(template_path, 'w', encoding='utf-8') as f:
                f.write(cluster_template)
            
            logger.info(f"Kubernetes manifests generated in: {capi_dir}")
            
        except Exception as e:
            logger.error(f"Error generating Kubernetes manifests: {e}")
            raise
    
    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration values from configs/defaults.yaml"""
        try:
            config_path = os.path.join("configs", "defaults.yaml")
            if not os.path.exists(config_path):
                # Fallback to hardcoded defaults if file doesn't exist
                logger.warning(f"Default config file not found at {config_path}, using hardcoded defaults")
                return {
                    "kubernetesVersion": "v1.32.4",
                    "controlPlanePlan": "vc2-2c-2gb"
                }
            
            with open(config_path, 'r', encoding='utf-8') as f:
                defaults = yaml.safe_load(f)
            
            # Validate required fields
            required_fields = ["kubernetesVersion", "controlPlanePlan"]
            for field in required_fields:
                if field not in defaults:
                    raise ValueError(f"Missing required field '{field}' in defaults.yaml")
            
            logger.info(f"Loaded default config from {config_path}")
            return defaults
            
        except Exception as e:
            logger.error(f"Error loading default config: {e}")
            # Fallback to hardcoded defaults
            return {
                "kubernetesVersion": "v1.28.0",
                "controlPlanePlan": "vc2-2c-4gb"
            }

    def _generate_cluster_template(self, config: ClusterConfig) -> str:
        """Generate cluster template YAML based on cluster_template.ts logic"""
        
        # Load default configuration values
        defaults = self._load_default_config()
        
        # Default values (should match config.ts)
        default_config = {
            "region": config.region,
            "kubernetesVersion": defaults["kubernetesVersion"],
            "controlPlaneCount": 3 if config.control_plane_high_availability else 1,
            "controlPlanePlan": defaults["controlPlanePlan"],
            "workerGroups": config.worker_groups
        }
        
        # Generate Cluster resource
        cluster = {
            "apiVersion": "cluster.x-k8s.io/v1beta1",
            "kind": "Cluster",
            "metadata": {
                "name": config.cluster_name
            },
            "spec": {
                "clusterNetwork": {
                    "pods": {
                        "cidrBlocks": ["172.25.0.0/16"]
                    },
                    "services": {
                        "cidrBlocks": ["172.26.0.0/16"]
                    }
                },
                "infrastructureRef": {
                    "apiVersion": "infrastructure.cluster.x-k8s.io/v1",
                    "kind": "VultrCluster",
                    "name": config.cluster_name
                },
                "controlPlaneRef": {
                    "kind": "KubeadmControlPlane",
                    "apiVersion": "controlplane.cluster.x-k8s.io/v1beta1",
                    "name": f"{config.cluster_name}-control-plane"
                }
            }
        }
        
        # Generate VultrCluster resource
        vultr_cluster = {
            "apiVersion": "infrastructure.cluster.x-k8s.io/v1beta1",
            "kind": "VultrCluster",
            "metadata": {
                "name": config.cluster_name
            },
            "spec": {
                "region": config.region
            }
        }
        
        # Generate KubeadmControlPlane resource
        kubeadm_control_plane = {
            "apiVersion": "controlplane.cluster.x-k8s.io/v1beta1",
            "kind": "KubeadmControlPlane",
            "metadata": {
                "name": f"{config.cluster_name}-control-plane"
            },
            "spec": {
                "replicas": default_config["controlPlaneCount"],
                "version": default_config["kubernetesVersion"],
                "machineTemplate": {
                    "infrastructureRef": {
                        "apiVersion": "infrastructure.cluster.x-k8s.io/v1beta1",
                        "kind": "VultrMachineTemplate",
                        "name": f"{config.cluster_name}-control-plane"
                    }
                },
                "kubeadmConfigSpec": {
                    "initConfiguration": {
                        "nodeRegistration": {
                            "criSocket": "unix:///var/run/containerd/containerd.sock",
                            "kubeletExtraArgs": {
                                "cgroup-driver": "systemd",
                                "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                                "cloud-provider": "external",
                                "provider-id": "vultr://'{{ ds.meta_data[\"instance_id\"] }}'"
                            }
                        }
                    },
                    "clusterConfiguration": {
                        "controllerManager": {
                            "extraArgs": {
                                "enable-hostpath-provisioner": "true",
                                "cloud-provider": "external"
                            }
                        },
                        "apiServer": {
                            "extraArgs": {
                                "cloud-provider": "external"
                            }
                        }
                    },
                    "joinConfiguration": {
                        "nodeRegistration": {
                            "criSocket": "unix:///var/run/containerd/containerd.sock",
                            "kubeletExtraArgs": {
                                "cgroup-driver": "systemd",
                                "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                                "cloud-provider": "external"
                            }
                        }
                    }
                }
            }
        }
        
        # Generate VultrMachineTemplate for control plane
        control_plane_machine_template = {
            "apiVersion": "infrastructure.cluster.x-k8s.io/v1beta1",
            "kind": "VultrMachineTemplate",
            "metadata": {
                "name": f"{config.cluster_name}-control-plane"
            },
            "spec": {
                "template": {
                    "spec": {
                        "planID": default_config["controlPlanePlan"],
                        "region": config.region,
                        "snapshot_id": "${SNAPSHOT_ID}",
                        "vpc_id": "${VPC_ID}",
                        "sshKey": ["${SSH_KEY_ID}"]
                    }
                }
            }
        }
        
        # Generate MachineDeployment templates for each worker group
        worker_machine_deployments = []
        vultr_worker_machine_templates = []
        kubeadm_config_templates = []
        
        for group_name, group in config.worker_groups.items():
            # MachineDeployment
            worker_machine_deployments.append({
                "apiVersion": "cluster.x-k8s.io/v1beta1",
                "kind": "MachineDeployment",
                "metadata": {
                    "name": f"{config.cluster_name}-{group_name}",
                    "labels": {
                        "cluster.x-k8s.io/cluster-name": config.cluster_name
                    }
                },
                "spec": {
                    "clusterName": config.cluster_name,
                    "replicas": group.count,
                    "selector": {
                        "matchLabels": {
                            "cluster.x-k8s.io/cluster-name": config.cluster_name,
                        }
                    },
                    "template": {
                        "metadata": {
                            "labels": {
                                "cluster.x-k8s.io/cluster-name": config.cluster_name,
                                f"node-role.kubernetes.io/{group_name}": "",
                            }
                        },
                        "spec": {
                            "clusterName": config.cluster_name,
                            "version": default_config["kubernetesVersion"],
                            "bootstrap": {
                                "configRef": {
                                    "apiVersion": "bootstrap.cluster.x-k8s.io/v1beta1",
                                    "kind": "KubeadmConfigTemplate",
                                    "name": f"{config.cluster_name}-{group_name}"
                                }
                            },
                            "infrastructureRef": {
                                "apiVersion": "infrastructure.cluster.x-k8s.io/v1beta1",
                                "kind": "VultrMachineTemplate",
                                "name": f"{config.cluster_name}-{group_name}"
                            }
                        }
                    }
                }
            })
            
            # VultrMachineTemplate
            vultr_worker_machine_templates.append({
                "apiVersion": "infrastructure.cluster.x-k8s.io/v1beta1",
                "kind": "VultrMachineTemplate",
                "metadata": {
                    "name": f"{config.cluster_name}-{group_name}"
                },
                "spec": {
                    "template": {
                        "spec": {
                            "planID": group.plan_id,
                            "region": config.region,
                            "snapshot_id": "${SNAPSHOT_ID}",
                            "vpc_id": "${VPC_ID}",
                            "sshKey": ["${SSH_KEY_ID}"]
                        }
                    }
                }
            })
            
            # KubeadmConfigTemplate
            kubeadm_config_templates.append({
                "apiVersion": "bootstrap.cluster.x-k8s.io/v1beta1",
                "kind": "KubeadmConfigTemplate",
                "metadata": {
                    "name": f"{config.cluster_name}-{group_name}"
                },
                "spec": {
                    "template": {
                        "spec": {
                            "joinConfiguration": {
                                "nodeRegistration": {
                                    "criSocket": "unix:///var/run/containerd/containerd.sock",
                                    "kubeletExtraArgs": {
                                        "cloud-provider": "external",
                                        "cgroup-driver": "systemd",
                                        "eviction-hard": "nodefs.available<0%,nodefs.inodesFree<0%,imagefs.available<0%",
                                    },
                                    "taints": [{
                                        "key": "node-role",
                                        "value": group_name,
                                        "effect": group.taint_effect if group.taint_effect else "PreferNoSchedule"
                                    }]
                                }
                            }
                        }
                    }
                }
            })
        
        # Combine all resources
        all_resources = [
            cluster,
            vultr_cluster,
            kubeadm_control_plane,
            control_plane_machine_template,
            *worker_machine_deployments,
            *vultr_worker_machine_templates,
            *kubeadm_config_templates,
        ]
        
        # Convert to YAML with proper document separators
        yaml_documents = []
        for resource in all_resources:
            yaml_documents.append(yaml.dump(resource, default_flow_style=False, indent=2, sort_keys=False))
        
        return '---\n'.join(yaml_documents)
    
    def _prepare_config_response(self, config_data: Dict[str, Any], save: bool = False) -> Dict[str, Any]:
        """Shared logic for processing or previewing configuration changes"""
        # Validate required fields
        if 'region' not in config_data:
            raise ValueError("Missing required field: 'region'")
        if 'clusterName' not in config_data:
            raise ValueError("Missing required field: 'clusterName'")
        region = config_data['region']
        cluster_name = config_data['clusterName']
        if not isinstance(region, str) or not region.strip():
            raise ValueError("'region' must be a non-empty string")
        if not isinstance(cluster_name, str) or not cluster_name.strip():
            raise ValueError("'clusterName' must be a non-empty string")
        # Parse control plane HA (default to True)
        control_plane_ha = config_data.get('controlPlaneHighAvailability', True)
        if not isinstance(control_plane_ha, bool):
            raise ValueError("'controlPlaneHighAvailability' must be a boolean")
        # Parse worker groups
        worker_groups = {}
        if 'workerGroups' in config_data:
            worker_groups_data = config_data['workerGroups']
            if not isinstance(worker_groups_data, dict):
                raise ValueError("'workerGroups' must be an object")
            for group_name, group_data in worker_groups_data.items():
                if not isinstance(group_name, str):
                    raise ValueError("Worker group names must be strings")
                if not isinstance(group_data, dict):
                    raise ValueError(f"Worker group '{group_name}' must be an object")
                if 'count' not in group_data:
                    raise ValueError(f"Worker group '{group_name}' missing 'count' field")
                if 'planId' not in group_data:
                    raise ValueError(f"Worker group '{group_name}' missing 'planId' field")
                count = group_data['count']
                plan_id = group_data['planId']
                if not isinstance(count, int):
                    raise ValueError(f"Worker group '{group_name}' count must be an integer")
                if count < 1:
                    raise ValueError(f"Worker group '{group_name}' count must be at least 1. To remove a worker group, exclude it from the request entirely.")
                if not isinstance(plan_id, str) or not plan_id.strip():
                    raise ValueError(f"Worker group '{group_name}' planId must be a non-empty string")
                taint_effect = group_data.get('taintEffect')
                if taint_effect and taint_effect not in ['NoSchedule', 'PreferNoSchedule', 'NoExecute']:
                    raise ValueError(f"Worker group '{group_name}' taintEffect must be one of: NoSchedule, PreferNoSchedule, NoExecute")
                worker_groups[group_name] = WorkerGroup(count, plan_id, taint_effect)
        # Create new configuration
        new_config = ClusterConfig(
            region=region,
            cluster_name=cluster_name,
            control_plane_high_availability=control_plane_ha,
            worker_groups=worker_groups
        )
        # Load existing configuration
        old_config = self._load_existing_config(cluster_name)
        # Calculate differences
        diff = self._calculate_diff(old_config, new_config)
        # Save new configuration if requested
        save_success = True
        if save:
            save_success = self._save_config(new_config)
            if not save_success:
                raise RuntimeError("Failed to save configuration")
        # Prepare response
        response_data = {
            "success": True,
            "message": f"{'Configuration processed' if save else 'Preview of configuration changes'} for cluster: {cluster_name}",
            "cluster_name": cluster_name,
            "region": region,
            "control_plane_high_availability": control_plane_ha,
            "worker_groups_count": len(worker_groups),
        }
        if save:
            response_data["config_file"] = self._get_config_file_path(cluster_name)
        response_data["changes_detected"] = diff.has_changes
        response_data["changes"] = {
            "region": {
                "previous": diff.previous_region,
                "current": region
            } if diff.previous_region is not None else None,
            "control_plane_high_availability": {
                "previous": diff.previous_control_plane_ha,
                "current": control_plane_ha
            } if diff.previous_control_plane_ha is not None else None,
            "worker_groups_added": diff.worker_groups_added,
            "worker_groups_modified": diff.worker_groups_modified,
            "worker_groups_deleted": diff.worker_groups_deleted
        }
        return response_data

    def process_configuration(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process cluster configuration request"""
        try:
            response_data = self._prepare_config_response(config_data, save=True)
            logger.info(f"Configuration processed successfully for cluster: {response_data['cluster_name']}")
            return response_data
        except Exception as e:
            logger.error(f"Error processing configuration: {e}")
            raise

    def preview_configuration_changes(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Preview changes for a cluster configuration request without saving to file"""
        try:
            return self._prepare_config_response(config_data, save=False)
        except Exception as e:
            logger.error(f"Error previewing configuration changes: {e}")
            raise 