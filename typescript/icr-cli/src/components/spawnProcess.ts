import chalk from 'chalk';
import { spawn } from 'node:child_process';

export const spawnProcessWithOutput = async ({
  command,
  args,
  outMatcher,
  errorMatcher,
  onClose,
  stdOutToConsole,
  stdErrToConsole,
}: {
  command: string;
  args?: readonly string[];
  outMatcher?: (
    stdOutToConsole: string,
    resolve: (value: void | PromiseLike<void>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void
  ) => void;
  errorMatcher?: (
    stdErr: string,
    resolve: (value: void | PromiseLike<void>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void
  ) => void;
  onClose?: (
    code: number | null,
    resolve: (value: void | PromiseLike<void>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (reason?: any) => void
  ) => void;
  stdOutToConsole?: (stdOut: string) => void;
  stdErrToConsole?: (stdOut: string) => void;
}): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const dfxBuildProc = spawn(command, args, { stdio: 'pipe' });
    dfxBuildProc.stdout.on('data', chunk => {
      const stdOutData: string = chunk.toString().trim();
      stdOutToConsole ? stdOutToConsole(stdOutData) : console.log(chalk.blue(stdOutData));
      outMatcher ? outMatcher(stdOutData, resolve, reject) : {};
    });
    dfxBuildProc.stderr.on('data', chunk => {
      const stdOutData: string = chunk.toString().trim();
      stdErrToConsole ? stdErrToConsole(stdOutData) : console.error(stdOutData);
      errorMatcher ? errorMatcher(stdOutData, resolve, reject) : {};
    });
    dfxBuildProc.on('close', function (code) {
      if (onClose) {
        onClose(code, resolve, reject);
      } else {
        if (code == 0) {
          resolve();
        } else {
          reject(new Error('Execution failed'));
        }
      }
    });
  });
};
