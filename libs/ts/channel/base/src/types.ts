import { JSONRPCParams, JSONRPCRequest, JSONRPCResponse } from 'json-rpc-2.0';

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse;

export type ClientParams = {
  source?: MessageEventSource | null;
} & (ClientChildParams | ClientParentParams);

type ClientChildParams = {
  target?: 'child';
  selector: string;
};

type ClientParentParams = {
  target?: 'top' | 'parent' | 'opener';
};

export type ServerParams = {
  origin: string;
  source: MessageEventSource | null;
};

export interface ChannelGateway<C extends string> {
  request(method: C, params?: JSONRPCParams, clientParams?: ClientParams): PromiseLike<any>;
}
