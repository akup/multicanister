import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { pathToFileURL, fileURLToPath } from 'url';

export function prepareSnsConfigs(): void {
  console.log(chalk.whiteBright('--- Preparing SNS CLI and Initial Arguments ---'));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const cliRootDir = path.resolve(__dirname, '..', '..');
  const projectRoot = path.resolve(cliRootDir, '..', '..');
  const icRepoPath = path.join(projectRoot, 'ic');
  const patchFilePath = path.join(cliRootDir, 'sns-cli-dump-args.patch');
  const outputDir = path.join(projectRoot, 'canisters', 'sns', 'args_generated');
  const snsCliBinPath = path.join(icRepoPath, 'target', 'release', 'sns');
  const snsInitYamlPath = path.join(projectRoot, 'sns_init.yaml');

  // 1. Check if the IC submodule exists
  if (!fs.existsSync(icRepoPath)) {
    throw new Error(
      `IC repository not found at ${icRepoPath}. Please ensure the submodule is cloned.`
    );
  }

  // 2. Apply the patch to the sns-cli
  console.log(chalk.blue('Applying patch to sns-cli...'));
  try {
    // Check if patch is already applied by trying to reverse it in dry-run mode.
    // If this command succeeds, it means the patch is applied. If it fails, we need to apply it.
    execSync(`patch -p1 --reverse --dry-run < "${patchFilePath}"`, {
      cwd: icRepoPath,
      stdio: 'ignore',
    });
    console.log(chalk.yellow('Patch seems to be already applied. Skipping.'));
  } catch (error) {
    console.log('Patch not applied yet. Applying now...');
    execSync(`patch -p1 < "${patchFilePath}"`, { cwd: icRepoPath, stdio: 'inherit' });
  }

  // 3. Build the patched sns-cli binary
  console.log(chalk.blue('Building patched sns-cli...'));
  execSync('cargo build --release --bin sns', {
    cwd: path.join(icRepoPath, 'rs', 'sns', 'cli'),
    stdio: 'inherit', // Show build progress to the user
  });

  // 4. Generate the init argument files
  console.log(chalk.blue('Generating SNS init arg files...'));
  if (!fs.existsSync(snsInitYamlPath)) {
    throw new Error(`sns_init.yaml not found at ${snsInitYamlPath}`);
  }

  // Ensure the output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  execSync(
    `"${snsCliBinPath}" deploy-testflight --init-config-file "${snsInitYamlPath}" --dump-init-args "${outputDir}"`,
    {
      cwd: projectRoot, // Run from project root so dfx can find its context
      stdio: 'inherit',
    }
  );

  console.log(chalk.green(`\nSNS init args successfully generated in ${outputDir}`));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    prepareSnsConfigs();
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}
