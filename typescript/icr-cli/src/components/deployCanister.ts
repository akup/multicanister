import type { DfxCanisterConfig } from '../types';
import chalk from 'chalk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { CoreMetadata, PocketIcCoreService } from '../services/pocketIcCoreService';
import { execSync } from 'child_process';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

/**
 * Replaces placeholders like {{canisterId:some_name}} with actual canister IDs.
 * @param argsString The raw init_args string from dfx.json.
 * @param deployedCanisterIds A map of canister names to their deployed IDs.
 * @returns The resolved arguments string.
 */
function resolvePlaceholders(
  argsString: string,
  deployedCanisterIds: Record<string, string>
): string {
  return argsString.replace(/{{canisterId:(\w+)}}/g, (match, canisterName) => {
    const canisterId = deployedCanisterIds[canisterName];
    if (!canisterId) {
      throw new Error(
        `Failed to resolve placeholder: Canister ID for '${canisterName}' not found.`
      );
    }
    console.log(chalk.gray(`    - Resolved placeholder for '${canisterName}' to '${canisterId}'`));
    return canisterId;
  });
}

export const deployCoreCanisterToPocketIC = async (
  canisterName: string,
  wasmName: string,
  wasmPath: string,
  canisterConfig: DfxCanisterConfig,
  coreCanisterData: CoreMetadata | undefined,
  deployedCanisterIds: Record<string, string>
): Promise<string> => {
  const hash = crypto.createHash('sha256');
  const wasmSha256 = await new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(wasmPath, { highWaterMark: CHUNK_SIZE });
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });

  if (coreCanisterData) {
    if (coreCanisterData.corrupted) {
      console.log(chalk.yellow(` - ${canisterName} is corrupted. Reinstalling...`));
    } else if (coreCanisterData.wasmHash === wasmSha256) {
      console.log(chalk.green(` - ${canisterName} is already installed. Skipping...`));
      return coreCanisterData.canisterIds[0];
    } else {
      console.log(chalk.white(` - Updating ${canisterName} to a new version...`));
    }
  } else {
    console.log(chalk.white(` - Deploying ${canisterName} canister '${wasmName}'...`));
  }

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`Wasm file not found at path: ${wasmPath}`);
  }

  let initArgHex: string | undefined = undefined;
  if (typeof canisterConfig.init_args === 'string' && canisterConfig.init_args.length > 0) {
    console.log(chalk.blue(` - Encoding initialization arguments for ${canisterName}...`));
    try {
      const resolvedArgs = resolvePlaceholders(canisterConfig.init_args, deployedCanisterIds);
      execSync('didc --version', { stdio: 'ignore' });
      initArgHex = execSync(`didc encode '${resolvedArgs}'`, { encoding: 'utf-8' }).trim();
    } catch (e) {
      console.error(
        chalk.red('Failed to encode arguments with didc. Is didc installed and in your PATH?')
      );
      throw e;
    }
  }

  const pocketICService = PocketIcCoreService.getInstance();

  const result = await pocketICService.uploadWasm(wasmPath, wasmSha256, canisterName, initArgHex);
  console.log('Upload result:', result);

  if (!result.data.canisterIds || result.data.canisterIds.length === 0) {
    throw new Error(`Canister ID not returned from server for ${canisterName}`);
  }

  return result.data.canisterIds[0];
};
