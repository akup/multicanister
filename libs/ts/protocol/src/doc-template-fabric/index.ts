export * from './doc-template-fabric.did';
// @ts-expect-error
import { idlFactory } from './doc-template-fabric.did.js';

export const idl = idlFactory;