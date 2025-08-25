import { spawn } from "child_process";

export function spawnAsync(command: string, args?: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data;
    });

    child.stderr.on('data', (data) => {
      stderrData += data;
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdoutData);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderrData || 'No error message'}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}