import { Principal } from '@dfinity/principal';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import * as crypto from 'crypto';

export const getPrincipalFromPrivateKey = (privateKey: string): Principal => {
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
    const identity = Ed25519KeyIdentity.fromSecretKey(privateKeyBytes);

    // Get the principal from the identity
    return identity.getPrincipal();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate principal from private key: ${errorMessage}`);
  }
};

// Alternative function for Secp256k1 keys
export const getPrincipalFromSecp256k1PrivateKey = (privateKey: string): Principal => {
  try {
    // Convert private key string to Uint8Array
    let privateKeyBytes: Uint8Array;

    if (privateKey.startsWith('0x')) {
      privateKeyBytes = new Uint8Array(
        privateKey
          .slice(2)
          .match(/.{1,2}/g)
          ?.map(byte => parseInt(byte, 16)) || []
      );
    } else if (privateKey.length === 64) {
      privateKeyBytes = new Uint8Array(
        privateKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
    } else {
      privateKeyBytes = Uint8Array.from(atob(privateKey), c => c.charCodeAt(0));
    }

    // For Secp256k1, you would need to implement the key derivation
    // This is a placeholder - you'd need to add the actual Secp256k1 implementation
    throw new Error('Secp256k1 principal generation not yet implemented');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate Secp256k1 principal from private key: ${errorMessage}`);
  }
};

// Utility function to validate private key format
export const isValidPrivateKey = (privateKey: string): boolean => {
  try {
    if (privateKey.startsWith('0x')) {
      return privateKey.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(privateKey);
    } else if (privateKey.length === 64) {
      return /^[0-9a-fA-F]{64}$/.test(privateKey);
    } else {
      // Try to decode as base64
      atob(privateKey);
      return true;
    }
  } catch {
    return false;
  }
};

// Generate a random 64-byte private key in hex format
export const generatePrivateKey = (): string => {
  const privateKeyBytes = crypto.randomBytes(64);
  return privateKeyBytes.toString('hex');
};
