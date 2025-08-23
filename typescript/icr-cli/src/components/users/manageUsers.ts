import chalk from 'chalk';
import * as fs from 'fs';
import { generatePrivateKey, getIdentityFromPrivateKey } from './principalUtils';
import { Identity } from '@dfinity/agent';

export type User = {
  name: string;
  privateKey: string;
};

// Type guard to validate Record<string, string>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isUserRecord(obj: any): obj is Record<string, string> {
  return (
    obj &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.entries(obj).every(
      ([key, value]) => typeof key === 'string' && typeof value === 'string'
    )
  );
}

export class UsersManagment {
  private users: Record<string, string>;
  constructor(usersFile: string = 'users.json') {
    this.usersFile = usersFile;

    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, '{}', { encoding: 'utf8' });
    }
    this.users = this.getUsers();
  }

  private usersFile: string;

  public createUser(user: string, privateKey: string, replace: boolean = false): boolean {
    const users = this.getUsers();

    let updated = false;
    if (users[user]) {
      if (replace) {
        users[user] = privateKey;
      } else {
        throw new Error(`User '${user}' already exists. Use --replace flag to overwrite.`);
      }
      updated = true;
    } else {
      users[user] = privateKey;
    }

    this.saveUsers(users);
    return updated;
  }

  public getUserPrivateKey(user: string): string | undefined {
    return this.users[user];
  }

  public getUser(user: string): Identity | undefined {
    console.log('Getting user', user);
    console.log('Users', this.users);
    const privateKey = this.users[user];
    if (!privateKey) {
      return undefined;
    }
    return getIdentityFromPrivateKey(privateKey);
  }

  private getUsers(): Record<string, string> {
    try {
      if (!fs.existsSync(this.usersFile)) {
        return {};
      }

      const usersContent = fs.readFileSync(this.usersFile, { encoding: 'utf8' });
      const parsed = JSON.parse(usersContent);

      // Validate the parsed JSON matches expected type
      if (!isUserRecord(parsed)) {
        throw new Error(
          `Invalid users file format. Expected Record<string, string>, got: ${typeof parsed}`
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in users file: ${error.message}`);
      }
      throw error;
    }
  }

  private saveUsers(users: Record<string, string>): void {
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2), { encoding: 'utf8' });
  }
}

export const createUser = ({
  user,
  privateKey,
  replace = false,
  verbose = false,
  usersManager = new UsersManagment(),
}: {
  user: string;
  privateKey?: string;
  replace: boolean;
  verbose: boolean;
  usersManager: UsersManagment;
}): void => {
  let privateKeyToUse = '';
  if (!privateKey) {
    if (verbose) {
      console.log(chalk.bold.yellow('Private key is not provided. Generating...'));
    }
    privateKeyToUse = generatePrivateKey();
  } else {
    privateKeyToUse = privateKey;
  }

  try {
    const updated = usersManager.createUser(user, privateKeyToUse, replace);

    if (verbose) {
      console.log(`User '${user}' ${updated ? 'updated' : 'created'} successfully.`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.error(`Failed to ${replace ? 'update' : 'create'} user: ${errorMessage}`);
    }
    throw error;
  }
};
