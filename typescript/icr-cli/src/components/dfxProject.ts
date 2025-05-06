import * as fs from 'fs';
import chalk from 'chalk';
import * as path from 'path';

const DFX_JSON = 'dfx.json';

export class DfxProject {
  root: string = './';
  dfxJson: Record<string, any> = {};
  actors: Record<string, DfxProjectCanister> = {};
}

export type CanisterType = 'custom' | 'motoko' | 'rust' | 'assets';
export interface DfxProjectCanister {
  build: string | string[];
  candid?: string;
  optimize?: string;
  type: CanisterType;
  wasm: string;
  gzip?: boolean;
}

export function prepareDfx(): Record<string, [DfxProjectCanister, DfxProject]> | null {
  //Здесь мы собираем все dfx.json файлы из всех поддиректорий и составляем Record с именем canister и массивом из информации о канистре и dfx.json проекте.
  var dfxByActorName: Record<string, [DfxProjectCanister, DfxProject]> = {};

  // Recursively find all dfx.json files in subdirectories (excluding the root one)
  const dfxFiles: string[] = [];
  function findDfxFiles(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        // Skip node_modules and other non-project directories
        if (
          name.includes('node_modules') ||
          name.includes('target') ||
          name.includes('dist') ||
          name.includes('build') ||
          name.startsWith('.')
        ) {
          continue;
        }
        findDfxFiles(fullPath);
      } else if (stat.isFile() && name === DFX_JSON) {
        dfxFiles.push(fullPath);
      }
    }
  }
  findDfxFiles(process.cwd());

  // Sort discovered dfx.json files by their path length (shortest first)
  dfxFiles.sort((a, b) => a.length - b.length);

  // Parse each found dfx.json and populate dfxByActorName
  for (const filePath of dfxFiles) {
    try {
      const json = JSON.parse(fs.readFileSync(filePath).toString());
      const dfxProject = new DfxProject();
      // set the root to the directory containing this dfx.json
      dfxProject.root = filePath.slice(0, filePath.length - (DFX_JSON.length + 1)) + '/';
      dfxProject.dfxJson = json;
      dfxProject.actors = json['canisters'] as Record<string, DfxProjectCanister>;
      for (const [canisterName, dfxCanister] of Object.entries(dfxProject.actors)) {
        let collectedDfx = dfxByActorName[canisterName];
        if (collectedDfx) {
          console.warn(
            chalk.yellow(
              `There are same canister name '${canisterName}' at dfx.json located at:\n  ${collectedDfx[1].root}\n  ${dfxProject.root}`
            )
          );
        } else {
          if (dfxCanister.type === 'custom') {
            if (!dfxCanister.build) {
              const wasmUrl = new URL(dfxCanister.wasm);
              if (!wasmUrl.protocol) {
                console.log(
                  chalk.red(`Invalid wasm url '${dfxCanister.wasm}' at ${dfxProject.root}/dfx.json`)
                );
                throw new Error(
                  `Canister '${canisterName}' at ${dfxProject.root}/dfx.json is a custom canister but has no build command and wasm parameter is not url`
                );
              }
            }
          }
          dfxByActorName[canisterName] = [dfxCanister, dfxProject];
        }
      }
    } catch (e) {
      console.error(chalk.red(`Invalid ${DFX_JSON} at ${filePath}`));
      throw e;
    }
  }
  if (dfxFiles.length === 0) {
    console.error(chalk.red(`No ${DFX_JSON} found in innerDfxProjects directory`));
    return null;
  }

  return dfxByActorName;
}
