import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Identity } from '@dfinity/agent';

export const getIdentityFromPrivateKey = (privateKey: string): Identity => {
  try {
    // Convert private key string to Uint8Array
    // Assuming the private key is in hex format or base64
    let privateKeyBytes: Uint8Array;

    if (privateKey.startsWith('0x')) {
      // Hex format
      privateKeyBytes = new Uint8Array(
        privateKey
          .slice(2)
          .match(/.{1,2}/g)
          ?.map(byte => parseInt(byte, 16)) || []
      );
    } else if (privateKey.length === 64) {
      // Raw hex without 0x prefix
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
    } else {
      // Try base64
      privateKeyBytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
    }

    // Create Ed25519 identity from private key
    return Ed25519KeyIdentity.fromSecretKey(privateKeyBytes);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate identity from private key: ${errorMessage}`);
  }
};

// Generate a random 64-byte private key in hex format
export const generatePrivateKey = (): string => {
  const identity = Ed25519KeyIdentity.generate();
  const privateKeyBytes = identity.getKeyPair().secretKey;
  console.log('Generated principal', identity.getPrincipal().toString());
  console.log('Generated public key', identity.getPublicKey());
  return Buffer.from(privateKeyBytes).toString('hex');
};
