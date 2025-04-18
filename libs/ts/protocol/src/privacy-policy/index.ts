export * from './privacy-policy.did';
// @ts-expect-error
import { idlFactory } from './privacy-policy.did.js';

export const idl = idlFactory;
