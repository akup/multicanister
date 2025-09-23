// src/types.ts
import { requiredCoreKeys, optionalCoreKeys } from './constants';

/**
 * ==================================================================
 * DFX CONFIGURATION TYPES (from dfx.json)
 * ==================================================================
 */

export type CanisterType = 'custom' | 'motoko' | 'rust' | 'assets';

// Describes the structure of a single canister's configuration within dfx.json
export interface DfxCanisterConfig {
  build: string | string[];
  candid?: string;
  optimize?: string;
  type: CanisterType;
  wasm: string;
  gzip?: boolean;
  init_args?: string;
  init_args_file?: string;
  // Allows for other properties like 'remote', 'frontend', etc.
  [key: string]: unknown;
}

// Describes the main structure of the dfx.json file
export interface DfxConfig {
  canisters: Record<string, DfxCanisterConfig>;
  // Add other top-level dfx.json properties if needed
}

/**
 * ==================================================================
 * CORE CONFIGURATION TYPES (from core.json)
 * ==================================================================
 */

type RequiredCorePart = {
  [K in (typeof requiredCoreKeys)[number]]: string;
};
type OptionalCorePart = {
  [K in (typeof optionalCoreKeys)[number]]?: string;
};

// Describes the structure of the core.json file
export type CoreConfig = RequiredCorePart & OptionalCorePart;

/**
 * ==================================================================
 * APPS CONFIGURATION TYPES (from apps.json)
 * ==================================================================
 */

// Describes a single canister service within an app
export interface CanisterService {
  dfxName: string;
  serviceId: string;
}

// Describes the structure of a single app's data
export interface AppData {
  canisterServices: CanisterService[];
  offchainServices: string[];
  init: Record<string, string[]>;
}

// Describes the top-level structure of the apps.json file
export interface AppsConfig {
  apps: Record<string, AppData>;
}
