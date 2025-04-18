export * from './validator-selection.did';
// @ts-expect-error
import { idlFactory } from './validator-selection.did.js';

export const idl = idlFactory;
