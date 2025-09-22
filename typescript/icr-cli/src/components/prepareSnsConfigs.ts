import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

export function prepareSnsConfigs(projectRoot: string, canisterIds: Record<string, string>): void {
  console.log(chalk.whiteBright('--- Preparing SNS init args ---'));

  // Resolve important paths
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const cliRootDir = path.resolve(__dirname, '..', '..'); // typescript/icr-cli
  const snsDumpInitDir = path.join(projectRoot, 'innerDfxProjects', 'snsDumpInit');
  const snsDumpInitManifest = path.join(snsDumpInitDir, 'Cargo.toml');
  const snsDumpBinPath = path.join(
    snsDumpInitDir,
    'target',
    'release',
    process.platform === 'win32' ? 'sns-dump-init.exe' : 'sns-dump-init'
  );

  const snsInitYamlPath = path.join(projectRoot, 'sns_init.yaml');
  const outputDir = path.join(projectRoot, 'canisters', 'sns', 'args_generated');
  const canisterIdsJsonPath = path.join(outputDir, 'pocket-ic-canisters.json');

  // Preflight checks
  if (!fs.existsSync(snsDumpInitManifest)) {
    throw new Error(`sns-dump-init Cargo.toml not found at ${snsDumpInitManifest}`);
  }
  if (!fs.existsSync(snsInitYamlPath)) {
    throw new Error(`sns_init.yaml not found at ${snsInitYamlPath}`);
  }

  // Ensure output dir and write canister IDs
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(canisterIdsJsonPath, JSON.stringify(canisterIds, null, 2));
  console.log(chalk.blue(`Canister IDs saved to: ${canisterIdsJsonPath}`));

  // Build the Rust utility (release)
  console.log(chalk.blue('Building sns-dump-init...'));
  try {
    // Optional: skip rebuild if binary exists and looks fresh enough
    const needBuild =
      !fs.existsSync(snsDumpBinPath) ||
      fs.statSync(snsDumpBinPath).mtimeMs < fs.statSync(snsDumpInitManifest).mtimeMs;

    if (needBuild) {
      execSync(`cargo build --release --manifest-path "${snsDumpInitManifest}"`, {
        cwd: snsDumpInitDir,
        stdio: 'inherit',
      });
    } else {
      // Try building anyway to pick up dependency changes; comment out if undesired
      execSync(`cargo build --release --manifest-path "${snsDumpInitManifest}"`, {
        cwd: snsDumpInitDir,
        stdio: 'inherit',
      });
    }
  } catch (e) {
    throw new Error(`Failed to build sns-dump-init: ${(e as Error).message}`);
  }

  if (!fs.existsSync(snsDumpBinPath)) {
    throw new Error(`sns-dump-init binary not found at ${snsDumpBinPath}`);
  }

  // Run the utility to produce *.arg.bin and summary JSON
  console.log(
    chalk.blue('Generating SNS init args from sns_init.yaml and provided canister IDs...')
  );
  const cmd = [
    `"${snsDumpBinPath}"`,
    `--init-config "${snsInitYamlPath}"`,
    `--canister-ids "${canisterIdsJsonPath}"`,
    `--out-dir "${outputDir}"`,
  ].join(' ');

  try {
    execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
  } catch (e) {
    throw new Error(`sns-dump-init failed: ${(e as Error).message}`);
  }

  // Quick sanity check for expected files
  const expected = [
    'sns_governance.arg.bin',
    'sns_ledger.arg.bin',
    'sns_root.arg.bin',
    'sns_swap.arg.bin',
    'sns_index.arg.bin',
    'sns_init_args.summary.json',
  ];
  const missing = expected.filter(f => !fs.existsSync(path.join(outputDir, f)));
  if (missing.length) {
    throw new Error(`Missing output files: ${missing.join(', ')} in ${outputDir}`);
  }

  console.log(chalk.green(`\nSNS init args successfully generated in ${outputDir}`));
  console.log(chalk.gray(`Files: ${expected.join(', ')}`));
}
