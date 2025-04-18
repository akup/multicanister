import path from 'path';
import fs from 'fs';

export const getCanisterIds = (projectPath: string, port?: number) => {
	const canisters = getCanisters(projectPath);
	const network = process.env.DFX_NETWORK || 'local';

	const values: Record<string, any> = {};
	for (const canister in canisters) {
		const name = canister.toUpperCase().replace(/-/g, '_');
		values[`${name}_CANISTER_ID`] = {
			id: canisters[canister][network],
			port,
		};
	}
	
	return values;
};

type Network = string;
type CanisterId = string;
const getCanisters = (projectPath: string): Record<Network, CanisterId>[] => {
	let localCanisters, prodCanisters, canisters;
	
	try {
		const file = fs.readFileSync(path.resolve(projectPath, '.dfx', 'local', 'canister_ids.json')).toString();
		localCanisters = JSON.parse(file);
	} catch (error) {
		console.warn('No local canister_ids.json found. Continuing production');
	}
	
	try {
		const file = fs.readFileSync(path.resolve(projectPath, "canister_ids.json")).toString();
		prodCanisters = JSON.parse(file);
	} catch (error) {
		console.warn("No production canister_ids.json found. Continuing with local");
	}
	
	const network = process.env.DFX_NETWORK || 'local';
	
	console.log('NETWORK', network);
	
	canisters = network === "local" ? localCanisters : prodCanisters;
	return canisters;
};