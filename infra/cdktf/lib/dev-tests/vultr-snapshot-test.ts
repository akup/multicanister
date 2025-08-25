import { VultrSnapshotService } from "../vultr-snapshot";

const vultrApiKey = "MT2PCQOJOMBBBA4QPNJVVI7PBBM6GEIUGKTA";

async function testVultrSnapshotService() {
  try {
    console.log("Testing VultrSnapshotService...\n");

    // Test 1: Get the first Cluster API Kubernetes snapshot ID
    console.log("1. Getting first Cluster API Kubernetes snapshot ID:");
    const snapshotId = await VultrSnapshotService.getClusterApiSnapshotId(vultrApiKey);
    console.log(`Result: ${snapshotId}\n`);

    // Test 2: Get all Cluster API snapshots with details
    console.log("2. Getting all Cluster API Kubernetes snapshots:");
    const clusterSnapshots = await VultrSnapshotService.getClusterApiSnapshots(vultrApiKey);
    console.log(`Found ${clusterSnapshots.length} Cluster API snapshots:`);
    clusterSnapshots.forEach((snapshot, index) => {
      console.log(`  ${index + 1}. ${snapshot.description}`);
      console.log(`     ID: ${snapshot.id}`);
      console.log(`     Status: ${snapshot.status}`);
      console.log(`     Size: ${(snapshot.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
      console.log(`     Created: ${snapshot.date_created}`);
      console.log("");
    });

    // Test 3: Get specific snapshot by ID (if we found one)
    if (snapshotId) {
      console.log("3. Getting specific snapshot details:");
      const snapshotDetails = await VultrSnapshotService.getSnapshotById(vultrApiKey, snapshotId);
      if (snapshotDetails) {
        console.log(`Snapshot details for ${snapshotId}:`);
        console.log(`  Description: ${snapshotDetails.description}`);
        console.log(`  Status: ${snapshotDetails.status}`);
        console.log(`  Size: ${(snapshotDetails.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  Compressed: ${(snapshotDetails.compressed_size / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  OS ID: ${snapshotDetails.os_id}`);
        console.log(`  Created: ${snapshotDetails.date_created}`);
        console.log(`  Expires: ${snapshotDetails.date_expires}`);
      } else {
        console.log(`Snapshot ${snapshotId} not found`);
      }
    }

  } catch (error) {
    console.error("Error testing VultrSnapshotService:", error);
  }
}

// Run the test
testVultrSnapshotService(); 