import * as fs from 'fs';
import chalk from 'chalk';

const DFX_JSON = 'dfx.json';

export class DfxProject {
  root: string = './';
  dfxJson: Record<string, any> = {};
  actors: Record<string, DfxProjectCanister> = {};
}

export interface DfxProjectCanister {
  build: string;
  candid?: string;
  optimize?: string;
  type: string;
  wasm: string;
  gzip?: boolean;
}

export function prepareDfx(): Record<string, [DfxProjectCanister, DfxProject]> | null {
  //Здесь мы подгатавливаем dfx.json, если его нужно смержить из нескольких.
  //И читаем подготовленный файл или же единственный файл в корне

  var dfxByActorName: Record<string, [DfxProjectCanister, DfxProject]> = {};

  // читаем dfx.json из базовой директории
  if (fs.existsSync(DFX_JSON)) {
    try {
      let dfxProject = new DfxProject();
      dfxProject.dfxJson = JSON.parse(fs.readFileSync(DFX_JSON).toString());
      dfxProject.actors = dfxProject.dfxJson['canisters'] as Record<string, DfxProjectCanister>;
      let deepness = dfxProject.root.split('/').length;
      for (const [canisterName, dfxCanister] of Object.entries(dfxProject.actors)) {
        let collectedDfx = dfxByActorName[canisterName];
        if (collectedDfx) {
          console.warn(
            chalk.yellow(
              `There are same canister name '${canisterName}' at dfx.json located at:\n  ${collectedDfx[1].root}\n  ${dfxProject.root}`
            )
          );
          if (collectedDfx[1].root.split('/').length < deepness) {
            //TODO: merge
            console.warn(chalk.yellow(`Used ${dfxProject.root}`));
            dfxByActorName[canisterName] = [dfxCanister, dfxProject];
          } else {
            console.warn(chalk.yellow(`Used ${collectedDfx[1].root}`));
          }
          console.log('\n');
        } else dfxByActorName[canisterName] = [dfxCanister, dfxProject];
      }
    } catch (e) {
      console.error(chalk.red(`dfx.json at folder ${process.cwd()} is invalid`));
      throw e;
    }
  } else {
    console.error(chalk.red(`dfx.json doesn't exist at folder ${process.cwd()}`));
    return null;
  }

  //TODO: sort by dependencies

  //TODO: подготавить dfx.json, если его нужно смержить из нескольких

  return dfxByActorName;
}
