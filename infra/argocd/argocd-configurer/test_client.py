#!/usr/bin/env python3
"""
Test client for the Cluster API Configuration Server
Tests health, clusters, secrets, and add_docker endpoints
"""

import requests
import json
import sys
import time
import subprocess

def test_server(base_url="http://localhost:8091"):
    """Test the Cluster API Configuration Server"""

    print("🧪 Testing Cluster API Configuration Server")
    print("=" * 50)

    # Track created secret names and their namespaces for cleanup
    created_secrets = []

    try:
        # Test 1: Health check
        print("\n1. Testing GET /health - Health check")
        try:
            response = requests.get(f"{base_url}/health")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                health_data = response.json()
                if health_data.get("status") == "healthy":
                    print("✅ Health check passed")
                else:
                    print("❌ Health check failed - status not healthy")
                    return False
            else:
                print(f"❌ Health check failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 2: List clusters
        print("\n2. Testing GET /clusters - List available clusters")
        try:
            response = requests.get(f"{base_url}/clusters")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                clusters_data = response.json()
                clusters = clusters_data.get("clusters", [])
                total = clusters_data.get("total", 0)

                if isinstance(clusters, list) and isinstance(total, int):
                    print(f"✅ Found {total} clusters: {clusters}")
                else:
                    print("❌ Invalid clusters response format")
                    return False
            else:
                print(f"❌ Clusters request failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 3: Get secrets for existing cluster
        print("\n3. Testing GET /secrets?cluster=test-cluster - Get secrets for existing cluster")
        try:
            response = requests.get(f"{base_url}/secrets?cluster=test-cluster")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                secrets_data = response.json()
                cluster = secrets_data.get("cluster")
                status = secrets_data.get("status")

                if cluster == "test-cluster":
                    print(f"✅ Successfully retrieved secrets for cluster: {cluster}")
                    print(f"Status: {status}")
                else:
                    print("❌ Unexpected cluster name in response")
                    return False
            else:
                print(f"❌ Secrets request failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 4: Get secrets for non-existent cluster
        print("\n4. Testing GET /secrets?cluster=non-existent - Get secrets for non-existent cluster")
        try:
            response = requests.get(f"{base_url}/secrets?cluster=non-existent")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 404:
                print("✅ Correctly returned 404 for non-existent cluster")
            else:
                print(f"❌ Expected 404, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 5: Get secrets without cluster parameter
        print("\n5. Testing GET /secrets - Missing cluster parameter")
        try:
            response = requests.get(f"{base_url}/secrets")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for missing cluster parameter")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 6: Add Docker secret with all required fields
        print("\n6. Testing POST /secrets/add_docker - Add Docker secret with all required fields")
        try:
            # Use a unique secret name to avoid conflicts
            import time
            unique_secret_name = f"test-docker-secret-{int(time.time())}"
            docker_namespaces = [ns.strip() for ns in "kube-system,default".split(",") if ns.strip()]
            created_secrets.append((unique_secret_name, docker_namespaces + ["argocd"]))

            docker_secret_data = {
                "password": "test_token_123",
                "username": "testuser",
                "cluster_name": "test-cluster",
                "name": unique_secret_name,
                "namespaces": "kube-system,default"
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=docker_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(docker_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                result_data = response.json()
                if result_data.get("success") == True:
                    print("✅ Successfully added Docker secret")
                else:
                    print("❌ Failed to add Docker secret")
                    return False
            else:
                print(f"❌ Add Docker secret failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 7: Add Docker secret with missing required field
        print("\n7. Testing POST /secrets/add_docker - Missing required field")
        try:
            invalid_data = {
                "password": "test_token_123",
                "cluster_name": "test-cluster",
                "name": "test-docker-secret"
                # Missing username
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=invalid_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for missing required field")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 8: Add Docker secret with upsert=true
        print("\n8. Testing POST /secrets/add_docker - With upsert=true")
        try:
            # First create a secret, then update it with upsert
            unique_secret_name = f"test-docker-secret-upsert-{int(time.time())}"
            docker_namespaces = [ns.strip() for ns in "kube-system,default".split(",") if ns.strip()]
            created_secrets.append((unique_secret_name, docker_namespaces + ["argocd"]))

            # Create the secret first
            create_data = {
                "password": "test_token_456",
                "username": "testuser2",
                "cluster_name": "test-cluster",
                "name": unique_secret_name,
                "namespaces": "kube-system,default"
            }
            create_response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=create_data,
                headers={'Content-Type': 'application/json'}
            )

            if create_response.status_code != 200:
                print(f"❌ Failed to create initial secret: {create_response.status_code}")
                return False

            # Now try to create the same secret again with upsert
            docker_secret_data = {
                "password": "test_token_789",
                "username": "testuser3",
                "cluster_name": "test-cluster",
                "name": unique_secret_name,
                "namespaces": "kube-system,default",
                "upsert": True
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=docker_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(docker_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                result_data = response.json()
                if result_data.get("success") == True:
                    print("✅ Successfully updated Docker secret with upsert")
                else:
                    print("❌ Failed to update Docker secret with upsert")
                    return False
            else:
                print(f"❌ Add Docker secret with upsert failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 9: Add Docker secret to non-existent cluster
        print("\n9. Testing POST /secrets/add_docker - Non-existent cluster")
        try:
            docker_secret_data = {
                "password": "test_token_789",
                "username": "testuser3",
                "cluster_name": "non-existent",
                "name": "test-docker-secret",
                "namespaces": "kube-system,default"
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=docker_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for non-existent cluster")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 10: Add Docker secret with invalid JSON
        print("\n10. Testing POST /secrets/add_docker - Invalid JSON")
        try:
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                data="invalid json",
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for invalid JSON")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 11: Add Docker secret with empty namespaces
        print("\n11. Testing POST /secrets/add_docker - Empty namespaces")
        try:
            docker_secret_data = {
                "password": "test_token_789",
                "username": "testuser3",
                "cluster_name": "test-cluster",
                "name": "test-docker-secret",
                "namespaces": ""
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=docker_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for empty namespaces")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 12: Add Docker secret with single namespace
        print("\n12. Testing POST /secrets/add_docker - Single namespace")
        try:
            unique_secret_name = f"test-docker-secret-single-{int(time.time())}"
            docker_namespaces = [ns.strip() for ns in "kube-system".split(",") if ns.strip()]
            created_secrets.append((unique_secret_name, docker_namespaces + ["argocd"]))

            docker_secret_data = {
                "password": "test_token_single",
                "username": "testuser_single",
                "cluster_name": "test-cluster",
                "name": unique_secret_name,
                "namespaces": "kube-system"
            }
            response = requests.post(
                f"{base_url}/secrets/add_docker",
                json=docker_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(docker_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                result_data = response.json()
                if result_data.get("success") == True:
                    print("✅ Successfully added Docker secret to single namespace")
                else:
                    print("❌ Failed to add Docker secret to single namespace")
                    return False
            else:
                print(f"❌ Add Docker secret to single namespace failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 13: Test server info endpoint
        print("\n13. Testing GET / - Server info")
        try:
            response = requests.get(f"{base_url}/")
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                info_data = response.json()
                endpoints = info_data.get("endpoints", {})

                if "GET /health" in endpoints and "GET /clusters" in endpoints and "GET /secrets" in endpoints and "POST /secrets/add_docker" in endpoints and "POST /secrets/add_helm_repo" in endpoints:
                    print("✅ Server info contains all expected endpoints")
                else:
                    print("❌ Server info missing expected endpoints")
                    return False
            else:
                print(f"❌ Server info request failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 14: Test CORS preflight
        print("\n14. Testing OPTIONS - CORS preflight")
        try:
            response = requests.options(f"{base_url}/health")
            print(f"Status: {response.status_code}")

            if response.status_code == 200:
                print("✅ CORS preflight successful")
            else:
                print(f"❌ CORS preflight failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 13: Add Helm repository secret with all required fields
        print("\n13. Testing POST /secrets/add_helm_repo - Add Helm repository secret with all required fields")
        try:
            # Use a unique secret name to avoid conflicts
            unique_secret_name = f"test-helm-secret-{int(time.time())}"
            created_secrets.append((unique_secret_name, ["argocd"]))

            helm_secret_data = {
                "name": unique_secret_name,
                "repository_url": "charts.bitnami.com/bitnami",
                "cluster_name": "test-cluster",
                "username": "helmuser",
                "password": "helmpass123",
                "use_oci": False
            }
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=helm_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(helm_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                result_data = response.json()
                if result_data.get("success") == True:
                    print("✅ Successfully added Helm repository secret")
                else:
                    print("❌ Failed to add Helm repository secret")
                    return False
            else:
                print(f"❌ Add Helm repository secret failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 14: Add Helm repository secret with missing required field
        print("\n14. Testing POST /secrets/add_helm_repo - Missing required field")
        try:
            invalid_data = {
                "name": "test-helm-secret",
                "repository_url": "charts.bitnami.com/bitnami",
                "cluster_name": "test-cluster",
                "username": "helmuser"
                # Missing password
            }
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=invalid_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for missing required field")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 15: Add Helm repository secret with upsert=true
        print("\n15. Testing POST /secrets/add_helm_repo - With upsert=true")
        try:
            # First create a secret, then update it with upsert
            unique_secret_name = f"test-helm-secret-upsert-{int(time.time())}"
            created_secrets.append((unique_secret_name, ["argocd"]))

            # Create the secret first
            create_data = {
                "name": unique_secret_name,
                "repository_url": "charts.bitnami.com/bitnami",
                "cluster_name": "test-cluster",
                "username": "helmuser1",
                "password": "helmpass456",
                "use_oci": False
            }
            create_response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=create_data,
                headers={'Content-Type': 'application/json'}
            )

            if create_response.status_code != 200:
                print(f"❌ Failed to create initial Helm secret: {create_response.status_code}")
                return False

            # Now try to create the same secret again with upsert
            helm_secret_data = {
                "name": unique_secret_name,
                "repository_url": "charts.helm.sh/stable",
                "cluster_name": "test-cluster",
                "username": "helmuser2",
                "password": "helmpass789",
                "use_oci": True,
                "upsert": True
            }
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=helm_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(helm_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 200:
                result_data = response.json()
                if result_data.get("success") == True:
                    print("✅ Successfully updated Helm repository secret with upsert")
                else:
                    print("❌ Failed to update Helm repository secret with upsert")
                    return False
            else:
                print(f"❌ Add Helm repository secret with upsert failed with status {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 16: Add Helm repository secret to non-existent cluster
        print("\n16. Testing POST /secrets/add_helm_repo - Non-existent cluster")
        try:
            helm_secret_data = {
                "name": "test-helm-secret",
                "repository_url": "charts.bitnami.com/bitnami",
                "cluster_name": "non-existent",
                "username": "helmuser",
                "password": "helmpass123",
                "use_oci": False
            }
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=helm_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for non-existent cluster")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 17: Add Helm repository secret with invalid JSON
        print("\n17. Testing POST /secrets/add_helm_repo - Invalid JSON")
        try:
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                data="invalid json",
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for invalid JSON")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        # Test 18: Add Helm repository secret with protocol in URL (should be rejected)
        print("\n18. Testing POST /secrets/add_helm_repo - URL with protocol (should be rejected)")
        try:
            helm_secret_data = {
                "name": "test-helm-secret-protocol",
                "repository_url": "https://charts.bitnami.com/bitnami",
                "cluster_name": "test-cluster",
                "username": "helmuser",
                "password": "helmpass123",
                "use_oci": False
            }
            response = requests.post(
                f"{base_url}/secrets/add_helm_repo",
                json=helm_secret_data,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Status: {response.status_code}")
            print("Request:")
            print(json.dumps(helm_secret_data, indent=2))
            print("Response:")
            print(json.dumps(response.json(), indent=2))

            if response.status_code == 400:
                print("✅ Correctly returned 400 for URL with protocol")
            else:
                print(f"❌ Expected 400, got {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

        print("\n✅ All tests passed!")
        return True

    finally:
        # Cleanup: delete created secrets from appropriate namespaces
        print("\n🧹 Cleaning up test secrets...")
        for secret_name, namespaces in created_secrets:
            for ns in namespaces:
                try:
                    # For argocd namespace, use the -iu suffix for Docker secrets
                    if ns == "argocd" and not secret_name.startswith("test-helm-secret"):
                        cleanup_secret_name = f"{secret_name}-iu"
                    else:
                        cleanup_secret_name = secret_name

                    cmd = ["kubectl", "--kubeconfig", "clusters/test-cluster.kubeconfig", "delete", "secret", cleanup_secret_name, "-n", ns]
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    if result.returncode == 0:
                        print(f"✅ Deleted secret '{cleanup_secret_name}' from namespace '{ns}'")
                    elif "not found" in result.stderr.lower():
                        print(f"ℹ️  Secret '{cleanup_secret_name}' not found in namespace '{ns}' (already cleaned up)")
                    else:
                        print(f"⚠️  Could not delete secret '{cleanup_secret_name}' from namespace '{ns}': {result.stderr.strip()}")
                except Exception as e:
                    print(f"⚠️  Exception deleting secret '{cleanup_secret_name}' from namespace '{ns}': {e}")

def main():
    """Main function"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:8091"

    print(f"Testing server at: {base_url}")
    print("Make sure the server is running before executing this test.")
    print("You can start it with: python server.py --port 8091")
    print()

    input("Press Enter to start testing...")

    success = test_server(base_url)

    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
