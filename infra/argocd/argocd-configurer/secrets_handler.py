#!/usr/bin/env python3
"""
Secrets Handler for Cluster API
Handles kubectl operations to retrieve secrets from Kubernetes clusters
"""

import json
import logging
import os
import subprocess
import yaml
import asyncio
import concurrent.futures
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

class SecretsHandler:
    """Handles secrets operations using kubectl"""

    def __init__(self, clusters_folder: str = "clusters", timeout: int = 30):
        self.clusters_folder = clusters_folder
        self.timeout = timeout

    def get_secrets_for_cluster(self, cluster_name: str) -> Dict[str, Any]:
        """Get secrets for a specific cluster using kubectl (parallel execution)"""
        try:
            # Validate cluster exists
            kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")
            if not os.path.exists(kubeconfig_path):
                raise ValueError(f"Cluster '{cluster_name}' not found. No kubeconfig file at {kubeconfig_path}")

            # Run all kubectl commands in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                # Submit all tasks
                logger.info(f"Retrieving secrets for cluster '{cluster_name}'...")

                repo_creds_future = executor.submit(
                    self._get_secrets_with_label,
                    cluster_name,
                    "argocd.argoproj.io/secret-type=repo-creds",
                    "argocd"
                )
                docker_creds_future = executor.submit(
                    self._get_secrets_with_label,
                    cluster_name,
                    "mcops.tech/secret-type=docker-creds",
                    "kube-system"
                )
                repositories_creds_future = executor.submit(
                    self._get_secrets_with_label,
                    cluster_name,
                    "argocd.argoproj.io/secret-type=repository",
                    "argocd"
                )

                # Wait for all to complete with timeout
                try:
                    repo_creds_secrets = repo_creds_future.result(timeout=self.timeout)
                    docker_creds_secrets = docker_creds_future.result(timeout=self.timeout)
                    repositories_creds_secrets = repositories_creds_future.result(timeout=self.timeout)
                except concurrent.futures.TimeoutError:
                    logger.warning(f"Timeout waiting for kubectl commands for cluster '{cluster_name}'")
                    # Cancel any remaining tasks
                    repo_creds_future.cancel()
                    docker_creds_future.cancel()
                    repositories_creds_future.cancel()
                    return {
                        "cluster": cluster_name,
                        "repo_creds_secrets": [],
                        "docker_creds_secrets": [],
                        "helm_creds_secrets": [],
                        "total_repo_creds": 0,
                        "total_docker_creds": 0,
                        "total_helm_creds": 0,
                        "status": "timeout",
                        "message": f"Commands timed out after {self.timeout} seconds"
                    }
                except Exception as e:
                    logger.error(f"Error executing parallel kubectl commands for cluster '{cluster_name}': {e}")
                    return {
                        "cluster": cluster_name,
                        "repo_creds_secrets": [],
                        "docker_creds_secrets": [],
                        "helm_creds_secrets": [],
                        "total_repo_creds": 0,
                        "total_docker_creds": 0,
                        "total_helm_creds": 0,
                        "status": "error",
                        "message": f"Error executing commands: {str(e)}"
                    }

            # Filter repositories to only include helm type secrets
            helm_creds_secrets = [
                secret for secret in repositories_creds_secrets
                if secret.get("repository_type") == "helm"
            ]

            return {
                "cluster": cluster_name,
                "repo_creds_secrets": repo_creds_secrets,
                "docker_creds_secrets": docker_creds_secrets,
                "helm_creds_secrets": helm_creds_secrets,
                "total_repo_creds": len(repo_creds_secrets),
                "total_docker_creds": len(docker_creds_secrets),
                "total_helm_creds": len(helm_creds_secrets),
                "status": "success"
            }

        except Exception as e:
            logger.error(f"Error getting secrets for cluster '{cluster_name}': {str(e)}")
            raise

    def _get_secrets_with_label(self, cluster_name: str, label_selector: str, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get secrets with specific label selector using kubectl"""
        try:
            kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

            # Run kubectl command to get secrets with label
            cmd = [
                "kubectl",
                "--kubeconfig", kubeconfig_path,
                "get", "secrets",
                "-l", label_selector,
                "-o", "json"
            ]
            if namespace:
                cmd.append("-n")
                cmd.append(namespace)

            logger.info(f"Running kubectl command: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout  # Use configurable timeout
            )

            if result.returncode != 0:
                # Check if it's a connection error
                if "Unable to connect to the server" in result.stderr or "connection refused" in result.stderr.lower():
                    logger.warning(f"Cannot connect to cluster '{cluster_name}': {result.stderr.strip()}")
                    return []
                elif "timeout" in result.stderr.lower():
                    logger.warning(f"Connection to cluster '{cluster_name}' timed out")
                    return []
                else:
                    logger.error(f"kubectl command failed: {result.stderr}")
                    return []

            # Parse JSON output
            secrets_data = json.loads(result.stdout)

            # Extract relevant information from secrets
            secrets = []
            for item in secrets_data.get("items", []):
                metadata = item.get("metadata", {})
                labels = metadata.get("labels", {})

                secret_info = {
                    "name": metadata.get("name", ""),
                    "namespace": metadata.get("namespace", ""),
                    "labels": labels,
                    "type": item.get("type", ""),
                    "creation_timestamp": metadata.get("creationTimestamp", "")
                }

                # Add detailed metadata for helm repository secrets
                if labels.get("argocd.argoproj.io/secret-type") == "repository":
                    # Get stringData for helm secrets
                    data = item.get("data", {})
                    secret_info.update({
                        "repository_url": self._base64_decode(data.get("url", "")),
                        "repository_name": self._base64_decode(data.get("name", "")),
                        "repository_type": self._base64_decode(data.get("type", "")),
                        "username": self._base64_decode(data.get("username", ""))
                    })
                    if self._base64_decode(data.get("type", "")) == "helm":
                        secret_info.update({
                            "enable_oci": self._base64_decode(data.get("enableOCI", "ZmFsc2U=")).lower() == "true"
                        })

                secrets.append(secret_info)

            return secrets

        except subprocess.TimeoutExpired:
            logger.warning(f"kubectl command timed out for cluster '{cluster_name}' after {self.timeout} seconds")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse kubectl output for cluster '{cluster_name}': {e}")
            return []
        except Exception as e:
            logger.error(f"Error getting secrets with label '{label_selector}' for cluster '{cluster_name}': {e}")
            return []

    def list_available_clusters(self) -> List[str]:
        """List all available clusters based on kubeconfig files"""
        try:
            clusters = []
            if not os.path.exists(self.clusters_folder):
                return clusters

            for filename in os.listdir(self.clusters_folder):
                if filename.endswith('.kubeconfig'):
                    cluster_name = filename.replace('.kubeconfig', '')
                    clusters.append(cluster_name)

            return clusters

        except Exception as e:
            logger.error(f"Error listing clusters: {e}")
            return []

    def add_docker_secret(self, cluster_name: str, secret_name: str, password: str, username: str, namespaces: List[str], upsert: bool = False) -> Dict[str, Any]:
        """Add Docker registry secret to multiple namespaces in cluster"""
        try:
            # Validate cluster exists
            kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")
            if not os.path.exists(kubeconfig_path):
                raise ValueError(f"Cluster '{cluster_name}' not found. No kubeconfig file at {kubeconfig_path}")

            # Check if secrets already exist in any of the provided namespaces
            existing_secrets = self._check_existing_secrets_in_namespaces(cluster_name, secret_name, namespaces)
            existing_namespaces = [ns for ns, exists in existing_secrets.items() if exists['exists']]

            if existing_namespaces and not upsert:
                return {
                    "error": True,
                    "message": f"Secrets already exist in namespaces: {', '.join(existing_namespaces)}",
                    "existing_secrets": existing_secrets,
                    "upsert_required": True
                }

            # Delete existing secrets if upsert is True
            if upsert and existing_namespaces:
                self._delete_existing_secrets_in_namespaces(cluster_name, secret_name, existing_namespaces)

            # Generate Docker registry secret YAML for each namespace
            results = []
            for namespace in namespaces:
                docker_secret_yaml = self._generate_docker_secret_yaml(secret_name, password, username, namespace)
                result = self._apply_yaml_to_cluster(cluster_name, docker_secret_yaml, namespace)
                results.append({
                    "namespace": namespace,
                    "result": result
                })

            # Also create ArgoCD image updater secret in argocd namespace
            argocd_image_updater_yaml = self._generate_argocd_image_updater_yaml(secret_name, password, username)
            argocd_result = self._apply_yaml_to_cluster(cluster_name, argocd_image_updater_yaml, "argocd")
            results.append({
                "namespace": "argocd",
                "result": argocd_result
            })

            return {
                "success": True,
                "cluster": cluster_name,
                "secret_name": secret_name,
                "namespaces": namespaces + ["argocd"],
                "results": results,
                "message": f"Docker registry secrets {'updated' if existing_namespaces else 'created'} successfully in {len(namespaces) + 1} namespace(s)"
            }

        except Exception as e:
            logger.error(f"Error adding Docker secret to cluster '{cluster_name}': {str(e)}")
            raise

    def add_helm_repo_secret(self, cluster_name: str, secret_name: str, repository_url: str, use_oci: bool, password: str, username: str,  upsert: bool = False) -> Dict[str, Any]:
        """Add Helm repository secret to cluster"""
        try:
            # Validate repository_url format (no protocol)
            if '://' in repository_url:
                raise ValueError(f"Repository URL '{repository_url}' contains protocol. Please provide only hostname and port (e.g., 'ghcr.io' or 'registry.example.com:5000')")

            # Validate cluster exists
            kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")
            if not os.path.exists(kubeconfig_path):
                raise ValueError(f"Cluster '{cluster_name}' not found. No kubeconfig file at {kubeconfig_path}")

            # Check if secret already exists
            existing_secret = self._check_existing_helm_secret(cluster_name, secret_name)

            if existing_secret['exists']:
                if not upsert:
                    return {
                        "error": True,
                        "message": "Helm repository secret already exists",
                        "existing_secret": existing_secret,
                        "upsert_required": True
                    }
                else:
                    # Delete existing secret if upsert is True
                    self._delete_existing_helm_secret(cluster_name, secret_name)

            # Generate Helm repository secret YAML
            helm_secret_yaml = self._generate_helm_secret_yaml(secret_name, repository_url, use_oci, password, username)

            # Apply the YAML file
            result = self._apply_yaml_to_cluster(cluster_name, helm_secret_yaml, "argocd")

            return {
                "success": True,
                "cluster": cluster_name,
                "secret_name": secret_name,
                "repository_url": repository_url,
                "helm_secret_applied": result,
                "message": "Helm repository secret updated successfully" if existing_secret['exists'] else "Helm repository secret created successfully"
            }

        except Exception as e:
            logger.error(f"Error adding Helm repository secret to cluster '{cluster_name}': {str(e)}")
            raise

    def _check_existing_secrets(self, cluster_name: str, secret_name: str) -> Dict[str, Any]:
        """Check if secrets already exist in both namespaces"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        # Check kube-system namespace
        kube_system_cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "get", "secret", secret_name, "-n", "kube-system", "-o", "json"
        ]

        # Check argocd namespace
        argocd_cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "get", "secret", secret_name, "-n", "argocd", "-o", "json"
        ]

        kube_system_exists = False
        argocd_exists = False
        kube_system_description = ""
        argocd_description = ""

        try:
            result = subprocess.run(kube_system_cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                kube_system_exists = True
                secret_data = json.loads(result.stdout)
                kube_system_description = {
                    "name": secret_data.get("metadata", {}).get("name", ""),
                    "namespace": secret_data.get("metadata", {}).get("namespace", ""),
                    "type": secret_data.get("type", ""),
                    "labels": secret_data.get("metadata", {}).get("labels", {})
                }
        except Exception:
            pass

        try:
            result = subprocess.run(argocd_cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                argocd_exists = True
                secret_data = json.loads(result.stdout)
                argocd_description = {
                    "name": secret_data.get("metadata", {}).get("name", ""),
                    "namespace": secret_data.get("metadata", {}).get("namespace", ""),
                    "type": secret_data.get("type", ""),
                    "labels": secret_data.get("metadata", {}).get("labels", {})
                }
        except Exception:
            pass

        return {
            "kube_system_exists": kube_system_exists,
            "argocd_exists": argocd_exists,
            "kube_system_description": kube_system_description,
            "argocd_description": argocd_description
        }

    def _delete_existing_secrets(self, cluster_name: str, secret_name: str):
        """Delete existing secrets from both namespaces"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        # Delete from kube-system namespace
        kube_system_cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "delete", "secret", secret_name, "-n", "kube-system"
        ]

        # Delete from argocd namespace
        argocd_cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "delete", "secret", secret_name, "-n", "argocd"
        ]

        try:
            subprocess.run(kube_system_cmd, capture_output=True, text=True, timeout=10)
        except Exception:
            pass

        try:
            subprocess.run(argocd_cmd, capture_output=True, text=True, timeout=10)
        except Exception:
            pass

    def _check_existing_secrets_in_namespaces(self, cluster_name: str, secret_name: str, namespaces: List[str]) -> Dict[str, Any]:
        """Check if secrets already exist in the specified namespaces"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")
        results = {}

        for namespace in namespaces:
            cmd = [
                "kubectl", "--kubeconfig", kubeconfig_path,
                "get", "secret", secret_name, "-n", namespace, "-o", "json"
            ]

            exists = False
            description = {}

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    exists = True
                    secret_data = json.loads(result.stdout)
                    description = {
                        "name": secret_data.get("metadata", {}).get("name", ""),
                        "namespace": secret_data.get("metadata", {}).get("namespace", ""),
                        "type": secret_data.get("type", ""),
                        "labels": secret_data.get("metadata", {}).get("labels", {})
                    }
            except Exception:
                pass

            results[namespace] = {
                "exists": exists,
                "description": description
            }

        return results

    def _delete_existing_secrets_in_namespaces(self, cluster_name: str, secret_name: str, namespaces: List[str]):
        """Delete existing secrets from the specified namespaces"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        for namespace in namespaces:
            cmd = [
                "kubectl", "--kubeconfig", kubeconfig_path,
                "delete", "secret", secret_name, "-n", namespace
            ]

            try:
                subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            except Exception:
                pass

    def _generate_docker_secret_yaml(self, secret_name: str, password: str, username: str, namespace: str) -> str:
        """Generate Docker registry secret YAML"""
        docker_config = {
            "auths": {
                "ghcr.io": {
                    "auth": self._encode_docker_auth(username, password)
                }
            }
        }

        docker_config_json = json.dumps(docker_config)
        docker_config_b64 = self._base64_encode(docker_config_json)

        yaml_content = f"""apiVersion: v1
kind: Secret
metadata:
  name: {secret_name}
  namespace: {namespace}
  labels:
    mcops.tech/secret-type: docker-creds
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: {docker_config_b64}
"""
        return yaml_content

    def _generate_argocd_image_updater_yaml(self, secret_name: str, github_pat: str, github_username: str) -> str:
        """Generate ArgoCD image updater secret YAML (generic secret with username/password)"""
        # Base64 encode the username and password
        username_b64 = self._base64_encode(github_username)
        password_b64 = self._base64_encode(github_pat)

        yaml_content = f"""apiVersion: v1
kind: Secret
metadata:
  name: {secret_name}-iu
  namespace: argocd
  labels:
    mcops.tech/secret-type: docker-creds
type: Opaque
data:
  username: {username_b64}
  password: {password_b64}
"""
        return yaml_content

    def _encode_docker_auth(self, username: str, password: str) -> str:
        """Encode Docker authentication string"""
        auth_string = f"{username}:{password}"
        return self._base64_encode(auth_string)

    def _base64_encode(self, data: str) -> str:
        """Base64 encode string"""
        import base64
        return base64.b64encode(data.encode('utf-8')).decode('utf-8')

    def _base64_decode(self, data: str) -> str:
        """Base64 decode string"""
        import base64
        return base64.b64decode(data.encode('utf-8')).decode('utf-8')

    def _apply_yaml_to_cluster(self, cluster_name: str, yaml_content: str, namespace: str) -> Dict[str, Any]:
        """Apply YAML content to cluster"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        # Write YAML to temporary file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as temp_file:
            temp_file.write(yaml_content)
            temp_file_path = temp_file.name

        try:
            # Apply YAML using kubectl
            cmd = [
                "kubectl", "--kubeconfig", kubeconfig_path,
                "apply", "-f", temp_file_path
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                return {
                    "success": True,
                    "namespace": namespace,
                    "output": result.stdout.strip()
                }
            else:
                return {
                    "success": False,
                    "namespace": namespace,
                    "error": result.stderr.strip()
                }
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass

    def _check_existing_helm_secret(self, cluster_name: str, secret_name: str) -> Dict[str, Any]:
        """Check if helm repository secret already exists in argocd namespace"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        # Check argocd namespace for helm repository secret
        cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "get", "secret", secret_name, "-n", "argocd", "-o", "json"
        ]

        exists = False
        secret_description = ""

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                exists = True
                secret_data = json.loads(result.stdout)
                labels = secret_data.get("metadata", {}).get("labels", {})

                # Check if it has the correct label
                if labels.get("argocd.argoproj.io/secret-type") == "repository":
                    secret_description = {
                        "name": secret_data.get("metadata", {}).get("name", ""),
                        "namespace": secret_data.get("metadata", {}).get("namespace", ""),
                        "type": secret_data.get("type", ""),
                        "labels": labels
                    }
                else:
                    # Secret exists but doesn't have the correct label
                    exists = False
        except Exception:
            pass

        return {
            "exists": exists,
            "description": secret_description
        }

    def _delete_existing_helm_secret(self, cluster_name: str, secret_name: str):
        """Delete existing helm repository secret from argocd namespace"""
        kubeconfig_path = os.path.join(self.clusters_folder, f"{cluster_name}.kubeconfig")

        cmd = [
            "kubectl", "--kubeconfig", kubeconfig_path,
            "delete", "secret", secret_name, "-n", "argocd"
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        except Exception:
            pass

    def _generate_helm_secret_yaml(self, secret_name: str, repository_url: str, use_oci: bool, password: str, username: str) -> str:
        """Generate Helm repository secret YAML"""
        # Common fields
        common_fields = f"""  url: {repository_url}
  name: {secret_name}
  type: helm
  username: {username}
  password: {password}"""

        # Add OCI-specific field if needed
        if use_oci:
            common_fields += "\n  enableOCI: \"true\""

        yaml_content = f"""apiVersion: v1
kind: Secret
metadata:
  name: {secret_name}
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
{common_fields}
"""

        return yaml_content
