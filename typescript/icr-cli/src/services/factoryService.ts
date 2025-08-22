import { Ed25519KeyIdentity } from '@dfinity/identity';
import { createAgent } from '@dfinity/utils';
import { Actor, ActorSubclass, HttpAgent, Identity } from '@dfinity/agent';
import { _SERVICE, idlFactory } from '../declarations/factory/factory.did';

export class FactoryService {
  private static instances: Record<string, FactoryService> = {};
  private agent: HttpAgent;
  private factoryActor: ActorSubclass<_SERVICE>;

  private constructor(agent: HttpAgent, factoryActor: ActorSubclass<_SERVICE>) {
    this.agent = agent;
    this.factoryActor = factoryActor;
  }

  // Static factory method that can be async
  public static async create(
    identity: Identity,
    picCoreUrl: URL,
    factoryCanisterId: string
  ): Promise<FactoryService> {
    const agent = await createAgent({
      identity,
      host: picCoreUrl.toString(),
    });
    const factoryActor: ActorSubclass<_SERVICE> = Actor.createActor(idlFactory, {
      agent: agent,
      canisterId: factoryCanisterId,
    });

    return new FactoryService(agent, factoryActor);
  }

  public static async getInstance(
    picCoreUrl: URL,
    identity: Ed25519KeyIdentity,
    factoryCanisterId: string
  ): Promise<FactoryService> {
    // Only use host and port from the provided URL to create a unique key for the instance
    const host = picCoreUrl.hostname;
    const port = picCoreUrl.port;
    const key = `${identity.getPrincipal().toString()}@${host}:${port}/${factoryCanisterId}`;
    if (!FactoryService.instances[key]) {
      FactoryService.instances[key] = await FactoryService.create(
        identity,
        picCoreUrl,
        factoryCanisterId
      );
    }
    return FactoryService.instances[key];
  }

  public async createBatch(): Promise<bigint> {
    const batch = await this.factoryActor.create_batch({});
    return batch.batch_id;
  }
}
