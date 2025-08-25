import { Ed25519KeyIdentity } from '@dfinity/identity';
import * as fs from 'fs';
import * as path from 'path';

export class IdentityModel {
  private static instance: IdentityModel;
  private identity: Ed25519KeyIdentity | null = null;
  private readonly identityFilePath: string;

  private constructor() {
    // Store identity file in the ic-data directory
    const icDataDir = path.join(process.cwd(), 'app', 'ic-data');
    if (!fs.existsSync(icDataDir)) {
      fs.mkdirSync(icDataDir, { recursive: true });
    }
    this.identityFilePath = path.join(icDataDir, 'identity.json');
    this.loadIdentity();
  }

  public static getInstance(): IdentityModel {
    if (!IdentityModel.instance) {
      IdentityModel.instance = new IdentityModel();
    }
    return IdentityModel.instance;
  }

  private loadIdentity(): void {
    try {
      if (fs.existsSync(this.identityFilePath)) {
        const identityData = JSON.parse(fs.readFileSync(this.identityFilePath, 'utf-8'));
        this.identity = Ed25519KeyIdentity.fromParsedJson(identityData);
      } else {
        this.generateAndSaveIdentity();
      }
    } catch (error) {
      console.error('Error loading identity:', error);
      this.generateAndSaveIdentity();
    }
  }

  private generateAndSaveIdentity(): void {
    this.identity = Ed25519KeyIdentity.generate();
    try {
      fs.writeFileSync(this.identityFilePath, JSON.stringify(this.identity.toJSON()), 'utf-8');
    } catch (error) {
      console.error('Error saving identity:', error);
    }
  }

  public getIdentity(): Ed25519KeyIdentity {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }
    return this.identity;
  }

  public resetIdentity(): void {
    this.generateAndSaveIdentity();
  }
}
