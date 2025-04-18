import { Principal } from '@dfinity/principal';
import { makeChecks, splitHostnameForCanisterId } from '../sw/http_request';

export const checkCertificatesFromURL = async (url: string) => {
	const response = await checkCertificatesFromRequest(new Request(url));
	return response.status == 200 ? { success: true } : { success: false, data: response };
}

export const checkCertificatesFromRequest = async (request: Request): Promise<Response> => {
	const isLocal = isLocalhost();
	const url = new URL(request.url);

	let maybeCanisterId;
	if (isLocal) {
		const s = request.url.split('canisterId=')[1] || '';
		try {
			maybeCanisterId = Principal.fromText(s.split('&')[0]);
		} catch(_){
			console.warn('Could not parse canister id from local src');
			return new Response('Could not parse canister id from local src', { status: 404 });
		}
	} else {
		maybeCanisterId = (splitHostnameForCanisterId(url.hostname) || [])[0];
	}

	if (!maybeCanisterId) {
		console.warn('Could not parse canister id');
		return new Response('Could not parse canister id', { status: 404 });
	}

	return await makeChecks(request, maybeCanisterId, isLocal);
};

const isLocalhost = () => window.location.href.startsWith('http://localhost') || window.location.href.includes('127.0.0.1');
