import * as fs from 'fs';
import chalk from 'chalk';
import { defaultConfig } from '../configs';

export class CoreInfo {
  factory: string = '';
  ii?: string;
  candid_ui?: string;
  //TODO: add sns canisters
  modules: Array<string> = [];
}

export function readCoreFile(coreFilePath: string = defaultConfig.coreFile): CoreInfo | null {
  if (fs.existsSync(coreFilePath)) {
    try {
      let coreInfo = new CoreInfo();
      const coreJson = JSON.parse(fs.readFileSync(coreFilePath).toString());
      const coreInfoKeys = Object.keys(coreInfo);
      coreInfoKeys.forEach(key => {
        if (key !== 'modules') {
          let fieldCheck = coreInfo[key as keyof CoreInfo];
          let required = false;
          if (typeof fieldCheck === 'string') {
            //required field
            required = true;
          }

          let field = coreJson[key];
          if (field) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof field === 'string') coreInfo[key as keyof CoreInfo] = field as any;
            else {
              console.error(chalk.red(`Invalid '${key}' field at ${coreFilePath}`));
              return null;
            }
          } else if (required) {
            console.error(
              chalk.red(`'${key}' field is required and not present in ${coreFilePath}`)
            );
            return null;
          }
        }
      });

      //TODO: error on missing any of launcher, ii, fabric

      //TODO: read modules

      return coreInfo;
    } catch {
      console.error(chalk.red(`Invalid content at ${coreFilePath}`));
      return null;
    }
  }
  console.error(chalk.red(`${coreFilePath} doesn't exist`));
  return null;
}
