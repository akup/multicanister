export * from './smart-person-fabric.did';
// @ts-expect-error
import { idlFactory } from './smart-person-fabric.did.js';

export const idl = idlFactory;