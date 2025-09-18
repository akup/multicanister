import type { Readable } from 'node:stream';

import { spawn } from 'child_process';
import { CoreModel } from '../models/CoreModel';
import { ApplicationSubnetConfig, PocketIc, SubnetStateType } from '@repo/pic';
import { ICManagementCanister, chunk_hash } from '@dfinity/ic-management';
import { createAgent } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { CreateInstanceRequest } from '@repo/pic/src/pocket-ic-client-types';
import { IdentityModel } from '../models/IdentityModel';
import * as fs from 'fs';
import { AgentCallError } from '@dfinity/agent';

const PIC_GATEWAY_DOMAINS =
  process.env.PIC_GATEWAY_DOMAINS?.split(',').map(domain => domain.trim().toLowerCase()) ?? [];
const POCKET_IC_TIMEOUT = 10000;

export type UpdateStrategy = 'upgrade' | 'reinstall';
export type CanisterStatus = 'stopped' | 'stopping' | 'running' | 'corrupted' | 'unexisting';

export class PocketICService {
  private static instance: PocketICService;
  private pocketICProcess: ReturnType<typeof spawn> | null = null;
  private pocketIC: PocketIc | null = null;
  private managementCanisterAgent: ICManagementCanister | null = null;
  private readonly coreModel: CoreModel;
  private readonly CHUNK_SIZE = 500 * 1024; // 500KB chunks

  private constructor() {
    this.coreModel = CoreModel.getInstance();
  }

  public static getInstance(): PocketICService {
    if (!PocketICService.instance) {
      PocketICService.instance = new PocketICService();
    }
    return PocketICService.instance;
  }

  public async start({ port, gatewayPort }: { port: number; gatewayPort?: number }): Promise<void> {
    if (this.pocketICProcess) {
      throw new Error('PocketIC is already running');
    }

    const proc = spawn(
      process.env.POCKET_IC_BIN || 'pocket-ic',
      ['-p', port.toString(), '--ttl', '120'],
      {
        stdio: 'pipe',
      }
    );

    if (!proc.pid) {
      throw new Error('Failed to spawn PocketIC process');
    }

    // Process event handlers
    proc.on('error', error => {
      throw new Error(`PocketIC process error: ${error.message}`);
    });
    proc.on('exit', () => {
      console.error('PocketIC process exited!!!');
      this.stop().catch(error => {
        console.error('Error during shutdown:', error);
      });
      process.exit(1);
    });
    process.on('uncaughtException', () => {
      console.error('Uncaught exception');
      this.stop().catch(error => {
        console.error('Error during shutdown:', error);
      });
    });
    process.on('SIGINT', () => {
      console.error('SIGINT');
      this.stop().catch(error => {
        console.error('Error during shutdown:', error);
      });
    });
    process.on('SIGTERM', () => {
      console.error('SIGTERM');
      this.stop().catch(error => {
        console.error('Error during shutdown:', error);
      });
    });

    // Wait for PocketIC to be ready
    await new Promise<void>((resolve, reject) => {
      if (proc.stdout && proc.stderr) {
        const cleanup = (): void =>
          [proc.stdout, proc.stderr].forEach(s => s?.removeAllListeners('data'));
        proc.stdout.once('data', chunk => {
          if (chunk.toString().includes('The PocketIC server is listening on port')) resolve();
          else {
            cleanup();
            reject(new Error(`Unexpected output from PocketIC: ${chunk.toString()}`));
          }
        });
        proc.stderr.once('data', chunk => {
          cleanup();
          reject(new Error(chunk.toString()));
        });
      } else {
        reject(new Error('PocketIC process stdout not found'));
      }
    });
    this.pocketICProcess = proc;

    // Redirect stdout and stderr for logging
    const redirectOutput = (stream: Readable, prefix: string) => {
      let buffer = '';
      const listener = (chunk: Buffer) => {
        buffer += chunk.toString();
        if (buffer.includes('\n')) {
          console.log(`${prefix}: ${buffer.trim()}`);
          buffer = '';
        }
        stream.once('data', listener);
      };
      stream.once('data', listener);
    };
    redirectOutput(proc.stderr, 'PIC_ERR');
    redirectOutput(proc.stdout, 'PIC_OUT');

    const pocketICHost = `http://localhost:${port}`;
    const gwPort = gatewayPort ?? port + 1;
    const ICGatewayAPIHost = `http://localhost:${gwPort}`;

    const subnetCreateConfigs: CreateInstanceRequest = {
      application: [{ state: { type: SubnetStateType.New } }],
      nns: { state: { type: SubnetStateType.New } },
    };

    // Topology and state will be loaded from the state directory
    // if $POCKET_IC_STATE_DIR environment variable is set and directory exists
    this.pocketIC = await PocketIc.create(pocketICHost, {
      processingTimeoutMs: POCKET_IC_TIMEOUT,
      stateDir: process.env.POCKET_IC_STATE_DIR,
      ...subnetCreateConfigs,
    });

    //Need to set ipAddr to 0.0.0.0 to make it accessible from outside container
    //Need to set all domains it will be accessible with
    console.log(
      'All domains',
      ['0.0.0.0', '127.0.0.1', 'localhost']
        .concat(PIC_GATEWAY_DOMAINS)
        .filter(domain => domain !== '')
    );
    await this.pocketIC.makeLiveWithGatewayParameters({
      port: gwPort,
      ipAddr: '0.0.0.0',
      domains: ['0.0.0.0', '127.0.0.1', 'localhost']
        .concat(PIC_GATEWAY_DOMAINS)
        .filter(domain => domain !== ''),
    });
    console.log('PocketIC gateway started on port', gwPort);

    // Initialize high-level management canister agent
    const identity = IdentityModel.getInstance().getIdentity();
    const agent = await createAgent({
      identity,
      host: ICGatewayAPIHost,
    });
    // Fetch root key as we are talking to the Pocket IC and not the mainnet
    await agent.fetchRootKey();

    this.managementCanisterAgent = ICManagementCanister.create({ agent });

    const keepAlive = async (): Promise<void> => {
      try {
        // const getTimeStart = Date.now();
        // const time = await this.pocketIC!.getTime();
        // const getTimeEnd = Date.now();
        // console.log('PocketIC time', time);
        // console.log('PocketIC getTime took', getTimeEnd - getTimeStart, 'ms');
        await this.pocketIC!.getTime();
      } catch (error) {
        console.error('Error pinging PocketIC to keep it alive:', error);
      }
    };
    keepAlive();
    setInterval(keepAlive, 60 * 1000);

    await this.checkExistingCanisters();
  }

  public async stop(): Promise<void> {
    if (this.pocketICProcess) {
      this.pocketICProcess.kill();
      this.pocketICProcess = null;
    }
    this.pocketIC = null;
    this.managementCanisterAgent = null;
  }

  private async checkExistingCanisters(): Promise<void> {
    const cores = await this.coreModel.list();
    for (const [name, record] of Object.entries(cores)) {
      for (const canisterId of record.canisterIds) {
        try {
          const canisterStatus = await this.checkCanisterHashAndRunning(
            canisterId,
            record.wasmHash
          );
          console.log(`Canister '${name}' from core with id ${canisterId} status:`, canisterStatus);

          if (canisterStatus === 'corrupted') {
            console.warn(`Canister ${canisterId} from core ${name} is corrupted.`);
            this.coreModel.markAsCorrupted(name, true);
          } else if (canisterStatus === 'unexisting') {
            console.warn(
              `Canister ${canisterId} from core ${name} does not exist. Deleting record...`
            );
            this.coreModel.delete(name);
          }
        } catch (error) {
          console.error(`Error checking canister ${canisterId} from core ${name}:`, error);
        }
      }
    }
  }

  public getClient(): PocketIc | null {
    return this.pocketIC;
  }
  public getManagementCanisterAgent(): ICManagementCanister | null {
    return this.managementCanisterAgent;
  }
  public isRunning(): boolean {
    return this.pocketICProcess !== null && this.pocketICProcess.pid !== null;
  }
  public getPocketICProcessId(): number | undefined {
    return this.pocketICProcess?.pid;
  }

  // Stage 1 of the two-stage deployment. It creates all canisters first.
  public async getCanisterIds(names: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    for (const name of names) {
      const existing = await this.coreModel.get(name);
      if (existing && existing.canisterIds.length > 0) {
        results[name] = existing.canisterIds[0];
      } else {
        const newCanisterId = await this.createCanister();
        await this.coreModel.set(name, {
          canisterIds: [newCanisterId],
          wasmHash: '',
          branch: '',
          tag: '',
          commit: '',
          corrupted: false,
        });
        results[name] = newCanisterId;
      }
    }
    return results;
  }

  public async createCanister(): Promise<string> {
    if (!this.managementCanisterAgent) {
      throw new Error('Management Canister Agent is not initialized');
    }
    const canisterId = await this.managementCanisterAgent.provisionalCreateCanisterWithCycles({
      amount: 1_000_000_000_000_000_000n, // 1000T cycles for good measure
    });
    const canisterIdText = canisterId.toText();
    console.log(`Canister ${canisterIdText} created.`);
    return canisterIdText;
  }

  private async uploadWasmInChunks(
    wasmModule: Buffer,
    canisterId: Principal
  ): Promise<chunk_hash[]> {
    if (!this.managementCanisterAgent) {
      throw new Error('Management Canister Agent is not initialized');
    }

    const chunks: Buffer[] = [];
    for (let i = 0; i < wasmModule.length; i += this.CHUNK_SIZE) {
      chunks.push(Buffer.from(wasmModule.slice(i, i + this.CHUNK_SIZE)));
    }
    console.log(`Uploading WASM in ${chunks.length} chunks...`);

    await this.managementCanisterAgent.clearChunkStore({ canisterId });

    const chunkHashes: chunk_hash[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkHash = await this.managementCanisterAgent.uploadChunk({
        canisterId,
        chunk: chunks[i],
      });
      chunkHashes.push(chunkHash);
      console.log(`Uploaded chunk ${i + 1}/${chunks.length}`);
    }
    return chunkHashes;
  }

  // Stage 2 of the two-stage deployment. It installs code into existing canisters.
  public async installCode({
    canisterId,
    wasmModule,
    wasmModuleHash,
    updateStrategy,
    initArgB64,
  }: {
    canisterId: string;
    wasmModule: Buffer;
    wasmModuleHash: string;
    updateStrategy?: UpdateStrategy;
    initArgB64?: string;
  }): Promise<void> {
    if (!this.managementCanisterAgent) {
      throw new Error('Management Canister Agent is not initialized');
    }

    const canisterPrincipal = Principal.fromText(canisterId);
    const uploadedChunks = await this.uploadWasmInChunks(wasmModule, canisterPrincipal);
    const wasmHashBlob = Uint8Array.from(Buffer.from(wasmModuleHash, 'hex'));

    const argBytes =
      initArgB64 && initArgB64.length > 0
        ? new Uint8Array(Buffer.from(initArgB64, 'base64'))
        : new Uint8Array();

    await this.managementCanisterAgent.installChunkedCode({
      targetCanisterId: canisterPrincipal,
      chunkHashesList: uploadedChunks,
      wasmModuleHash: wasmHashBlob,
      arg: argBytes,
      mode: updateStrategy === 'reinstall' ? { reinstall: null } : { upgrade: [] },
    });

    console.log(`Wasm code installed for canister ${canisterId}`);
  }

  public async checkCanisterHashAndRunning(
    canisterId: string,
    wasmHash: string
  ): Promise<CanisterStatus> {
    if (!this.managementCanisterAgent) {
      throw new Error('Management Canister Agent is not initialized');
    }
    try {
      const status = await this.managementCanisterAgent.canisterStatus(
        Principal.fromText(canisterId)
      );

      if (status.module_hash?.[0]) {
        const moduleHash = Buffer.from(status.module_hash[0]).toString('hex');
        if (moduleHash === wasmHash) {
          if ('running' in status.status) return 'running';
          if ('stopping' in status.status) return 'stopping';
          if ('stopped' in status.status) return 'stopped';
        }
      }
      return 'corrupted';
    } catch (error) {
      // NEW: Restored robust error handling to correctly identify unexisting canisters.
      if (
        error instanceof AgentCallError &&
        (error.message.includes('does not exist') ||
          error.message.includes('not found') ||
          error.message.includes('does not belong to any subnet'))
      ) {
        return 'unexisting';
      }
      throw error;
    }
  }

  //TODO: restart the canister or delete on corruption
}
