import * as fs from 'fs';
import chalk from 'chalk';
import { defaultConfig } from '../configs';

export class AppsInfo {
  apps: Record<string, AppData> = {};
}

export class AppData {
  canisterServices: Array<CanisterService> = [];
  offchainServices: Array<string> = [];
  init: Record<string, Array<string>> = {};
}

export class CanisterService {
  dfxName: string = '';
  serviceId: string = '';
}

export function readAppsFile(appsFilePath: string = defaultConfig.appsFile): AppsInfo | null {
  if (fs.existsSync(appsFilePath)) {
    try {
      let appsInfo = new AppsInfo();
      const appsJson = JSON.parse(fs.readFileSync(appsFilePath).toString());

      // Validate that appsJson has an "apps" object
      if (!appsJson.apps || typeof appsJson.apps !== 'object') {
        console.error(
          chalk.red(`'apps' field is required and must be an object in ${appsFilePath}`)
        );
        return null;
      }

      for (const [appName, appDataJson] of Object.entries(appsJson.apps)) {
        // Validate appDataJson is an object
        if (typeof appDataJson !== 'object' || appDataJson === null) {
          console.error(chalk.red(`App '${appName}' must be an object in ${appsFilePath}`));
          return null;
        }

        const appData = new AppData();

        // canisterServices
        if ('canisterServices' in appDataJson) {
          if (!Array.isArray(appDataJson.canisterServices)) {
            console.error(
              chalk.red(
                `'canisterServices' for app '${appName}' must be an array in ${appsFilePath}`
              )
            );
            return null;
          }
          for (const cs of appDataJson.canisterServices) {
            if (typeof cs !== 'object' || cs === null) {
              console.error(
                chalk.red(
                  `Each canisterService for app '${appName}' must be an object in ${appsFilePath}`
                )
              );
              return null;
            }
            const canisterService = new CanisterService();
            if (typeof cs.dfxName !== 'string' || typeof cs.serviceId !== 'string') {
              console.error(
                chalk.red(
                  `Each canisterService for app '${appName}' must have 'dfxName' and 'serviceId' as strings in ${appsFilePath}`
                )
              );
              return null;
            }
            canisterService.dfxName = cs.dfxName;
            canisterService.serviceId = cs.serviceId;
            appData.canisterServices.push(canisterService);
          }
        }

        // offchainServices
        if ('offchainServices' in appDataJson) {
          if (!Array.isArray(appDataJson.offchainServices)) {
            console.error(
              chalk.red(
                `'offchainServices' for app '${appName}' must be an array in ${appsFilePath}`
              )
            );
            return null;
          }
          for (const svc of appDataJson.offchainServices) {
            if (typeof svc !== 'string') {
              console.error(
                chalk.red(
                  `Each offchainService for app '${appName}' must be a string in ${appsFilePath}`
                )
              );
              return null;
            }
            appData.offchainServices.push(svc);
          }
        }

        // init
        if ('init' in appDataJson) {
          if (
            typeof appDataJson.init !== 'object' ||
            appDataJson.init === null ||
            Array.isArray(appDataJson.init)
          ) {
            console.error(
              chalk.red(`'init' for app '${appName}' must be an object in ${appsFilePath}`)
            );
            return null;
          }
          for (const [canisterName, initArr] of Object.entries(appDataJson.init)) {
            if (!Array.isArray(initArr)) {
              console.error(
                chalk.red(
                  `'init' for canister '${canisterName}' in app '${appName}' must be an array in ${appsFilePath}`
                )
              );
              return null;
            }
            for (const initPath of initArr) {
              if (typeof initPath !== 'string') {
                console.error(
                  chalk.red(
                    `Each init path for canister '${canisterName}' in app '${appName}' must be a string in ${appsFilePath}`
                  )
                );
                return null;
              }
            }
            appData.init[canisterName] = initArr as string[];
          }
        }

        appsInfo.apps[appName] = appData;
      }

      return appsInfo;
    } catch {
      console.error(chalk.red(`Invalid content at ${appsFilePath}`));
      return null;
    }
  }
  console.error(chalk.red(`${appsFilePath} doesn't exist`));
  return null;
}
