import {Actor, Identity} from '@dfinity/agent';
import {Ed25519KeyIdentity} from '@dfinity/identity';
import { ServerParams } from '@validation-poc/channel-base';
// import {IIConnection} from '../../../../../../projects/launcher/internet-identity/src/frontend/src/utils/iiConnection';
import {IIConnection} from '../.shared/src/utils/iiConnection';
// TODO переместить II в корень проекта

const ANCHOR_STORAGE_KEY = 'anchor';
export class DelegationController implements Controller {
	identity: Identity | undefined;
	connection: IIConnection | null = null;
	registrations: Record<string, MessageEventSource | null> = {};
	_anchorId: string = '';
	private delegating = false;

	get anchorId() {
		const anchor = localStorage.getItem(ANCHOR_STORAGE_KEY) as string;
		this._anchorId = anchor || '';
		return this._anchorId;
	}

	public requestIdentity = async ({canisterId}: {canisterId: string}, params?: ServerParams) => {
		if (!params?.origin) {
			throw new Error('Unable to get "origin" from ServerParams');
		}
		if (!canisterId) {
			throw new Error('Unable to get canisterId from requestIdentity request');
		}

		this.registrations[canisterId] = params.source;

		if (!this.connection) {
			this.processLogin(this.anchorId);
		}
		await this.waitConnection();

		return await this.createIdentity(params.origin);
	};

	public setIdentity = (identity: Identity | undefined) => {
		this.identity = identity;
	};

	public processLogin = async (anchor: string) => {
		this.setAnchorId(anchor);
		if (this.anchorId) {
			await this.delegateMasterKey();
		}
	};

	public processLogout = async () => {
		this.setAnchorId('');
	};

	private setAnchorId = (anchor: string) => {
		localStorage.setItem(ANCHOR_STORAGE_KEY, anchor);
		this._anchorId = anchor;
	}

	private delegateMasterKey = async () => {
		try {
			if (this.delegating) {
				await this.waitConnection();
				return;
			}
			
			this.delegating = true;
			const result = await IIConnection.login(BigInt(this.anchorId));
			if (result.kind !== 'loginSuccess') {
				console.log('!!!', result);
				throw 'A1: Unable to login';
			}
		
			if (!result.connection.actor) {
				throw 'A2: Unable to login';
			}

			const agent = Actor.agentOf(result.connection.actor);
			if (!agent) {
				throw 'A3: Unable to login';
			}
		
			// @ts-expect-error
			this.connection = window.connection = result.connection;
			this.delegating = false;
		} catch(e) {
			this.delegating = false;
			throw e;
		}
	}
	
	private createIdentity = async (host: string) => {
		// @ts-expect-error
		const sessionIdentity = window.sessionIdentity = Ed25519KeyIdentity.generate();
		const sessionPubkey = new Uint8Array(sessionIdentity.getPublicKey().toDer());

		if (!this.connection) {
			console.warn('No connection');
			return;
		}
	
		const prepDelegationResponse = await this.connection.prepareDelegation(
			BigInt(this.anchorId),
			host,
			[...sessionPubkey],
		);
	
		const [userPublicKey, timestamp] = prepDelegationResponse;
		const signedDelegation = await this.connection.getDelegation(
			BigInt(this.anchorId),
			host,
			[...sessionPubkey],
			timestamp
		);

		if (!('signed_delegation' in signedDelegation)) {
			console.warn('No signedDelegation');
			return;
		}
		const {signed_delegation} = signedDelegation;

		const parsed_signed_delegation = {
      delegation: {
        pubkey: Uint8Array.from(signed_delegation.delegation.pubkey),
        expiration: BigInt(signed_delegation.delegation.expiration),
        targets: undefined,
      },
      signature: Uint8Array.from(signed_delegation.signature),
    };

    return {
      delegations: [parsed_signed_delegation],
      userPublicKey: Uint8Array.from(userPublicKey),
			sessionIdentity: sessionIdentity.toJSON(),
    };
	}

	private waitConnection = async () => {
		while(!this.connection) {
			await new Promise(r => setTimeout(r, 500));
		}
		return this.connection;
	}
}

