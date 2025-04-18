export * from './smart-person.did';
// @ts-expect-error
import { idlFactory } from './smart-person.did.js';

export const idl = idlFactory;