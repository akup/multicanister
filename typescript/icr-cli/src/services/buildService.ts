import chalk from 'chalk';
import { AppsInfo } from '../components/appsInfo';
import { buildCanister } from '../components/buildCanister';
import { CoreInfo } from '../components/coreInfo';
import { DfxProject, DfxProjectCanister } from '../components/dfxProject';

export class BuildService {
  // Here we build the core: all canisters from core.json
  public static async buildCore(
    coreInfo: CoreInfo,
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>
  ): Promise<void> {
    console.log(chalk.whiteBright('Building core with dfx...'));
    if (!dfxProjectsByActorName[coreInfo.factory]) {
      throw new Error(`There is no required factory canister '${coreInfo.factory}' in dfx json`);
    }

    //Build core canisters
    for (const [key, value] of Object.entries(coreInfo)) {
      if (key === 'modules' || !value) {
        continue;
      }
      const [dfxCanister, dfxProject] = dfxProjectsByActorName[value];
      // Sequential build of canisters
      await buildCanister(value, dfxCanister, dfxProject.root, () => {
        console.log(chalk.white(` - Building ${key} core canister '${value}'...`));
      });
    }
  }

  // Here we build the apps: all canisters from apps.json
  public static async buildApps(
    appsInfo: AppsInfo,
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>
  ): Promise<void> {
    console.log(chalk.whiteBright('Building apps with dfx...'));
    //First we iterate over all apps and check if all canisters are in dfx json
    for (const appData of Object.values(appsInfo.apps)) {
      for (const canisterService of appData.canisterServices) {
        if (!dfxProjectsByActorName[canisterService.dfxName]) {
          throw new Error(`There is no required actor '${canisterService.dfxName}' in dfx json`);
        }
      }
    }

    //Go over all apps
    let builtActors: Record<string, boolean> = {};
    for (const [appName, appData] of Object.entries(appsInfo.apps)) {
      console.log(chalk.white(` - Building app '${appName}'...`));

      //Then we build all canisters from the app
      for (const canisterService of appData.canisterServices) {
        if (!builtActors[canisterService.dfxName]) {
          builtActors[canisterService.dfxName] = true;
          const [dfxCanister, dfxProject] = dfxProjectsByActorName[canisterService.dfxName];
          await buildCanister(canisterService.dfxName, dfxCanister, dfxProject.root, () => {
            console.log(
              chalk.white(
                ` - Building service '${canisterService.serviceId}' backed by canister '${canisterService.dfxName}'...`
              )
            );
          });
        }
      }
    }
  }
}
