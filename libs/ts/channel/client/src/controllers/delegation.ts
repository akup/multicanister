import { blobFromUint8Array, derBlobFromBlob } from '@dfinity/candid';
import {
  DelegationChain,
  Ed25519KeyIdentity,
  Delegation,
  DelegationIdentity,
} from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import { services } from '@validation-poc/toolkit';
import { AgentController } from '../agent'; // FIXME  это неверная зависимость, исправить
import { Channel, ClientParams } from '@validation-poc/channel-base';

export interface SetIdentityPayload {
  delegations: {
    delegation: {
      pubkey: Uint8Array;
      expiration: bigint;
      targets?: Principal[];
    };
    signature: Uint8Array;
  }[];
  userPublicKey: Uint8Array;
  sessionIdentity: any; // JsonnableEd25519KeyIdentity
}

export interface DelegationControllerProps {
  agent: AgentController;
  canisterId: string;
}

export class DelegationController implements Controller {
  delegation: DelegationChain | null = null;
  identity: DelegationIdentity | null = null;
  agentController: AgentController;
  opts: DelegationControllerProps;

  constructor(
    public gateway: Channel<any, any>,
    opts: DelegationControllerProps
  ) {
    this.opts = opts;
    this.agentController = opts.agent;
  }

  public requestAuth = async (params: ClientParams = { target: 'top' }) => {
    const payload: SetIdentityPayload = await this.gateway.request(
      'requestIdentity',
      { canisterId: this.opts.canisterId },
      params
    );
    await this.setIdentity(payload);
  };

  public setIdentity = async (payload: SetIdentityPayload) => {
    const { identity, delegation } = this.constructIdentity(payload);

    this.identity = identity;
    this.delegation = delegation;

    const agent = await services.getAgent({ identity });
    this.agentController.setAgent(agent); // FIXMe этому тут не место
  };

  public isAuthentificated = async () => {
    if (!this.identity) {
      return false;
    }
    return !this.identity.getPrincipal().isAnonymous() && this.delegation !== null;
  };

  private constructIdentity = (payload: SetIdentityPayload) => {
    const sessionIdentity = Ed25519KeyIdentity.fromParsedJson(payload.sessionIdentity);

    const delegations = payload.delegations.map(d => ({
      delegation: new Delegation(
        blobFromUint8Array(d.delegation.pubkey),
        d.delegation.expiration,
        d.delegation.targets
      ),
      signature: blobFromUint8Array(d.signature),
    }));
    const delegationChain = DelegationChain.fromDelegations(
      delegations,
      derBlobFromBlob(blobFromUint8Array(payload.userPublicKey))
    );
    const identity = DelegationIdentity.fromDelegation(sessionIdentity, delegationChain);

    return {
      identity,
      delegation: delegationChain,
    };
  };
}
