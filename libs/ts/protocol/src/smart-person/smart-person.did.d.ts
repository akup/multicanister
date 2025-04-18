import type { Principal } from '@dfinity/principal';
export interface RemoveRequest {
  id: Array<number>;
}
export interface RemoveResponse {
  data: Array<number>;
}
export interface RetrieveRequest {
  id: Array<number>;
}
export interface RetrieveResponse {
  data: [] | [Array<number>];
}
export interface StoreRequest {
  id: Array<number>;
  data: Array<number>;
}
export interface _SERVICE {
  remove: (arg_0: RemoveRequest) => Promise<RemoveResponse>;
  retrieve: (arg_0: RetrieveRequest) => Promise<RetrieveResponse>;
  store: (arg_0: StoreRequest) => Promise<undefined>;
}
