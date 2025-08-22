import chalk from 'chalk';
import { spawnProcessWithOutput } from './spawnProcess';

// This file is deprecated and should not be used.

/**
 * @deprecated This function is deprecated and should not be used.
 */
export const startDfx = async (): Promise<void> => {
  console.log(chalk.bold.whiteBright(`Starting dfx...`));

  let dfxIsAlreadyRunning = false;

  await spawnProcessWithOutput({
    command: 'dfx',
    args: ['start', '--clean'],
    errorMatcher: (stdErr, resolve) => {
      if (stdErr.match(/Replica API running on.*/i)) {
        console.log(chalk.green(`Dfx started\n`));
        resolve();
      } else if (stdErr.match(/.*dfx is already running./i)) {
        dfxIsAlreadyRunning = true;
      }
    },
    stdErrToConsole: stdErrData => {
      console.log(` ${chalk.gray(stdErrData)}`);
    },
    onClose: (code, resolve, reject) => {
      if (code == 0) {
        console.log(chalk.green(`Dfx started\n`));
        resolve();
      } else {
        if (dfxIsAlreadyRunning) {
          resolve();
        } else {
          reject(new Error(`Dfx could not be started`));
        }
      }
    },
  });
};
