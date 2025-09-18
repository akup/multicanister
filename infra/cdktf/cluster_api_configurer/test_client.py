#!/usr/bin/env python3
"""
Test client for the Cluster API Configuration Server
Demonstrates how to interact with the server with comprehensive change testing
"""

import requests
import json
import sys
import time

def test_server(base_url="http://localhost:8080"):
    """Test the Cluster API Configuration Server"""
    
    print("🧪 Testing Cluster API Configuration Server")
    print("=" * 50)
    
    # Test 1: Basic configuration creation
    print("\n1. Testing POST /configure - Basic configuration creation")
    try:
        config_data = {
            "region": "ewr",
            "clusterName": "test-cluster",
            "controlPlaneHighAvailability": True,
            "workerGroups": {
                "system-workloads": {
                    "count": 2,
                    "planId": "vc2-2c-4gb",
                    "taintEffect": "NoExecute"
                },
                "app-workloads": {
                    "count": 3,
                    "planId": "vc2-4c-8gb"
                }
            }
        }
        response = requests.post(
            f"{base_url}/configure",
            json=config_data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        print("Request:")
        print(json.dumps(config_data, indent=2))
        print("Response:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 2: Preview configuration changes
    print("\n2. Testing POST /preview - Preview configuration changes")
    try:
        config_data = {
            "region": "ams",  # Changed from ewr to ams
            "clusterName": "test-cluster",
            "controlPlaneHighAvailability": False,  # Changed from True to False
            "workerGroups": {
                "system-workloads": {
                    "count": 4,  # Changed from 2 to 4
                    "planId": "vc2-4c-8gb",  # Changed from vc2-2c-4gb to vc2-4c-8gb
                    "taintEffect": "NoExecute"
                },
                "app-workloads": {
                    "count": 3,
                    "planId": "vc2-4c-8gb"
                },
                "monitoring-workloads": {  # Added new group
                    "count": 1,
                    "planId": "vc2-2c-2gb"
                }
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=config_data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        print("Request:")
        print(json.dumps(config_data, indent=2))
        print("Response:")
        print(json.dumps(response.json(), indent=2))
        
        # Verify preview response structure
        if response.status_code == 200:
            preview_data = response.json()
            if "message" in preview_data and "preview" in preview_data["message"].lower():
                print("✅ Preview response contains preview message")
            else:
                print("❌ Preview response missing preview message")
                return False
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 3: Compare preview vs actual results
    print("\n3. Testing POST /configure vs POST /preview - Compare results")
    try:
        # First, preview the changes
        preview_response = requests.post(
            f"{base_url}/preview",
            json=config_data,
            headers={'Content-Type': 'application/json'}
        )
        
        # Then, apply the changes
        configure_response = requests.post(
            f"{base_url}/configure",
            json=config_data,
            headers={'Content-Type': 'application/json'}
        )
        
        if preview_response.status_code == 200 and configure_response.status_code == 200:
            preview_data = preview_response.json()
            configure_data = configure_response.json()
            
            # Compare the changes section
            preview_changes = preview_data.get("changes", {})
            configure_changes = configure_data.get("changes", {})
            
            if preview_changes == configure_changes:
                print("✅ Preview and configure changes match")
            else:
                print("❌ Preview and configure changes don't match")
                print("Preview changes:", json.dumps(preview_changes, indent=2))
                print("Configure changes:", json.dumps(configure_changes, indent=2))
                return False
        else:
            print(f"❌ Request failed - Preview: {preview_response.status_code}, Configure: {configure_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 4: Preview with no changes
    print("\n4. Testing POST /preview - No changes")
    try:
        # Use the same config that was just applied
        response = requests.post(
            f"{base_url}/preview",
            json=config_data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            preview_data = response.json()
            changes_detected = preview_data.get("changes_detected", True)
            if not changes_detected:
                print("✅ Correctly detected no changes")
            else:
                print("❌ Incorrectly detected changes when there should be none")
                return False
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 5: Preview validation errors
    print("\n5. Testing POST /preview - Validation errors")
    try:
        # Test missing clusterName
        invalid_config = {
            "region": "ewr",
            "workerGroups": {
                "system-workloads": {
                    "count": 2,
                    "planId": "vc2-2c-4gb",
                    "taintEffect": "NoExecute"
                }
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=invalid_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid configuration in preview")
        else:
            print(f"❌ Should have rejected invalid configuration, got status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Test 6: Preview worker group count validation
    print("\n6. Testing POST /preview - Worker group count validation")
    try:
        invalid_config = {
            "region": "ewr",
            "clusterName": "test-validation",
            "workerGroups": {
                "system-workloads": {
                    "count": 0,  # Invalid count
                    "planId": "vc2-2c-4gb",
                    "taintEffect": "NoExecute"
                }
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=invalid_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid worker group count in preview")
        else:
            print(f"❌ Should have rejected invalid worker group count, got status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Test 7: Preview with worker group modifications
    print("\n7. Testing POST /preview - Worker group modifications")
    try:
        modified_config = {
            "region": "ams",
            "clusterName": "test-cluster",
            "controlPlaneHighAvailability": False,
            "workerGroups": {
                "system-workloads": {
                    "count": 2,  # Changed back from 4 to 2
                    "planId": "vc2-2c-4gb",  # Changed back from vc2-4c-8gb to vc2-2c-4gb
                    "taintEffect": "NoExecute"
                },
                "app-workloads": {
                    "count": 3,
                    "planId": "vc2-4c-8gb"
                }
                # Removed monitoring-workloads
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=modified_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            preview_data = response.json()
            changes = preview_data.get("changes", {})
            
            # Check if modifications and deletions are detected
            modified_groups = changes.get("worker_groups_modified", [])
            deleted_groups = changes.get("worker_groups_deleted", [])
            
            if modified_groups and deleted_groups:
                print("✅ Correctly detected worker group modifications and deletions")
            else:
                print("❌ Failed to detect expected changes")
                print("Modified groups:", modified_groups)
                print("Deleted groups:", deleted_groups)
                return False
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Test 8: Preview with region and control plane HA changes
    print("\n8. Testing POST /preview - Region and control plane HA changes")
    try:
        region_ha_config = {
            "region": "ewr",  # Changed from ams to ewr
            "clusterName": "test-cluster",
            "controlPlaneHighAvailability": True,  # Changed from False to True
            "workerGroups": {
                "system-workloads": {
                    "count": 2,
                    "planId": "vc2-2c-4gb",
                    "taintEffect": "NoExecute"
                },
                "app-workloads": {
                    "count": 3,
                    "planId": "vc2-4c-8gb"
                }
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=region_ha_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            preview_data = response.json()
            changes = preview_data.get("changes", {})
            
            # Check if region and control plane HA changes are detected
            region_changes = changes.get("region")
            ha_changes = changes.get("control_plane_high_availability")
            
            if region_changes and ha_changes:
                previous_region = region_changes.get("previous")
                previous_ha = ha_changes.get("previous")
                
                if previous_region == "ams" and previous_ha == False:
                    print("✅ Correctly detected region and control plane HA changes")
                else:
                    print("❌ Failed to detect expected region/HA changes")
                    print("Previous region:", previous_region)
                    print("Previous HA:", previous_ha)
                    return False
            else:
                print("❌ Region or HA changes not found in response")
                print("Region changes:", region_changes)
                print("HA changes:", ha_changes)
                return False
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Test 9: Preview with new cluster (no existing config)
    print("\n9. Testing POST /preview - New cluster")
    try:
        new_cluster_config = {
            "region": "lhr",
            "clusterName": "new-cluster-preview",
            "controlPlaneHighAvailability": True,
            "workerGroups": {
                "system-workloads": {
                    "count": 1,
                    "planId": "vc2-1c-1gb",
                    "taintEffect": "NoExecute"
                }
            }
        }
        response = requests.post(
            f"{base_url}/preview",
            json=new_cluster_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            preview_data = response.json()
            changes = preview_data.get("changes", {})
            added_groups = changes.get("worker_groups_added", [])
            
            if len(added_groups) == 1 and added_groups[0]["name"] == "system-workloads":
                print("✅ Correctly detected new cluster with added worker groups")
            else:
                print("❌ Failed to detect new cluster properly")
                print("Added groups:", added_groups)
                return False
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Test 10: Preview with JSON parsing error
    print("\n10. Testing POST /preview - JSON parsing error")
    try:
        response = requests.post(
            f"{base_url}/preview",
            data="invalid json",
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly rejected invalid JSON in preview")
        else:
            print(f"❌ Should have rejected invalid JSON, got status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    # Test 11: Same configuration - no modifications
    print("\n11. Testing POST /preview and POST /configure - Same configuration (no modifications)")
    try:
        # Create a simple configuration
        same_config = {
            "region": "ewr",
            "clusterName": "same-config-test",
            "controlPlaneHighAvailability": True,
            "workerGroups": {
                "system-workloads": {
                    "count": 2,
                    "planId": "vc2-2c-4gb",
                    "taintEffect": "NoExecute"
                }
            }
        }
        
        # First, apply the configuration
        print("Applying initial configuration...")
        configure_response = requests.post(
            f"{base_url}/configure",
            json=same_config,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Configure Status: {configure_response.status_code}")
        
        if configure_response.status_code == 200:
            configure_data = configure_response.json()
            print(f"Initial changes detected: {configure_data.get('changes_detected', False)}")
            
            # Now preview the same configuration
            print("Previewing same configuration...")
            preview_response = requests.post(
                f"{base_url}/preview",
                json=same_config,
                headers={'Content-Type': 'application/json'}
            )
            print(f"Preview Status: {preview_response.status_code}")
            
            if preview_response.status_code == 200:
                preview_data = preview_response.json()
                changes_detected = preview_data.get("changes_detected", True)
                
                if not changes_detected:
                    print("✅ Correctly detected no changes in preview")
                    
                    # Verify the changes structure is empty
                    changes = preview_data.get("changes", {})
                    added = changes.get("worker_groups_added", [])
                    modified = changes.get("worker_groups_modified", [])
                    deleted = changes.get("worker_groups_deleted", [])
                    
                    if not added and not modified and not deleted:
                        print("✅ Changes structure is empty (no modifications)")
                    else:
                        print("❌ Changes structure should be empty")
                        print(f"Added: {added}")
                        print(f"Modified: {modified}")
                        print(f"Deleted: {deleted}")
                        return False
                else:
                    print("❌ Incorrectly detected changes when there should be none")
                    return False
            else:
                print(f"❌ Preview request failed with status {preview_response.status_code}")
                return False
        else:
            print(f"❌ Initial configure request failed with status {configure_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    print("\n✅ All preview tests passed!")
    return True

def main():
    """Main function"""
    if len(sys.argv) > 1:
        base_url = sys.argv[1]
    else:
        base_url = "http://localhost:8080"
    
    print(f"Testing server at: {base_url}")
    print("Make sure the server is running before executing this test.")
    print("You can start it with: python server.py")
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