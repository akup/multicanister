export * from './doc-template.did';
// @ts-expect-error
import { idlFactory } from './doc-template.did.js';

export const idl = idlFactory;