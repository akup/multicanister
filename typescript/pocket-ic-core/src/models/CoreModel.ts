import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './DataDir';

export interface CoreRecord {
  canisterIds: string[];
  wasmHash: string;
  branch: string;
  tag: string;
  commit: string;
  corrupted?: boolean;
}

export class CoreModel {
  private static instance: CoreModel;
  private readonly storageDir: string;

  private constructor(storageDir: string = path.join(DATA_DIR, 'cores')) {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }

  public static getInstance(storageDir?: string): CoreModel {
    if (!CoreModel.instance) {
      CoreModel.instance = new CoreModel(storageDir);
    }
    return CoreModel.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getFilePath(name: string): string {
    return path.join(this.storageDir, `${name}.json`);
  }

  async get(name: string): Promise<CoreRecord | null> {
    const filePath = this.getFilePath(name);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const data = await fs.promises.readFile(filePath, 'utf-8');
    const record = JSON.parse(data) as CoreRecord;
    return {
      ...record,
      corrupted: record.corrupted ?? false,
    };
  }

  async set(name: string, record: CoreRecord): Promise<void> {
    const filePath = this.getFilePath(name);
    await fs.promises.writeFile(filePath, JSON.stringify(record, null, 2));
  }

  async list(): Promise<Record<string, CoreRecord>> {
    const files = await fs.promises.readdir(this.storageDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const result: Record<string, CoreRecord> = {};

    for (const file of jsonFiles) {
      const name = file.replace('.json', '');
      const record = await this.get(name);
      if (record) {
        result[name] = record;
      }
    }

    return result;
  }

  async delete(name: string): Promise<void> {
    const filePath = this.getFilePath(name);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async markAsCorrupted(name: string, isCorrupted: boolean = true): Promise<void> {
    const record = await this.get(name);
    if (record) {
      await this.set(name, { ...record, corrupted: isCorrupted });
    }
  }
}
