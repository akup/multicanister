import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

/**
 * -------------------- CERTIFIED ASSETS TYPES -------------------
 */
export type BatchId = bigint;
export type BatchOperationKind =
  | { CreateAsset: CreateAssetArguments }
  | { UnsetAssetContent: UnsetAssetContentArguments }
  | { DeleteAsset: DeleteAssetArguments }
  | { SetAssetContent: SetAssetContentArguments }
  | { Clear: ClearArguments };
export interface Challenge {
  reveal_fields: Uint32Array | number[];
  doc_template_principal: Principal;
}
export type ChunkId = bigint;
/**
 * Reset everything
 */
export type ClearArguments = {};
export interface CreateAssetArguments {
  key: Key;
  content_type: string;
  actor_id: [] | [Key];
  app_id: Key;
  factory_asset_type: FactoryAssetType;
}
/**
 * Delete an asset
 */
export interface DeleteAssetArguments {
  key: Key;
}
export type FactoryAssetType = { Code: null } | { Wizard: null } | { Asset: null };
/**
 * ----------------- CUSTOM TYPES ------------------
 */
export type FieldId = number;
export type HeaderField = [string, string];
export interface HttpRequest {
  url: string;
  method: string;
  body: Uint8Array | number[];
  headers: Array<HeaderField>;
}
export interface HttpResponse {
  body: Uint8Array | number[];
  headers: Array<HeaderField>;
  streaming_strategy: [] | [StreamingStrategy];
  status_code: number;
}
export type Key = string;
/**
 * Add or change content for an asset, by content encoding
 */
export interface SetAssetContentArguments {
  key: Key;
  sha256: [] | [Uint8Array | number[]];
  actor_id: [] | [Key];
  app_id: Key;
  chunk_ids: Array<ChunkId>;
  content_encoding: string;
  factory_asset_type: FactoryAssetType;
}
export interface StreamingCallbackHttpResponse {
  token: [] | [StreamingCallbackToken];
  body: Uint8Array | number[];
}
export interface StreamingCallbackToken {
  key: Key;
  sha256: [] | [Uint8Array | number[]];
  index: bigint;
  content_encoding: string;
}
export type StreamingStrategy = {
  Callback: {
    token: StreamingCallbackToken;
    callback: [Principal, string];
  };
};
export type Time = bigint;
/**
 * Remove content for an asset, by content encoding
 */
export interface UnsetAssetContentArguments {
  key: Key;
  content_encoding: string;
}
export interface _SERVICE {
  /**
   * ------------------ AUTHORIZATION APIS ------------------
   * Adds a principal to the authorized list
   */
  authorize: ActorMethod<[Principal], string>;
  clear: ActorMethod<[ClearArguments], undefined>;
  /**
   * Perform all operations successfully, or reject
   */
  commit_batch: ActorMethod<
    [{ batch_id: BatchId; operations: Array<BatchOperationKind> }],
    undefined
  >;
  create_asset: ActorMethod<[CreateAssetArguments], undefined>;
  create_batch: ActorMethod<[{}], { batch_id: BatchId }>;
  create_chunk: ActorMethod<
    [{ content: Uint8Array | number[]; batch_id: BatchId }],
    { chunk_id: ChunkId }
  >;
  delete_asset: ActorMethod<[DeleteAssetArguments], undefined>;
  /**
   * ------------------ CERTIFIED_ASSETS APIS ------------------
   */
  get: ActorMethod<
    [{ key: Key; accept_encodings: Array<string> }],
    {
      content: Uint8Array | number[];
      sha256: [] | [Uint8Array | number[]];
      content_type: string;
      content_encoding: string;
      total_length: bigint;
    }
  >;
  /**
   * if get() returned chunks > 1, call this to retrieve them.
   * chunks may or may not be split up at the same boundaries as presented to create_chunk().
   */
  get_chunk: ActorMethod<
    [
      {
        key: Key;
        sha256: [] | [Uint8Array | number[]];
        index: bigint;
        content_encoding: string;
      },
    ],
    { content: Uint8Array | number[] }
  >;
  http_request: ActorMethod<[HttpRequest], HttpResponse>;
  http_request_streaming_callback: ActorMethod<
    [StreamingCallbackToken],
    [] | [StreamingCallbackHttpResponse]
  >;
  list: ActorMethod<
    [{}],
    Array<{
      key: Key;
      encodings: Array<{
        modified: Time;
        sha256: [] | [Uint8Array | number[]];
        length: bigint;
        content_encoding: string;
      }>;
      content_type: string;
    }>
  >;
  set_asset_content: ActorMethod<[SetAssetContentArguments], undefined>;
  spawn: ActorMethod<[Key, Array<{ actor_id: Key; constructor_args: string }>], undefined>;
  /**
   * Single call to create an asset with content for a single content encoding that
   * fits within the message ingress limit.
   */
  store: ActorMethod<
    [
      {
        key: Key;
        content: Uint8Array | number[];
        sha256: [] | [Uint8Array | number[]];
        content_type: string;
        content_encoding: string;
      },
    ],
    undefined
  >;
  unset_asset_content: ActorMethod<[UnsetAssetContentArguments], undefined>;
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
