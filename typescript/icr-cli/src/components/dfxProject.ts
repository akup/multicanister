import type { DfxConfig, DfxCanisterConfig } from '../types';

import * as fs from 'fs';
import chalk from 'chalk';
import * as path from 'path';
import { defaultConfig } from '../configs';

export type DfxProjectCanister = DfxCanisterConfig;

export class DfxProject {
  root: string = './';
  dfxJson: DfxConfig;
  actors: Record<string, DfxCanisterConfig> = {};

  constructor(dfxJson: DfxConfig) {
    this.dfxJson = dfxJson;
  }
}

export function prepareDfx(): Record<string, [DfxCanisterConfig, DfxProject]> | null {
  //Здесь мы собираем все dfx.json файлы из всех поддиректорий и составляем Record с именем canister и массивом из информации о канистре и dfx.json проекте.
  const dfxByActorName: Record<string, [DfxCanisterConfig, DfxProject]> = {};

  // Recursively find all dfx.json files in subdirectories (excluding the root one)
  const dfxFiles: string[] = [];
  function findDfxFiles(dir: string): void {
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
      } else if (stat.isFile() && name === defaultConfig.dfxFile) {
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
      const json = JSON.parse(fs.readFileSync(filePath).toString()) as DfxConfig;
      const dfxProject = new DfxProject(json);
      // set the root to the directory containing this dfx.json
      dfxProject.root =
        filePath.slice(0, filePath.length - (defaultConfig.dfxFile.length + 1)) + '/';
      dfxProject.actors = json['canisters'] as Record<string, DfxCanisterConfig>;

      for (const [canisterName, dfxCanister] of Object.entries(dfxProject.actors)) {
        const collectedDfx = dfxByActorName[canisterName];
        if (collectedDfx) {
          console.warn(
            chalk.yellow(
              `There are same canister name '${canisterName}' at dfx.json located at:\n  ${collectedDfx[1].root}\n  ${dfxProject.root}`
            )
          );
        } else {
          // The faulty validation block that checked for a URL has been removed.
          // Now, custom canisters without a build command are accepted,
          // assuming their 'wasm' field points to a valid pre-compiled file (local or URL).
          dfxByActorName[canisterName] = [dfxCanister, dfxProject];
        }
      }
    } catch (e) {
      console.error(chalk.red(`Invalid ${defaultConfig.dfxFile} at ${filePath}`));
      throw e;
    }
  }
  if (dfxFiles.length === 0) {
    console.error(chalk.red(`No ${defaultConfig.dfxFile} found in innerDfxProjects directory`));
    return null;
  }

  return dfxByActorName;
}
