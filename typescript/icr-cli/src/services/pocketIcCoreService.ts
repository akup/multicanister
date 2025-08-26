import * as fs from 'fs';
import { URL } from 'url';
import fetch, { RequestInit } from 'node-fetch';
import { FormData, File } from 'undici';

export interface CoreMetadata {
  canisterIds: string[];
  wasmHash: string;
  branch: string;
  tag: string;
  commit: string;
  corrupted: boolean;
}

export type ListCoresResponse = Record<string, CoreMetadata>;

export interface UploadResponse {
  message: string;
  data: CoreMetadata;
}

export class PocketIcCoreService {
  private static picCoreUrl: URL | null = null;
  private static instance: PocketIcCoreService | null = null;

  private constructor() {}

  public static setPicCoreUrl(picCoreUrl: URL): void {
    PocketIcCoreService.picCoreUrl = picCoreUrl;
  }

  public static getInstance(): PocketIcCoreService {
    if (!PocketIcCoreService.instance) {
      if (!PocketIcCoreService.picCoreUrl) {
        throw new Error('PocketIC Core URL is not set');
      }
      PocketIcCoreService.instance = new PocketIcCoreService();
    }
    return PocketIcCoreService.instance;
  }

  async uploadWasm(
    wasmPath: string,
    wasmSha256: string,
    canisterName: string
  ): Promise<UploadResponse> {
    const formData = new FormData();
    const fileBuffer = await fs.promises.readFile(wasmPath);
    const file = new File([fileBuffer], 'wasm');
    formData.append('file', file);
    formData.append('sha256', wasmSha256);
    formData.append('name', canisterName);

    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/upload`, {
      method: 'POST',
      body: formData as unknown as RequestInit['body'],
    });

    if (!response.ok) {
      const json = await response.json();

      // Check for various error message formats
      let errorMessage = 'Unknown error';

      if (json && typeof json === 'object') {
        if ('error' in json && json.error) {
          console.error(json.error);
        }
        if ('message' in json && json.message) {
          errorMessage = String(json.message);
        } else {
          console.log('Full error response:', JSON.stringify(json, null, 2));
        }
      } else if (typeof json === 'string') {
        errorMessage = json;
      } else {
        console.log('Full error response:', JSON.stringify(json, null, 2));
      }

      throw new Error(`Failed to upload canister ${canisterName} with wasm file: ${errorMessage}`);
    }

    return (await response.json()) as UploadResponse;
  }

  async listCores(): Promise<ListCoresResponse> {
    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/list-core`);

    if (!response.ok) {
      const json = await response.json();

      // Check for various error message formats
      let errorMessage = 'Unknown error';

      if (json && typeof json === 'object') {
        if ('error' in json && json.error) {
          errorMessage = String(json.error);
        } else if ('message' in json && json.message) {
          errorMessage = String(json.message);
        } else if ('detail' in json && json.detail) {
          errorMessage = String(json.detail);
        } else {
          console.log('Full error response:', JSON.stringify(json, null, 2));
        }
      } else if (typeof json === 'string') {
        errorMessage = json;
      } else {
        console.log('Full error response:', JSON.stringify(json, null, 2));
      }

      throw new Error(`Failed to list cores: ${errorMessage}`);
    }

    return (await response.json()) as ListCoresResponse;
  }

  async checkCanisterHash(
    canisterName: string,
    wasmSha256: string
  ): Promise<'valid_hash' | 'invalid_hash' | 'not_found'> {
    const cores = await this.listCores();
    const core = cores[canisterName];

    if (!core) {
      return 'not_found';
    }

    if (core.wasmHash === wasmSha256) {
      return 'valid_hash';
    }

    return 'invalid_hash';
  }
}
