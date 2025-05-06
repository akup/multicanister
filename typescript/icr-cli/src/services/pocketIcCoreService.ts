import { FormData, File } from 'undici';
import * as fs from 'fs';

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

  public static setPicCoreUrl(picCoreUrl: URL) {
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

    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const json = (await response.json()) as { message: string };
      throw new Error(`Failed to upload wasm file: ${json.message}`);
    }

    return (await response.json()) as UploadResponse;
  }

  async listCores(): Promise<ListCoresResponse> {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(`${PocketIcCoreService.picCoreUrl!.origin}/api/list-core`);

    if (!response.ok) {
      const json = (await response.json()) as { message: string };
      throw new Error(`Failed to list cores: ${json.message}`);
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
