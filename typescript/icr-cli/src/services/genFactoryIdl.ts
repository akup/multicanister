import { DfxProject, DfxProjectCanister } from '../components/dfxProject';
import { CoreInfo } from '../components/coreInfo';
import { execSync } from 'node:child_process';
import * as fs from 'fs';
import chalk from 'chalk';
import { defaultConfig } from '../configs';

export const genFactoryIdl = ({
  coreInfo,
  dfxProjectsByActorName,
  projectRoot,
}: {
  coreInfo: CoreInfo;
  dfxProjectsByActorName: Record<string, [DfxProjectCanister, DfxProject]>;
  projectRoot: string;
}) => {
  const [dfxCanister] = dfxProjectsByActorName[coreInfo.factory];
  const candidFile = dfxCanister.candid;
  let candidContent: string | undefined;
  if (candidFile && fs.existsSync(candidFile)) {
    candidContent = fs.readFileSync(candidFile, 'utf-8');
  }

  if (!candidContent) {
    throw new Error('Factory candid interface not found');
  }

  // Check if 'didc' command exists
  try {
    execSync('didc --version', { stdio: 'ignore' });
  } catch {
    throw new Error('didc command not found');
  }

  try {
    // Ensure the factory declarations directory exists
    const factoryDeclDir = `${projectRoot}/src/declarations/factory`;
    if (!fs.existsSync(factoryDeclDir)) {
      fs.mkdirSync(factoryDeclDir, { recursive: true });
    }
    // Run didc bind on the candid file
    const bindOutputDTS = execSync(`didc bind ${candidFile} --target ts`, { encoding: 'utf-8' });
    fs.writeFileSync(
      `${projectRoot}/src/declarations/factory/${defaultConfig.factoryIdlFile}.d.ts`,
      bindOutputDTS,
      'utf-8'
    );
    const bindOutputJS = execSync(`didc bind ${candidFile} --target js`, { encoding: 'utf-8' });
    fs.writeFileSync(
      `${projectRoot}/src/declarations/factory/${defaultConfig.factoryIdlFile}.js`,
      bindOutputJS,
      'utf-8'
    );
    console.log(
      `Factory idl bindings ${chalk.bold.green(defaultConfig.factoryIdlFile)} generated at ${projectRoot}/${defaultConfig.factoryIdlFile}`
    );
  } catch (e) {
    console.error('Error running didc bind:', e instanceof Error ? e.message : e);
    throw new Error('Error running didc bind');
  }
};
