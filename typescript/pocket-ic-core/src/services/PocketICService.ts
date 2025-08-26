import { spawn } from 'child_process';
import { CoreModel } from '~/models/CoreModel';
import { ApplicationSubnetConfig, PocketIc, SubnetStateType } from '@repo/pic';
import { ICManagementCanister } from '@dfinity/ic-management';
import { createAgent } from '@dfinity/utils';
import { Principal } from '@dfinity/principal';
import { CreateInstanceRequest } from '@repo/pic/src/pocket-ic-client-types';
import { IdentityModel } from '~/models/IdentityModel';
import * as fs from 'fs';
import { AgentCallError, Actor, ActorSubclass, HttpAgent } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';

const POCKET_IC_TIMEOUT = 10000;

export type UpdateStrategy = 'upgrade' | 'reinstall';
export type CanisterStatus = 'stopped' | 'stopping' | 'running' | 'corrupted' | 'unexisting';

const MGMT_PRINCIPAL = Principal.fromText('aaaaa-aa');

const EFFECTIVE_FALLBACK = process.env.EFFECTIVE_CANISTER_ID_FALLBACK
  ? Principal.fromText(process.env.EFFECTIVE_CANISTER_ID_FALLBACK)
  : Principal.fromText('rwlgt-iiaaa-aaaaa-aaaaa-cai');

// Minimal management canister IDL with the methods we use.
// We rely on Candid width subtyping: it's safe to list only the fields we read.
const mgmtIdl: IDL.InterfaceFactory = ({ IDL }) =>
  IDL.Service({
    create_canister: IDL.Func(
      [
        IDL.Record({
          settings: IDL.Opt(
            IDL.Record({
              controllers: IDL.Opt(IDL.Vec(IDL.Principal)),
              compute_allocation: IDL.Opt(IDL.Nat),
              memory_allocation: IDL.Opt(IDL.Nat),
              freezing_threshold: IDL.Opt(IDL.Nat),
              reserved_cycles_limit: IDL.Opt(IDL.Nat),
            })
          ),
        }),
      ],
      [IDL.Record({ canister_id: IDL.Principal })],
      []
    ),

    provisional_create_canister_with_cycles: IDL.Func(
      [IDL.Record({})],
      [IDL.Record({ canister_id: IDL.Principal })],
      [] // update
    ),

    canister_status: IDL.Func(
      [IDL.Record({ canister_id: IDL.Principal })],
      [
        IDL.Record({
          status: IDL.Variant({ running: IDL.Null, stopping: IDL.Null, stopped: IDL.Null }),
          module_hash: IDL.Opt(IDL.Vec(IDL.Nat8)),
        }),
      ],
      ['query']
    ),

    clear_chunk_store: IDL.Func([IDL.Record({ canister_id: IDL.Principal })], [], []),
    upload_chunk: IDL.Func(
      [IDL.Record({ canister_id: IDL.Principal, chunk: IDL.Vec(IDL.Nat8) })],
      [IDL.Record({ hash: IDL.Vec(IDL.Nat8) })],
      []
    ),
    install_chunked_code: IDL.Func(
      [
        IDL.Record({
          target_canister: IDL.Principal,
          chunk_hashes_list: IDL.Vec(IDL.Vec(IDL.Nat8)),
          wasm_module_hash: IDL.Vec(IDL.Nat8),
          arg: IDL.Vec(IDL.Nat8),
          mode: IDL.Variant({
            install: IDL.Null,
            reinstall: IDL.Null,
            upgrade: IDL.Opt(IDL.Vec(IDL.Principal)),
          }),
          sender_canister_version: IDL.Opt(IDL.Nat64),
        }),
      ],
      [],
      []
    ),
  });

type Opt<T> = [] | [T];

interface MgmtCreateCanisterSettings {
  controllers?: Opt<Principal[]>; // Opt<Vec<Principal>>
  compute_allocation?: Opt<bigint>; // Opt<Nat>
  memory_allocation?: Opt<bigint>; // Opt<Nat>
  freezing_threshold?: Opt<bigint>; // Opt<Nat>
  reserved_cycles_limit?: Opt<bigint>; // Opt<Nat>
}

interface MgmtService {
  provisional_create_canister_with_cycles: (arg: {}) => Promise<{ canister_id: Principal }>;
}

export class PocketICService {
  private static instance: PocketICService;
  private pocketICProcess: ReturnType<typeof spawn> | null = null;
  private pocketIC: PocketIc | null = null;
  private managementCanisterAgent: ICManagementCanister | null = null;
  private agent: HttpAgent | null = null;
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
    proc.on('exit', async () => {
      console.error('PocketIC process exited!!!');
      await this.stop();
      process.exit(1);
    });
    process.on('uncaughtException', async () => {
      console.error('Uncaught exception');
      await this.stop();
    });
    process.on('SIGINT', async () => {
      console.error('SIGINT');
      await this.stop();
    });
    process.on('SIGTERM', async () => {
      console.error('SIGTERM');
      await this.stop();
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
    await this.pocketIC.makeLive(gwPort);
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
    this.agent = agent as HttpAgent;
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

  private getMgmtActor(): ActorSubclass<MgmtService> {
    if (!this.agent) throw new Error('Agent is not initialized');
    return Actor.createActor<MgmtService>(mgmtIdl, {
      agent: this.agent,
      canisterId: MGMT_PRINCIPAL,
      callTransform: (method, args, config) => {
        // Try to extract a target canister id from args
        const a = (args && (args as any[])[0]) || {};
        const fromArgs =
          a?.canister_id ||
          a?.target_canister ||
          a?.target_canister_id ||
          a?.canisterId ||
          a?.targetCanisterId;

        // Prefer the provided effectiveCanisterId, else fall back to arg-derived, else global fallback
        const eci = (config as any)?.effectiveCanisterId ?? fromArgs ?? EFFECTIVE_FALLBACK;

        // Log the method and the final ECI used
        try {
          console.log(`[MGMT] ${String(method)} -> ECI=${(eci as Principal).toText()}`);
        } catch {
          /* ignore */
        }

        return { ...(config ?? {}), effectiveCanisterId: eci };
      },
    });
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
    if (!this.agent) throw new Error('Agent is not initialized');
    const mgmt = this.getMgmtActor();

    const res = await mgmt.provisional_create_canister_with_cycles({});

    const canId = res.canister_id.toText();
    console.log(`Canister ${canId} created.`);
    return canId;
  }

  private async uploadWasmInChunks(wasmModule: Buffer, canisterId: string): Promise<Uint8Array[]> {
    if (!this.agent) throw new Error('Agent is not initialized');
    const mgmt = this.getMgmtActor();
    const id = Principal.fromText(canisterId);

    // Clear chunk store for target canister
    await (mgmt as any).clear_chunk_store({ canister_id: id });

    // Split and upload chunks
    const chunks: Buffer[] = [];
    const wasmArray = new Uint8Array(wasmModule);
    for (let i = 0; i < wasmModule.length; i += this.CHUNK_SIZE) {
      chunks.push(Buffer.from(wasmArray.slice(i, i + this.CHUNK_SIZE)));
    }
    console.log(`Uploading WASM in ${chunks.length} chunks...`);

    const chunkHashes: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const result = await (mgmt as any).upload_chunk({ canister_id: id, chunk: chunks[i] });
      chunkHashes.push(result.hash);
      console.log(`Uploaded chunk ${i + 1}/${chunks.length}`);
    }
    return chunkHashes;
  }

  public async installCode({
    canisterId,
    wasmModule,
    wasmModuleHash,
    updateStrategy,
    initArg,
  }: {
    canisterId: string;
    wasmModule: Buffer;
    wasmModuleHash: string;
    updateStrategy?: UpdateStrategy;
    initArg?: Buffer;
  }): Promise<void> {
    if (!this.agent) throw new Error('Agent is not initialized');
    const mgmt = this.getMgmtActor();
    const id = Principal.fromText(canisterId);

    const uploadedChunks = await this.uploadWasmInChunks(wasmModule, canisterId);
    const wasmHashBlob = Uint8Array.from(Buffer.from(wasmModuleHash, 'hex'));

    await (mgmt as any).install_chunked_code({
      target_canister: id,
      chunk_hashes_list: uploadedChunks,
      wasm_module_hash: wasmHashBlob,
      arg: initArg ? new Uint8Array(initArg) : new Uint8Array(),
      mode: updateStrategy === 'reinstall' ? { reinstall: null } : { upgrade: [] },
      sender_canister_version: [],
    });

    console.log(`Wasm code installed for canister ${canisterId}`);

    // === Temporary disabling because of the bug in gateway-pocketIC connection ===
    // const st = await (mgmt as any).canister_status({ canister_id: id });
    // if (st.module_hash?.[0]) {
    //   const moduleHash = Buffer.from(st.module_hash[0]).toString('hex');
    //   if (moduleHash !== wasmModuleHash)
    //     throw new Error('Wasm module hash does not match uploaded file');
    // } else {
    //   throw new Error('Wasm module was not installed. Module hash not found');
    // }
  }

  public async checkCanisterHashAndRunning(
    canisterId: string,
    wasmHash: string
  ): Promise<CanisterStatus> {
    if (!this.agent) throw new Error('Agent is not initialized');
    const mgmt = this.getMgmtActor();
    const id = Principal.fromText(canisterId);

    const st = await (mgmt as any).canister_status({ canister_id: id });
    if (st.module_hash?.[0] && Buffer.from(st.module_hash[0]).toString('hex') === wasmHash) {
      if ('running' in st.status) return 'running';
      if ('stopping' in st.status) return 'stopping';
      if ('stopped' in st.status) return 'stopped';
    }
    return 'corrupted';
  }

  //TODO: restart the canister or delete on corruption
}
