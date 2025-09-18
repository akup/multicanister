import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import fetch, { RequestInit } from 'node-fetch';
import FormData from 'form-data';
import pTimeout from 'p-timeout';

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

  async getCanisterIds(names: string[]): Promise<Record<string, string>> {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/get-canister-ids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get canister IDs: ${errorText}`);
    }
    return (await response.json()) as Record<string, string>;
  }

  async uploadWasm({
    wasmPath,
    wasmSha256,
    canisterName,
    initArgB64,
  }: {
    wasmPath: string;
    wasmSha256: string;
    canisterName: string;
    initArgB64?: string;
  }): Promise<UploadResponse> {
    // We are using 'form-data' package to upload the wasm file to the PocketIC Core.
    // This creates a deprecation warning in Node.js 20.
    // We are suppressing the warning for this function.
    // We need to use form-data instead of undici's FormData because the latter is not working in a linux binary.

    // Store original warning listeners
    const originalWarningListeners = process.listeners('warning');
    // Suppress deprecation warnings for this function
    process.removeAllListeners('warning');

    console.log('uploadWasm 0', wasmPath);
    try {
      console.log('uploadWasm 0.1', FormData);
      const formData = new FormData();
      console.log('uploadWasm 0.2. Try readFile');
      const fileBuffer = fs.readFileSync(wasmPath);
      console.log('uploadWasm 0.3. File buffer size:', fileBuffer.length);
      console.log('uploadWasm 0.4. Appending file to FormData');
      formData.append('file', fileBuffer, path.basename(wasmPath));
      formData.append('sha256', wasmSha256);
      formData.append('name', canisterName);

      if (initArgB64) {
        formData.append('initArgB64', initArgB64);
      }

      console.log('uploadWasm 1');
      const response = await pTimeout(
        fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/upload`, {
          method: 'POST',
          body: formData as unknown as RequestInit['body'],
        }),
        { milliseconds: 30000 } // 30 seconds
      );
      console.log('uploadWasm ok');

      if (!response.ok) {
        console.log('uploadWasm error');
        const json: any = await response.json();
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

        throw new Error(
          `Failed to upload canister ${canisterName} with wasm file: ${errorMessage}`
        );
      }

      console.log('uploadWasm ok');
      return (await response.json()) as UploadResponse;
    } catch (error) {
      console.error('Error uploading wasm:', error);
      throw error;
    } finally {
      // Restore original warning listeners
      originalWarningListeners.forEach(listener => {
        process.on('warning', listener);
      });
    }
  }

  async listCores(): Promise<ListCoresResponse> {
    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/list-core`);

    if (!response.ok) {
      const json = await response.json();
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
