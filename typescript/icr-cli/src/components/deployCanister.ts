import chalk from 'chalk';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { CoreMetadata, PocketIcCoreService } from '../services/pocketIcCoreService';

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

//TODO: force reinstall if runned with option
export const deployCoreCanisterToPocketIC = async (
  canisterName: string,
  wasmName: string,
  wasmPath: string,
  coreCanisterData: CoreMetadata | undefined
): Promise<void> => {
  const hash = crypto.createHash('sha256');
  //Calculate sha256 hash of canister wasm file
  const wasmSha256 = await new Promise<string>((resolve, reject) => {
    const stream = fs.createReadStream(wasmPath, { highWaterMark: CHUNK_SIZE });
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });

  if (coreCanisterData) {
    if (coreCanisterData.corrupted) {
      console.log(
        chalk.yellow(` - ${canisterName} is corrupted. Reinstalling ${canisterName} canister...`)
      );
    } else if (coreCanisterData.wasmHash === wasmSha256) {
      console.log(chalk.green(` - ${canisterName} is already installed. Skipping...`));
      return;
    } else {
      console.log(
        chalk.white(
          ` - ${canisterName} is already installed with an another version. Updating ${canisterName} canister...`
        )
      );
    }
  } else {
    console.log(chalk.white(` - Deploying ${canisterName} canister '${wasmName}'...`));
  }

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`Wasm file not found at path: ${wasmPath}`);
  }

  const pocketICService = PocketIcCoreService.getInstance();

  //Upload wasm file to pocket ic core server
  const result = await pocketICService.uploadWasm(wasmPath, wasmSha256, canisterName);
  console.log('Upload result:', result);
};
