export type Entrypoint = EntrypointFabric | EntrypointInstance | EntrypointApplication;

type EntrypointBase = {
	name: string;
	canisterId: string;
	alias: string;
};

export type EntrypointFabric = EntrypointBase & {
	protocol: Protocol.Fabric;
	type: ProtocolType;
};
export type EntrypointInstance = EntrypointBase & {
	protocol: Protocol.Instance;
	type: ProtocolType;
	fabricCanisterId: string;
};
export type EntrypointApplication = EntrypointBase & {
	protocol: Protocol.Application;
};


export enum Protocol {
	Fabric,
	Instance,
	Application
}

export enum ProtocolType {
	Person,
	Company,
	Template,
	AnyContract
}

export interface Role {
	id: string;
	name: string;
	instance: Entrypoint;
}

// TODO вынести в отдельный файл, это про шину
export type ChannelHostMethods = 'requestIdentity' | 'echo' | 'setFrameSize' | 'frame_proxy';

export type ChannelClientMethods = '';
