import { spawn } from 'child_process';
import { CoreModel } from '../models/CoreModel';
import { ApplicationSubnetConfig, PocketIc, SubnetStateType } from '@repo/pic';
import { chunk_hash, ICManagementCanister } from '@dfinity/ic-management';
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

    // Start PocketIC process
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
      // Capture stdout from the spawned PocketIC process
      if (proc.stdout && proc.stderr) {
        const cleanup = (): void =>
          [proc.stdout, proc.stderr].forEach(s => s?.removeAllListeners('data'));
        proc.stdout.once('data', chunk => {
          const stdOutData = chunk.toString().trim();
          if (stdOutData.includes('The PocketIC server is listening on port')) {
            resolve();
          } else {
            cleanup();
            reject(new Error(`Unexpected output from PocketIC: ${stdOutData}`));
          }
        });
        proc.stderr.once('data', chunk => {
          cleanup();
          reject(new Error(chunk.toString().trim()));
        });
      } else {
        reject(new Error('PocketIC process stdout not found'));
      }
    });
    this.pocketICProcess = proc;

    //Redirecting stdout and stderr for logging of PocketIC
    //For some reason .on('data') is not working, so we are using .once('data') and re-add listener for the stderr
    var collectedStdErr = '';
    const stdErrChunkListener = (chunk: Buffer): void => {
      collectedStdErr += chunk.toString();
      if (collectedStdErr.includes('\n')) {
        console.error('PIC: ' + collectedStdErr.trim());
        collectedStdErr = '';
      }
      proc.stderr.once('data', stdErrChunkListener);
    };
    proc.stderr.once('data', stdErrChunkListener);

    var collectedStdOut = '';
    const stdOutChunkListener = (chunk: Buffer): void => {
      console.log('trying to get stdout: ' + chunk.toString());
      collectedStdOut += chunk.toString();
      if (collectedStdOut.includes('\n')) {
        console.log('PIC: ' + collectedStdOut.trim());
        collectedStdOut = '';
      }
      proc.stdout.once('data', stdOutChunkListener);
    };
    proc.stdout.once('data', stdOutChunkListener);

    const pocketICHost = `http://localhost:${port}`;
    const gwPort = gatewayPort ?? port + 1;
    const ICGatewayAPIHost = `http://localhost:${gwPort}`;

    // Initialize PocketIC client with application subnet and NNS subnet
    const defaultApplicationSubnet: ApplicationSubnetConfig = {
      state: { type: SubnetStateType.New },
    };
    const subnetCreateConfigs: CreateInstanceRequest = {
      application: [defaultApplicationSubnet],
      nns: {
        state: { type: SubnetStateType.New },
      },
    };
    // Topology and state will be loaded from the state directory
    // if $POCKET_IC_STATE_DIR environment variable is set and directory exists
    this.pocketIC = await PocketIc.create(pocketICHost, {
      processingTimeoutMs: POCKET_IC_TIMEOUT,
      stateDir: !process.env.POCKET_IC_STATE_DIR ? undefined : process.env.POCKET_IC_STATE_DIR,
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

    // Use default IC Management via IC Agent

    // Initialize management canister
    const identity = IdentityModel.getInstance().getIdentity();
    const agent = await createAgent({
      identity,
      host: ICGatewayAPIHost,
    });
    // Fetch root key as we are talking to the Pocket IC and not the mainnet
    await agent.fetchRootKey();
    this.managementCanisterAgent = ICManagementCanister.create({
      agent,
    });

    const logPocketICTime = async (): Promise<void> => {
      try {
        // const getTimeStart = Date.now();
        // const time = await this.pocketIC!.getTime();
        // const getTimeEnd = Date.now();
        // console.log('PocketIC time', time);
        // console.log('PocketIC getTime took', getTimeEnd - getTimeStart, 'ms');
        await this.pocketIC!.getTime();
      } catch (error) {
        console.error('Error fetching PocketIC time:', error);
      }
    };

    // Initial invocation
    logPocketICTime();
    // Schedule to run every minute
    // It is important to run every minute to keep the PocketIC running, or it will shutdown without
    setInterval(logPocketICTime, 60 * 1000);

    // Check existing canisters
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
    if (!this.pocketIC || !this.managementCanisterAgent) {
      throw new Error('PocketIC client is not initialized');
    }

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
              `Canister ${canisterId} from core ${name} does not exist in PocketIC. Deleting record...`
            );
            this.coreModel.delete(name);
          }

          //TODO: check if the canister is started and running
        } catch (error) {
          console.error(`Error checking canister ${canisterId} from core ${name}:`, error);
          throw error;
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

  private async uploadWasmInChunks(wasmModule: Buffer, canisterId: string): Promise<chunk_hash[]> {
    if (!this.managementCanisterAgent) {
      throw new Error('PocketIC client is not initialized');
    }

    // Create chunks
    const chunks: Buffer[] = [];
    const wasmArray = new Uint8Array(wasmModule);
    for (let i = 0; i < wasmModule.length; i += this.CHUNK_SIZE) {
      chunks.push(Buffer.from(wasmArray.slice(i, i + this.CHUNK_SIZE)));
    }

    console.log(`Uploading WASM in ${chunks.length} chunks...`);

    // Clear the chunk store
    await this.managementCanisterAgent.clearChunkStore({
      canisterId: Principal.fromText(canisterId),
    });

    // Upload each chunk
    const chunkHashes: chunk_hash[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkHash = await this.managementCanisterAgent.uploadChunk({
        canisterId: Principal.fromText(canisterId),
        chunk: chunks[i],
      });
      chunkHashes.push(chunkHash);
      console.log(`Uploaded chunk ${i + 1}/${chunks.length}`);
    }

    return chunkHashes;
  }

  public async deployCanister({
    canisterId,
    wasmPath,
    wasmModuleHash,
    updateStrategy,
  }: {
    canisterId?: string;
    wasmPath: string;
    wasmModuleHash: string;
    updateStrategy?: UpdateStrategy;
  }): Promise<string> {
    if (!this.managementCanisterAgent) {
      throw new Error('PocketIC client is not initialized');
    }

    if (canisterId && !updateStrategy) {
      try {
        const canisterStatus = await this.managementCanisterAgent.canisterStatus(
          Principal.fromText(canisterId)
        );
        if (canisterStatus) {
          console.log(`Canister ${canisterId} already exists`);
          return canisterId;
        }
      } catch {
        console.log(`Canister ${canisterId} does not exist, creating new one`);
      }
    }

    const identity = IdentityModel.getInstance().getIdentity();

    if (!updateStrategy) {
      // Create canister with initial cycles (1T cycles = 1_000_000_000_000)
      const settings = {
        controllers: [identity.getPrincipal().toText()], // You can customize controllers as needed
        compute_allocation: [], // Optional: Set compute allocation
        memory_allocation: [], // Optional: Set memory allocation
        freezing_threshold: [], // Optional: Set freezing threshold
      };

      //Creating canister with cycles
      const createCanisterResponse =
        await this.managementCanisterAgent.provisionalCreateCanisterWithCycles({
          settings,
          amount: 1_000_000_000_000_000_000n,
        });
      canisterId = createCanisterResponse.toString();
      console.log(`Canister ${canisterId} created with 1T cycles`);
    } else {
      //TODO: add cycles to the canister
    }

    if (!canisterId) {
      throw new Error('Canister ID is not defined');
    }

    const canisterStatus = await this.managementCanisterAgent.canisterStatus(
      Principal.fromText(canisterId)
    );
    console.log('canister status', canisterStatus);

    // Read and upload the wasm code in chunks
    const wasmModule = await fs.promises.readFile(wasmPath);
    const uploadedChunks = await this.uploadWasmInChunks(wasmModule, canisterId);

    // Install the wasm code
    await this.managementCanisterAgent.installChunkedCode({
      targetCanisterId: Principal.fromText(canisterId),
      chunkHashesList: uploadedChunks,
      wasmModuleHash: wasmModuleHash,
      arg: new Uint8Array(), // Empty initialization arguments
      mode: ((): { reinstall: null } | { upgrade: [] } | { install: null } => {
        if (updateStrategy === 'reinstall') {
          return { reinstall: null };
        } else if (updateStrategy === 'upgrade') {
          return { upgrade: [] };
        } else {
          return { install: null };
        }
      })(), // Install mode
    });

    console.log(`Wasm code installed for canister ${canisterId}`);

    const canisterStatusAfterInstall = await this.managementCanisterAgent.canisterStatus(
      Principal.fromText(canisterId)
    );

    if (canisterStatusAfterInstall.module_hash?.[0]) {
      const moduleHash = Buffer.from(canisterStatusAfterInstall.module_hash[0]).toString('hex');
      if (moduleHash !== wasmModuleHash) {
        //TODO: delete the canister
        throw new Error('Wasm module hash does not match uploaded file');
      }
    } else {
      throw new Error('Wasm module was not installed. Module hash not found');
    }

    console.log('canister status after install', canisterStatusAfterInstall);

    return canisterId;
  }

  public async checkCanisterHashAndRunning(
    canisterId: string,
    wasmHash: string
  ): Promise<CanisterStatus> {
    if (!this.managementCanisterAgent) {
      throw new Error('PocketIC client is not initialized');
    }

    try {
      const canisterStatus = await this.managementCanisterAgent.canisterStatus(
        Principal.fromText(canisterId)
      );

      if (
        canisterStatus.module_hash?.[0] &&
        Buffer.from(canisterStatus.module_hash[0]).toString('hex') === wasmHash
      ) {
        const statuses: CanisterStatus[] = ['stopped', 'stopping', 'running'];
        for (const status of statuses) {
          if (status in canisterStatus.status) {
            return status;
          }
        }
      }
      return 'corrupted';
    } catch (error) {
      if (
        error instanceof AgentCallError &&
        error.message.match(/.*?does not belong to any subnet.*/i)
      ) {
        return 'unexisting';
      }
      if (
        typeof (error as { reject_message?: string }).reject_message === 'string' &&
        (error as { reject_message: string }).reject_message.match(/.*?not found.*/i)
      ) {
        return 'unexisting';
      }
      throw error;
    }
  }

  //TODO: restart the canister or delete on corruption
}
