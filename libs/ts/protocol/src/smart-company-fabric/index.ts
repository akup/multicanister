export * from './smart-company-fabric.did';
// @ts-expect-error
import { idlFactory } from './smart-company-fabric.did.js';

export const idl = idlFactory;
