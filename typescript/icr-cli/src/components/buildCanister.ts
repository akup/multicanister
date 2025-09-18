import type { DfxProjectCanister } from './dfxProject';
import chalk from 'chalk';
import { spawnProcessWithOutput } from './spawnProcess';
import type { DfxProject } from './dfxProject';

export const buildCanister = async (
  canisterName: string,
  dfxProjectCanister: DfxProjectCanister,
  dfxProjectRoot?: string,
  onBuildStart?: () => void
): Promise<void> => {
  if (onBuildStart) {
    onBuildStart();
  } else {
    console.log(chalk.white(` - Building canister '${canisterName}'...`));
  }
  const processWorkingDirectory = process.cwd();
  if (!dfxProjectRoot) {
    dfxProjectRoot = processWorkingDirectory;
  }

  //Change working directory to the dfx project root
  process.chdir(dfxProjectRoot);

  console.log('before build canister');
  await _buildCanisterWithoutDfx(canisterName, dfxProjectCanister);
  console.log('after build canister');

  console.log('Optimizing wasm code:', dfxProjectCanister.wasm);

  //Optimizing wasm code
  await spawnProcessWithOutput({
    command: 'ic-wasm',
    args: [dfxProjectCanister.wasm, '-o', dfxProjectCanister.wasm, 'optimize', 'O3'],
  });
  //ic-wasm <input.wasm> -o <output.wasm> optimize <level>
  //level = O3
  console.log(chalk.bold.green(`Wasm of canister '${canisterName}' optimized with O3`));

  //Adding data to metadata
  //TODO: check candid syntax
  await _addCandidToMetadata(canisterName, dfxProjectCanister);
  console.log('');

  //TODO: Gzip wasm code ?

  //Change working directory back to the original one
  process.chdir(processWorkingDirectory);
};

const _buildCanisterWithoutDfx = async (
  canisterName: string,
  dfxProjectCanister: DfxProjectCanister
): Promise<void> => {
  console.log(dfxProjectCanister);
  if (dfxProjectCanister.type === 'custom') {
    // If there's no build command, it's a pre-compiled wasm. Skip the build step.
    if (!dfxProjectCanister.build) {
      console.log(chalk.bold.yellow(`Canister '${canisterName}' is pre-compiled, skipping build.`));
      return;
    }

    let buildCommands: string[] = [];
    if (typeof dfxProjectCanister.build === 'string') {
      buildCommands = [dfxProjectCanister.build];
    } else if (Array.isArray(dfxProjectCanister.build)) {
      buildCommands = dfxProjectCanister.build;
    }

    for (const buildCommand of buildCommands) {
      console.log(chalk.bold.whiteBright(buildCommand + '\n'));
      const args = buildCommand.split(' ').map((arg: string) => arg.trim());
      const command = args.shift(); // remove the command from args

      if (!command) {
        throw new Error(`Invalid build command: "${buildCommand}"`);
      }

      await spawnProcessWithOutput({
        command,
        args,
        stdErrToConsole: stdErrData => {
          console.log(
            ` ${chalk.gray(
              stdErrData
                .split('\n')
                .map(line => ` ${line}`)
                .join('\n')
            )}`
          );
        },
        onClose: (code, resolve, reject) => {
          if (code == 0) {
            console.log(chalk.bold.green(`'${command}' successfully executed`));
            resolve();
          } else {
            reject(new Error(`Canister '${canisterName}' build unsuccessfully`));
          }
        },
      });
    }
    console.log(chalk.bold.green(`\nCanister '${canisterName}' build done`));
  } else {
    console.log(chalk.bold.yellow(`Canister '${canisterName}' is not a custom canister`));
  }
};

const _addCandidToMetadata = async (
  canisterName: string,
  dfxProjectCanister: DfxProjectCanister
): Promise<void> => {
  console.log(
    chalk.bold.whiteBright(
      `\nChecking candid was added to metadata for wasm of canister '${canisterName}'...`
    )
  );
  //Check candid metadata
  var candidMetadataNotFound = false;
  await spawnProcessWithOutput({
    command: 'ic-wasm',
    args: [dfxProjectCanister.wasm, '-o', dfxProjectCanister.wasm, 'metadata', 'candid:service'],
    outMatcher: stdOut => {
      if (stdOut.match(/Cannot find metadata candid:service/i)) {
        candidMetadataNotFound = true;
      }
    },
    stdOutToConsole: stdOutData => {
      console.log(
        `${chalk.gray(
          stdOutData
            .split('\n')
            .map(line => ` ${line}`)
            .join('\n')
        )}`
      );
    },
  });

  if (!dfxProjectCanister.candid) {
    if (candidMetadataNotFound) {
      console.log(
        chalk.bold.yellow(`Candid is not provided for canister '${canisterName}' in dfx.json`)
      );
    }
    return;
  }

  if (candidMetadataNotFound) {
    candidMetadataNotFound = false;
    //Add candid to metadata
    await spawnProcessWithOutput({
      command: 'ic-wasm',
      args: [
        dfxProjectCanister.wasm,
        '-o',
        dfxProjectCanister.wasm,
        'metadata',
        'candid:service',
        '-f',
        dfxProjectCanister.candid,
        '-v',
        'public',
      ],
    });

    console.log(chalk.bold.green(`Candid was added to wasm of canister '${canisterName}'`));

    //Check candid to metadata
    await spawnProcessWithOutput({
      command: 'ic-wasm',
      args: [dfxProjectCanister.wasm, '-o', dfxProjectCanister.wasm, 'metadata', 'candid:service'],
      outMatcher: stdOut => {
        if (stdOut.match(/Cannot find metadata candid:service/i)) {
          candidMetadataNotFound = true;
        }
      },
      stdOutToConsole: stdOutData => {
        console.log(
          `${chalk.gray(
            stdOutData
              .split('\n')
              .map(line => ` ${line}`)
              .join('\n')
          )}`
        );
      },
    });
  }

  if (candidMetadataNotFound) {
    throw new Error(`Candid metadata was not added to canister '${canisterName}'`);
  }
};
