import type { DfxCanisterConfig } from '../types';
import chalk from 'chalk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CoreMetadata, PocketIcCoreService } from '../services/pocketIcCoreService';
import { execSync, spawnSync } from 'child_process';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

/**
 * Returns init args did
 * Searches for: `service : (<TypeOrEmpty>) -> { ... }`
 */
function inferInitTypeFromDid(didPath: string): string {
  const src = fs.readFileSync(didPath, 'utf8');
  // Remove comments `// ...` and `/* ... */` for simplicity
  const noLineComments = src.replace(/\/\/.*$/gm, '');
  const noBlockComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = noBlockComments.match(/service\s*:\s*\(\s*([^)]*)\s*\)\s*->/);
  if (!m) {
    throw new Error(
      `Unable to infer init type from DID '${didPath}': no 'service : (...) ->' signature found.`
    );
  }
  // Could be empty if it has no arguments
  return m[1].trim(); // i.e.: 'Governance' or 'opt InitArg' or ''
}

/**
 * Replaces placeholders like {{canisterId:some_name}} with actual canister IDs.
 * @param argsString The raw init_args string from dfx.json.
 * @param deployedCanisterIds A map of canister names to their deployed IDs.
 * @returns The resolved arguments string.
 */
function resolvePlaceholders({
  argsString,
  deployedCanisterIds,
  userPrincipal,
}: {
  argsString: string;
  deployedCanisterIds: Record<string, string>;
  userPrincipal: string;
}): string {
  let resolved = argsString.replace(/{{canisterId:(\w+)}}/g, (match, canisterName) => {
    const canisterId = deployedCanisterIds[canisterName];
    if (!canisterId) {
      throw new Error(
        `Failed to resolve placeholder: Canister ID for '${canisterName}' not found.`
      );
    }
    console.log(chalk.gray(`    - Resolved placeholder for '${canisterName}' to '${canisterId}'`));
    return canisterId;
  });

  resolved = resolved.replace(/{{principal:(\w+)}}/g, (match, placeholderName) => {
    console.log(
      chalk.gray(
        `    - Resolved placeholder for principal '${placeholderName}' to '${userPrincipal}'`
      )
    );
    return userPrincipal;
  });

  return resolved;
}

export const deployCoreCanisterToPocketIC = async ({
  canisterName,
  wasmName,
  wasmPath,
  canisterConfig,
  coreCanisterData,
  deployedCanisterIds,
  dfxProjectRoot,
  userPrincipal,
}: {
  canisterName: string;
  wasmName: string;
  wasmPath: string;
  canisterConfig: DfxCanisterConfig;
  coreCanisterData: CoreMetadata | undefined;
  deployedCanisterIds: Record<string, string>;
  dfxProjectRoot: string;
  userPrincipal: string;
}): Promise<string> => {
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

  let initArgB64: string | undefined = undefined;

  // Trying to read generated SNS init args
  const generatedArgPath = path.join(
    dfxProjectRoot,
    'canisters',
    'sns',
    'args_generated',
    `${canisterName}.arg.bin`
  );

  if (fs.existsSync(generatedArgPath)) {
    console.log(chalk.blue(` - Using pre-generated init args from: ${generatedArgPath}`));
    const rawArgBuffer = fs.readFileSync(generatedArgPath);
    initArgB64 = rawArgBuffer.toString('base64');
    console.log(
      chalk.gray(`Encoded init arg: ${rawArgBuffer.length} bytes -> ${initArgB64.length} b64 chars`)
    );
  } else {
    // Fallback to the old logic for non-SNS canisters (or if generation failed)
    let rawArgsString: string | undefined = undefined;
    if (canisterConfig.init_args) {
      rawArgsString = canisterConfig.init_args;
      if (canisterConfig.init_args_file) {
        console.log(
          chalk.yellow(
            `  - Warning: Both 'init_args' and 'init_args_file' are specified for canister '${canisterName}'. Using 'init_args'.`
          )
        );
      }
    } else if (canisterConfig.init_args_file) {
      const argsFilePath = path.join(dfxProjectRoot, canisterConfig.init_args_file);
      try {
        console.log(chalk.blue(` - Reading init args from file: ${argsFilePath}`));
        rawArgsString = fs.readFileSync(argsFilePath, 'utf-8');
      } catch (e) {
        throw new Error(`Failed to read init_args_file '${argsFilePath}': ${(e as Error).message}`);
      }
    }

    if (typeof rawArgsString === 'string' && rawArgsString.trim().length > 0) {
      console.log(chalk.blue(` - Encoding initialization arguments for ${canisterName}...`));
      try {
        const resolvedArgs = resolvePlaceholders({
          argsString: rawArgsString,
          deployedCanisterIds,
          userPrincipal,
        });

        console.log(chalk.gray(`Resolved init args for ${canisterName}:`));
        console.log(resolvedArgs);

        execSync('didc --version', { stdio: 'ignore' });

        if (!canisterConfig.candid) {
          throw new Error(`Candid path is missing in canister config for '${canisterName}'.`);
        }

        const candidPath = path.join(dfxProjectRoot, canisterConfig.candid);
        const initType = inferInitTypeFromDid(candidPath);

        const argsText = resolvedArgs.trim().startsWith('(')
          ? resolvedArgs.trim()
          : `(${resolvedArgs.trim()})`;

        const typeSpec = `(${initType || ''})`;
        const didcResult = spawnSync('didc', [
          'encode',
          '--format',
          'hex',
          '-d',
          candidPath,
          '-t',
          typeSpec,
          argsText,
        ]);

        if (didcResult.status !== 0) {
          throw new Error(
            `didc failed with status ${didcResult.status}:\n${didcResult.stderr.toString()}`
          );
        }

        const hexString = didcResult.stdout.toString().trim();
        const raw: Buffer = Buffer.from(hexString, 'hex');
        initArgB64 = raw.toString('base64');

        console.log(
          chalk.gray(`Encoded init arg: ${raw.length} bytes -> ${initArgB64.length} b64 chars`)
        );
      } catch (e) {
        console.error(
          chalk.red('Failed to encode arguments with didc. Is didc installed and in your PATH?')
        );
        throw e;
      }
    }
  }

  const pocketICService = PocketIcCoreService.getInstance();

  const result = await pocketICService.uploadWasm({
    wasmPath,
    wasmSha256,
    canisterName,
    initArgB64,
  });
  console.log('Upload result:', result);

  if (!result.data.canisterIds || result.data.canisterIds.length === 0) {
    throw new Error(`Canister ID not returned from server for ${canisterName}`);
  }

  return result.data.canisterIds[0];
};
