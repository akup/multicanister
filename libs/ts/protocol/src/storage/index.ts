export * from './storage.did';
// @ts-expect-error
import { idlFactory } from './storage.did.js';

export const idl = idlFactory;
