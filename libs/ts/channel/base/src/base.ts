import {
	JSONRPCServerAndClient,
	JSONRPCClient,
	JSONRPCServer,
	isJSONRPCRequest,
	isJSONRPCResponse,
	JSONRPCParams,
} from 'json-rpc-2.0';
import {JSONRPCMessage, ClientParams, ServerParams, ChannelGateway} from './types';

export interface ChannelBaseOpts {
	name: string;
}

export class ChannelBase<C extends string, S extends string> implements ChannelGateway<C> {
	protected jsonRPC: JSONRPCServerAndClient<ServerParams, ClientParams> | null;
	protected opts: ChannelBaseOpts;

	constructor(opts: ChannelBaseOpts) {
		this.jsonRPC = new JSONRPCServerAndClient<ServerParams, ClientParams>(
			new JSONRPCServer(),
			new JSONRPCClient(this.sendRequest),
		);

		this.opts = opts;

		window.addEventListener('message', this.onMessage);
	}

	public request(method: C, params: JSONRPCParams = {}, clientParams: ClientParams = {}): PromiseLike<any> {
		if (this.jsonRPC === null) {
			throw new Error('JSONRPC client was destroyed');
		}
		return this.jsonRPC.request(method, params, clientParams);
	}

	private sendRequest = async (message: JSONRPCMessage, params?: ClientParams): Promise<void> => {
		if (!params) {
			throw new Error('No request params');
		}

		let wnd = params.source; // make response

		if (!wnd) { // make manual request
			
			if (params.target == 'child') {
				const elem: HTMLIFrameElement | null = document.querySelector(params.selector);
				wnd = elem?.contentWindow;
			} else {
				const target = params.target || 'top';
				
				wnd = window[target]; // TODO пробросить сюда launcher canister URL
			}
		}

		if (!wnd) {
			throw new Error('No target window to postMessage');
		}

		// console.log(`\x1b[92m${this.opts.name} отправил сообщение`, message, params);

		// @ts-expect-error
		wnd.postMessage(message, '*');
	};

	// TODO нужно шифрование на шине
	private onMessage = async (e: MessageEvent) => {
		let message = e.data;

		if (!isJSONRPCRequest(message) && !isJSONRPCResponse(message)) {
			return;
		}

		if (this.jsonRPC === null) {
			throw new Error('JSONRPC client was destroyed');
		}

		console.log(`\x1b[92m${this.opts.name} получил сообщение от`, e.origin, e.data);

		const client: ClientParams = {
			source: e.source,
		};
		const server: ServerParams = {
			origin: e.origin,
			source: e.source,
		};
		return this.jsonRPC.receiveAndSend(message, server, client);
	};

	public addMethod = (method: S, handler: (params: any | undefined, serverParams: ServerParams | undefined) => any) =>
		this.jsonRPC?.addMethod(method, handler);
}

