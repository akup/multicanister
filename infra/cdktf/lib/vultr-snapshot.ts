import { defaultConfig } from "../config";
import { HttpClient } from "./http-client";

export interface VultrSnapshot {
  id: string;
  date_created: string;
  date_expires: string;
  description: string;
  size: number;
  compressed_size: number;
  status: string;
  os_id: number;
  app_id: number;
}

export interface VultrSnapshotsResponse {
  snapshots: VultrSnapshot[];
  meta: {
    total: number;
    links: {
      next: string;
      prev: string;
    };
  };
}

export class VultrSnapshotService {
  private static readonly API_BASE_URL = "https://api.vultr.com/v2";
  static readonly CLUSTER_API_PATTERN = new RegExp(`^Cluster API Kubernetes ${defaultConfig.kubernetesVersion}.*?on Debian.*`);

  /**
   * Fetches snapshots from Vultr API and returns the first snapshot ID
   * that matches the Cluster API Kubernetes description pattern
   */
  static async getClusterApiSnapshotId(apiKey: string): Promise<string | null> {
    try {
      const response = await HttpClient.get(`${this.API_BASE_URL}/snapshots`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
      }

      const data = response.data as VultrSnapshotsResponse;
      
      if (!data.snapshots || !Array.isArray(data.snapshots)) {
        throw new Error('Invalid response format: snapshots array not found');
      }

      // Find the first snapshot that matches the Cluster API Kubernetes pattern
      const clusterSnapshot = data.snapshots.find(snapshot => 
        this.CLUSTER_API_PATTERN.test(snapshot.description)
      );

      if (!clusterSnapshot) {
        console.warn('No Cluster API Kubernetes snapshot found');
        return null;
      }

      console.log(`Found Cluster API Kubernetes snapshot: ${clusterSnapshot.description} (ID: ${clusterSnapshot.id})`);
      return clusterSnapshot.id;

    } catch (error) {
      console.error('Error fetching Vultr snapshots:', error);
      throw error;
    }
  }

  /**
   * Fetches all snapshots and returns detailed information about Cluster API snapshots
   */
  static async getClusterApiSnapshots(apiKey: string): Promise<VultrSnapshot[]> {
    try {
      const response = await HttpClient.get(`${this.API_BASE_URL}/snapshots`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
      }

      const data = response.data as VultrSnapshotsResponse;
      
      if (!data.snapshots || !Array.isArray(data.snapshots)) {
        throw new Error('Invalid response format: snapshots array not found');
      }

      // Filter snapshots that match the Cluster API Kubernetes pattern
      const clusterSnapshots = data.snapshots.filter(snapshot => 
        this.CLUSTER_API_PATTERN.test(snapshot.description)
      );

      return clusterSnapshots;

    } catch (error) {
      console.error('Error fetching Vultr snapshots:', error);
      throw error;
    }
  }

  /**
   * Gets snapshot information by ID
   */
  static async getSnapshotById(apiKey: string, snapshotId: string): Promise<VultrSnapshot | null> {
    try {
      const response = await HttpClient.get(`${this.API_BASE_URL}/snapshots`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch snapshots: ${response.status} ${response.statusText}`);
      }

      const data = response.data as VultrSnapshotsResponse;
      
      if (!data.snapshots || !Array.isArray(data.snapshots)) {
        throw new Error('Invalid response format: snapshots array not found');
      }

      // Find the specific snapshot by ID
      const snapshot = data.snapshots.find(s => s.id === snapshotId);
      
      return snapshot || null;

    } catch (error) {
      console.error(`Error fetching snapshot ${snapshotId}:`, error);
      throw error;
    }
  }
} 