import chalk from 'chalk';
import figlet from 'figlet';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { DfxProject, DfxProjectCanister, prepareDfx } from './components/dfxProject';
import { CoreInfo, readCoreFile } from './components/coreInfo';
import { buildCanisterWithDfx } from './components/buildCanister';
import { startDfx } from './components/startDfx';
import { deployCoreCanisterToPocketIC } from './components/deployCanister';

type Command = 'deploy' | 'build';
var commandHandled: Command | undefined = undefined;

import * as dotenv from 'dotenv';
import { PocketIcCoreService } from './services/pocketIcCoreService';
dotenv.config();

//Список команд
const argv = yargs(hideBin(process.argv))
  .command(
    'deploy',
    'Builds and reinstalls all canisters if there was changes in the code or canister is not running',
    y => {
      y.option('pocket-server', {
        alias: 'pics',
        description:
          'set pocket core server url, see: https://github.com/pocket-core/pocket-core/wiki/Pocket-Core-Server',
        type: 'string',
      });
    },
    args => {
      commandHandled = 'deploy';
    }
  )
  .command(
    'build',
    'Builds all canisters',
    y => y,
    args => {
      commandHandled = 'build';
    }
  )
  .option('core', {
    alias: 'c',
    description:
      'set core.json file, more: https://midhub.atlassian.net/wiki/spaces/MID3/pages/956301420/mhb+-',
    type: 'string',
  })
  .option('environment', {
    alias: 'e',
    description:
      'set environment.json file, more: https://midhub.atlassian.net/wiki/spaces/MID3/pages/956301420/mhb+-',
    type: 'string',
  })
  .option('dir', {
    alias: 'd',
    description: 'set working directory',
    type: 'string',
  })
  .help()
  .alias('version', 'v')
  .alias('help', 'h')
  .parseSync();

//Показать красивое название тулзы
console.log(chalk.green(figlet.textSync('ICR Cli', { horizontalLayout: 'full' })));

console.log(chalk.bold.whiteBright('Starting ICR (internet computer registry) Cli...'));

const startICRCli = async () => {
  if (!commandHandled) {
    console.log(chalk.red('No command. See help: icr-cli -h'));
    return;
  }
  var picCoreUrl: URL | undefined = undefined;
  if (commandHandled === 'deploy') {
    const pocketIcCoreUrl = argv.pocketServer ?? process.env.POCKET_IC_CORE_URL;
    if (!pocketIcCoreUrl) {
      console.log(
        chalk.red(
          'No pocket server option provided (--pics, --pocket-server flag with url) and no $POCKET_IC_CORE_URL environment variable set'
        )
      );
      return;
    }
    picCoreUrl = new URL(pocketIcCoreUrl);
    if (!picCoreUrl.protocol) {
      console.log(
        chalk.red(
          'Invalid pocket server url (--pics, --pocket-server flag with or $POCKET_IC_CORE_URL environment variable set)'
        )
      );
      return;
    }
  }
  try {
    //Если передан параметр dir, то переключаем working directory
    if (argv.dir) {
      process.chdir(argv.dir);
    }
    let dfxProject = prepareDfx();

    if (dfxProject) {
      let coreInfo = readCoreFile(argv.core);
      if (coreInfo) {
        //await startDfx()

        //Building for every command
        //await buildCore(coreInfo, dfxProject)

        //Deploying for deploy command
        if (commandHandled === 'deploy') {
          await deployCore(coreInfo, dfxProject, picCoreUrl as URL);
          return;
        }
      }
      console.log(chalk.green('No command. See help: icr-cli -h'));
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error: ' + e.message);
    }
    throw e;
  }
};

//Здесь мы разворачиваем ядро: создаём и инсталируем все actor из core.json,
//которые сейчас не запущены или были изменены
const buildCore = async (
  coreInfo: CoreInfo,
  dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>
) => {
  console.log(chalk.whiteBright('Building core with dfx...'));
  if (!dfxProjectsByActorName[coreInfo.factory]) {
    throw new Error(`There is no required factory canister '${coreInfo.factory}' in dfx json`);
  }

  //Build factory
  console.log(chalk.white(` - Building factory core canister '${coreInfo.factory}'...`));
  await buildCanisterWithDfx(coreInfo.factory, dfxProjectsByActorName[coreInfo.factory][0]);
};

//Здесь мы разворачиваем ядро: создаём и инсталируем все actor из core.json,
//которые сейчас не запущены или были изменены
const deployCore = async (
  coreInfo: CoreInfo,
  dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>,
  picCoreUrl: URL
) => {
  console.log(chalk.whiteBright('Deploying core to pocket IC...'));

  PocketIcCoreService.setPicCoreUrl(picCoreUrl);
  const pocketIcCoreService = PocketIcCoreService.getInstance();
  const cores = await pocketIcCoreService.listCores();
  console.log(cores);

  //Deploy factory
  await deployCoreCanisterToPocketIC(
    'factory',
    coreInfo.factory,
    dfxProjectsByActorName[coreInfo.factory][0],
    cores
  );
};

startICRCli();
