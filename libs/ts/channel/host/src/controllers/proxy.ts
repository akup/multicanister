import {ServerParams, Channel} from '@validation-poc/channel-base';
import { DelegationController } from './delegation';

export interface ProxyCallPayload {
	target: string;
	method: string;
	payload: any;
}

export class ProxyController implements Controller {
	constructor(private gateway: Channel<any, any>, private delegation: DelegationController) {}

	public proxyCall = async (payload: ProxyCallPayload, _?: ServerParams) => {
		// TODO check here
		const source = this.delegation.registrations[payload.target];
		if (!source) {
			throw new Error('No source in registrations');
		}

		return await this.gateway.request(payload.method, payload.payload, {source});
	};
}
