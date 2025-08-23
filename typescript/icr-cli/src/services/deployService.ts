import chalk from 'chalk';
import { AppsInfo } from '../components/appsInfo';
import { CoreInfo } from '../components/coreInfo';
import { DfxProject, DfxProjectCanister } from '../components/dfxProject';
import { PocketIcCoreService } from './pocketIcCoreService';
import { deployCoreCanisterToPocketIC } from '../components/deployCanister';
import { execSync } from 'child_process';

import { Ed25519KeyIdentity } from '@dfinity/identity';
import { FactoryService } from './factoryService';
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
  }: {
    coreInfo: CoreInfo;
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>;
    picCoreUrl: URL;
  }): Promise<string | undefined> {
    console.log(chalk.whiteBright('Deploying core to pocket IC...'));

    PocketIcCoreService.setPicCoreUrl(picCoreUrl);
    const pocketIcCoreService = PocketIcCoreService.getInstance();
    const cores = await pocketIcCoreService.listCores();
    console.log(cores);

    //Deploy core canisters
    for (const [key, value] of Object.entries(coreInfo)) {
      if (key === 'modules' || !value) {
        continue;
      }
      const [dfxCanister, dfxProject] = dfxProjectsByActorName[value];
      const wasmPath = dfxProject.root + dfxCanister.wasm;
      const coreCanisterData = cores[key];
      await deployCoreCanisterToPocketIC(key, value, wasmPath, coreCanisterData);
    }
    if (cores.factory && cores.factory.canisterIds.length > 0) {
      return cores.factory.canisterIds[0];
    }
    return undefined;
  }

  // Here we deploy the apps: create and upload all wasms referenced by canisterServices[].dfxName from apps.json
  // Checking if there is already wasms with same hash and branch:tag selector
  public static async deployApps({
    appsInfo,
    coreInfo,
    dfxProjectsByActorName,
    picGatewayUrl,
    factoryCanisterId,
  }: {
    appsInfo: AppsInfo;
    coreInfo: CoreInfo;
    dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>;
    picGatewayUrl: URL;
    factoryCanisterId: string;
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

    //First we prepare Agent to work with factory in remote PIC
    //TODO: reuse users
    console.log('Host for pic gateway', picGatewayUrl.toString());
    const identity = Ed25519KeyIdentity.generate();
    identity.getKeyPair();
    const factoryService = await FactoryService.getInstance(
      picGatewayUrl,
      identity,
      factoryCanisterId
    );

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
