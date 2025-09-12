import chalk from 'chalk';
import { AppsInfo } from '../components/appsInfo';
import { CoreInfo } from '../components/coreInfo';
import { DfxProject, DfxProjectCanister } from '../components/dfxProject';
import { PocketIcCoreService } from './pocketIcCoreService';
import { deployCoreCanisterToPocketIC } from '../components/deployCanister';
import { execSync } from 'child_process';

import { Identity } from '@dfinity/agent';
import { FactoryService } from './factoryService';
import { requiredCoreKeys, optionalCoreKeys } from '../constants';
export { idlFactory } from '../declarations/factory/factory.did';

interface GitInfo {
  branch: string;
  tag: string | null;
  isGitRepo: boolean;
  gitAvailable: boolean;
}

// Get current git branch and tag information
function getGitInfo(): GitInfo {
  let gitAvailable = false;
  let isGitRepo = false;
  let branch = 'unknown';
  let tag: string | null = null;

  try {
    // Check if git command is available
    execSync('git --version', { stdio: 'ignore' });
    gitAvailable = true;
  } catch {
    return { branch, tag, isGitRepo, gitAvailable };
  }

  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    isGitRepo = true;
  } catch {
    return { branch, tag, isGitRepo, gitAvailable };
  }

  try {
    // Get current branch
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

    // Get current tag (if any)
    try {
      tag = execSync('git describe --tags --exact-match', { encoding: 'utf8' }).trim();
    } catch {
      // No tag found, that's okay
      tag = null;
    }
  } catch (error) {
    console.error(chalk.red('Failed to get git information:'), error);
  }

  return { branch, tag, isGitRepo, gitAvailable };
}

export class DeployService {
  // Here we deploy the core: create and install all actors from core.json
  // that are not currently running in remote PIC or have been changed
  public static async deployCore({
    coreInfo,
    dfxProjectsByActorName,
    picCoreUrl,
    userPrincipal,
  }: {
    coreInfo: CoreInfo;
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>;
    picCoreUrl: URL;
    userPrincipal: string;
  }): Promise<string | undefined> {
    console.log(chalk.whiteBright('Deploying core to pocket IC...'));

    PocketIcCoreService.setPicCoreUrl(picCoreUrl);
    const pocketIcCoreService = PocketIcCoreService.getInstance();
    const deploymentOrder = [...requiredCoreKeys, ...optionalCoreKeys];
    const canisterNamesToDeploy = deploymentOrder.filter(key => coreInfo[key as keyof CoreInfo]);

    // 2. Call the new endpoint to create canisters and get their IDs
    console.log(chalk.white(' - Ensuring all core canisters exist...'));
    const deployedCanisterIds = await pocketIcCoreService.getCanisterIds(canisterNamesToDeploy);
    console.log('Received canister IDs:', deployedCanisterIds);

    // 3. Now iterate and install the code into the already created canisters
    for (const key of deploymentOrder) {
      const value = coreInfo[key as keyof CoreInfo];
      if (!value) continue;

      const [dfxCanister, dfxProject] = dfxProjectsByActorName[value];
      const wasmPath = dfxProject.root + dfxCanister.wasm;

      // Fetch state data (hash, etc.) from the server
      const cores = await pocketIcCoreService.listCores();
      const coreCanisterData = cores[key];

      await deployCoreCanisterToPocketIC({
        canisterName: key,
        wasmName: value,
        wasmPath,
        canisterConfig: dfxCanister,
        coreCanisterData,
        deployedCanisterIds,
        dfxProjectRoot: dfxProject.root,
        userPrincipal,
      });
    }

    return deployedCanisterIds.factory;
  }

  // Here we deploy the apps: create and upload all wasms referenced by canisterServices[].dfxName from apps.json
  // Checking if there is already wasms with same hash and branch:tag selector
  public static async deployApps({
    appsInfo,
    coreInfo,
    dfxProjectsByActorName,
    picGatewayUrl,
    factoryCanisterId,
    user,
  }: {
    appsInfo: AppsInfo;
    coreInfo: CoreInfo;
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>;
    picGatewayUrl: URL;
    factoryCanisterId: string;
    user: Identity;
  }): Promise<void> {
    console.log(chalk.whiteBright('Deploying apps to pocket IC...'));

    // Get current git branch and tag
    const gitInfo = getGitInfo();

    let selectors: Array<string> = [];
    if (!gitInfo.gitAvailable) {
      console.log(chalk.yellow('Git command not available'));
    } else if (!gitInfo.isGitRepo) {
      console.log(chalk.yellow('Not in a git repository'));
    } else {
      if (gitInfo.tag) {
        selectors.push(`${gitInfo.branch}:${gitInfo.tag}`);
      }
      selectors.push(`${gitInfo.branch}:latest`);
    }

    console.log(chalk.blue(`Selectors: ${selectors.join(', ')}`));

    // Parse the candid string to get the IDL
    //const factoryIdl = IDL.parse(candidContent);
    //IDL.generateBindings(factoryIdl);

    //First we prepare Agent to work with factory in remote PIC from the name if a provided user
    const factoryService = await FactoryService.getInstance(picGatewayUrl, user, factoryCanisterId);

    console.log('Creating batch...');
    const batch = await factoryService.createBatch();
    console.log('Batch created:', batch);

    let uploadedWasms: Record<string, boolean> = {};
    for (const [appName, appData] of Object.entries(appsInfo.apps)) {
      //TODO: uploading app

      //Then we upload wasms to factory
      for (const canisterService of appData.canisterServices) {
        if (!uploadedWasms[canisterService.dfxName]) {
          uploadedWasms[canisterService.dfxName] = true;

          //TODO: get wasm hash for selectors and serviceId
        }
      }
    }
  }
}
