declare interface Controller {}

declare const process: {
	env: {
		[key: string]: any;
	};
};

// TODO сделать билд через esbuild. Это позволит не копировать исходники II сюда, а сделать нормальный бандл