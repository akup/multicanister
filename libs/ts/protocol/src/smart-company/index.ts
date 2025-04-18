export * from './smart-company.did';
// @ts-expect-error
import { idlFactory } from './smart-company.did.js';

export const idl = idlFactory;
