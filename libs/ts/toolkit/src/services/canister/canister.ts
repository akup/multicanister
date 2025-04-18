import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

export interface EnviromentContext {
  name: string;
}

export interface CanisterProps {
  canisterId: string;
  idl: (p: any) => any;
  agent: HttpAgent;
  context: EnviromentContext;
}

export class Canister<T> {
  readonly canisterId: string;
  readonly idl: (p: any) => any;
  public canister: T;
  public agent: HttpAgent; // FIXME для отладки, не нужно его хранить
  public context: EnviromentContext;

  constructor({ canisterId, idl, agent, context }: CanisterProps) {
    this.context = context;
    this.agent = agent;
    this.canisterId = canisterId;
    this.idl = idl;
    this.canister = this.createActor(agent);
  }

  get principal() {
    return Principal.fromText(this.canisterId);
  }

  public initialize = (agent: HttpAgent): T => {
    this.canister = this.createActor(agent);
    return this.canister;
  };

  public destroy = () => {
    console.warn('Destroy is not implemented');
    // TODO not implemented
  };

  private createActor = (agent: HttpAgent): T => {
    this.agent = agent;
    const actor = Actor.createActor<T>(this.idl, {
      agent,
      canisterId: this.canisterId,
      queryTransform: (methodName, args, config) => {
        console.log(
          `\x1b[92m[${this.context.name}] [query] [${this.canisterId}] ${methodName}`,
          ...args
        );
        return config;
      },
      callTransform: (methodName, args, config) => {
        console.log(
          `\x1b[35m[${this.context.name}] [update] [${this.canisterId}] ${methodName}`,
          ...args
        );
        return config;
      },
    });

    for (const key in actor) {
      if (Object.prototype.hasOwnProperty.call(actor, key)) {
        const element = actor[key];

        if (typeof element == 'function') {
          // @ts-expect-error
          actor[key] = async (...args: any[]) => {
            let response: any;
            try {
              response = await element.call(actor, ...args);
              console.log(
                `\x1b[33m[${this.context.name}] [response] [${this.canisterId}]`,
                response,
                args
              );
            } catch (e) {
              console.log(
                `\x1b[33m[${this.context.name}] [error_response] [${this.canisterId}]`,
                response,
                args,
                e
              );
              throw e;
            }
            return response;
          };
        }
      }
    }

    return actor;
  };
}
