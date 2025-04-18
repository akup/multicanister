use candid::{CandidType, Deserialize, Func, Int, Nat, Principal, encode_args};
use ic_cdk::api::{caller, data_certificate, id, set_certified_data, time, trap};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use ic_certified_map::{AsHashTree, Hash, HashTree, RbTree};
use num_traits::ToPrimitive;
use serde::Serialize;
use serde_bytes::ByteBuf;
use sha2::Digest;
use std::cell::RefCell;
use std::collections::HashMap;
use std::convert::TryInto;
use std::ops::Deref;

use crate::registry::authorize::{authorize, is_authorized};
use crate::registry::rc_bytes::RcBytes;
use crate::registry::types_and_args::{Key, WasmAssetMetadata, WasmAssetChunk, CHUNK_SIZE, MAX_WASM_SIZE};
use crate::registry::url_decode::url_decode;

use super::memory_registry::{WASM_ASSETS_METADATA, WASM_ASSETS};

/// The amount of time a batch is kept alive. Modifying the batch
/// delays the expiry further.
const BATCH_EXPIRY_NANOS: u64 = 300_000_000_000;

/// The order in which we pick encodings for certification.
const ENCODING_CERTIFICATION_ORDER: &[&str] = &["identity", "gzip", "compress", "deflate", "br"];

/// The file to serve if the requested file wasn't found.
const INDEX_FILE: &str = "/index.html";

//TODO: переделать на stable_structures
thread_local! {
    static ASSET_STATE: State = State::default();
    static ASSET_HASHES: RefCell<AssetHashes> = RefCell::new(RbTree::new());
}

type AssetHashes = RbTree<Key, Hash>;

struct FabricAssets {
  wizard_assets: HashMap<Key, Asset>, // <путь_к_ассету, Asset>
  canister_assets: HashMap<Key, HashMap<Key, Asset>>, // <Идентификатор_канистры, <путь_к_ассету, Asset>>
  wasms: HashMap<Key, WasmAsset>,
}

#[derive(Default)]
struct State {
  chunks: RefCell<HashMap<ChunkId, Chunk>>,
  next_chunk_id: RefCell<ChunkId>,

  batches: RefCell<HashMap<BatchId, Batch>>,
  next_batch_id: RefCell<BatchId>,
}

#[derive(Default, Clone, Debug, CandidType, Deserialize)]
struct AssetEncoding {
  modified: Timestamp,
  content_chunks: Vec<RcBytes>,
  total_length: usize,
  certified: bool,
  sha256: [u8; 32],
}

#[derive(Default, Clone, Debug, CandidType, Deserialize)]
struct Asset {
  content_type: String,
  encodings: HashMap<String, AssetEncoding>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct WasmAsset {
  modified: Timestamp,
  content_chunks: Vec<RcBytes>,
  total_length: usize,
  sha256: [u8; 32],
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct EncodedAsset {
  content: RcBytes,
  content_type: String,
  content_encoding: String,
  total_length: Nat,
  sha256: Option<ByteBuf>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct AssetDetails {
  key: String,
  content_type: String,
  encodings: Vec<AssetEncodingDetails>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct AssetEncodingDetails {
  content_encoding: String,
  sha256: Option<ByteBuf>,
  length: Nat,
  modified: Timestamp,
}

struct Chunk {
  batch_id: BatchId,
  content: RcBytes,
}

struct Batch {
  chunk_ids: Vec<ChunkId>,
  expires_at: Timestamp,
}

type Timestamp = Int;
type BatchId = Nat;
type ChunkId = Nat;

// IDL Types
#[derive(Clone, Debug, CandidType, Deserialize)]
enum FactoryAssetType {
  Wizard,
  Asset,
  Code,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct CreateRegistryEntryArguments {
  wasm_id: Key,
  batch_id: BatchId,
  total_length: Nat,
  sha256: ByteBuf,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct SetAssetContentArguments {
  wasm_id: Key,
  batch_id: BatchId,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct UnsetAssetContentArguments {
  key: Key,
  content_encoding: String,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct DeleteAssetArguments {
  key: Key,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct ClearArguments {}

#[derive(Clone, Debug, CandidType, Deserialize)]
enum BatchOperation {
  CreateAsset(CreateRegistryEntryArguments),
  SetAssetContent(SetAssetContentArguments),
  UnsetAssetContent(UnsetAssetContentArguments),
  DeleteAsset(DeleteAssetArguments),
  Clear(ClearArguments),
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct CommitBatchArguments {
  batch_id: BatchId,
  operations: Vec<BatchOperation>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct StoreArg {
  key: Key,
  content_type: String,
  content_encoding: String,
  content: ByteBuf,
  sha256: Option<ByteBuf>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct GetArg {
  key: Key,
  accept_encodings: Vec<String>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct GetChunkArg {
  key: Key,
  content_encoding: String,
  index: Nat,
  sha256: Option<ByteBuf>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct GetChunkResponse {
  content: RcBytes,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct CreateBatchResponse {
  batch_id: BatchId,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct CreateChunkArg {
  batch_id: BatchId,
  content: ByteBuf,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct CreateChunkResponse {
  chunk_id: ChunkId,
}
// HTTP interface

type HeaderField = (String, String);

#[derive(Clone, Debug, CandidType, Deserialize)]
struct HttpRequest {
  method: String,
  url: String,
  headers: Vec<(String, String)>,
  body: ByteBuf,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct HttpResponse {
  status_code: u16,
  headers: Vec<HeaderField>,
  body: RcBytes,
  streaming_strategy: Option<StreamingStrategy>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct StreamingCallbackToken {
  key: String,
  content_encoding: String,
  index: Nat,
  // We don't care about the sha, we just want to be backward compatible.
  sha256: Option<ByteBuf>,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
enum StreamingStrategy {
  Callback {
    callback: Func,
    token: StreamingCallbackToken,
  },
}

#[derive(Clone, Debug, CandidType, Deserialize)]
struct StreamingCallbackHttpResponse {
  body: RcBytes,
  token: Option<StreamingCallbackToken>,
}

//#[query]
//fn retrieve(key: Key) -> RcBytes

// #[update(guard = "is_authorized")]
// fn store(arg: StoreArg) {
//   ASSET_STATE.with(move |s| {
//     let mut assets = s.assets.borrow_mut();
//     let asset = assets.entry(arg.key.clone()).or_default();
//     asset.content_type = arg.content_type;

//     let hash = hash_bytes(arg.content.as_ref());
//     if let Some(provided_hash) = arg.sha256 {
//       if &hash != provided_hash.as_ref() {
//         trap("sha256 mismatch");
//       }
//     }

//     let encoding = asset.encodings.entry(arg.content_encoding).or_default();
//     encoding.total_length = arg.content.len();
//     encoding.content_chunks = vec![RcBytes::from(arg.content)];
//     encoding.modified = Int::from(time() as u64);
//     encoding.sha256 = hash;

//     on_asset_change(&arg.key, asset);
//   });
// }

#[update(guard = "is_authorized")]
fn create_batch() -> CreateBatchResponse {
  ic_cdk::print(format!("create_batch by {}", ic_cdk::caller()));
  ASSET_STATE.with(|s| {
    let batch_id = s.next_batch_id.borrow().clone();
    *s.next_batch_id.borrow_mut() += Nat::from(1u64); //+1 increment

    let now = time() as u64;

    let mut expired_chunk_ids: Vec<Nat> = Vec::new();

    let mut batches = s.batches.borrow_mut();
    //Чистим устаревшие батчи
    batches.retain(|_, b| {
      let retain = b.expires_at > now;
      if !retain {
        expired_chunk_ids.extend(b.chunk_ids.clone().into_iter());
      }
      retain  
    });
    //Создаём новый батч
    batches.insert(batch_id.clone(), Batch {
      chunk_ids: vec![],
      expires_at: Int::from(now + BATCH_EXPIRY_NANOS),
    });

    //Чистим чанки из устаревшего батча
    s.chunks
      .borrow_mut()
      .retain(|chunk_id, _| !expired_chunk_ids.contains(chunk_id));

    CreateBatchResponse { batch_id }
  })
}

#[update(guard = "is_authorized")]
fn create_chunk(arg: CreateChunkArg) -> CreateChunkResponse {
  if arg.content.len() > CHUNK_SIZE {
    trap("content too large");
  }
  ASSET_STATE.with(|s| {
    let mut batches = s.batches.borrow_mut();
    let now = time() as u64;
    let batch = batches
      .get_mut(&arg.batch_id)
      .unwrap_or_else(|| trap("batch not found"));
    batch.expires_at = Int::from(now + BATCH_EXPIRY_NANOS);

    let chunk_id = s.next_chunk_id.borrow().clone();
    batch.chunk_ids.push(chunk_id.clone());
    if batch.chunk_ids.len() * CHUNK_SIZE > MAX_WASM_SIZE {
      trap("total wasm size too large");
    }

    *s.next_chunk_id.borrow_mut() += Nat::from(1u64); //+1 increment

    s.chunks.borrow_mut().insert(
      chunk_id.clone(),
      Chunk {
        batch_id: arg.batch_id,
        content: RcBytes::from(arg.content),
      },
    );

    CreateChunkResponse { chunk_id }
  })
}

// #[update(guard = "is_authorized")]
// fn create_asset(arg: CreateAssetArguments) {
//   do_create_asset(arg);
// }

// #[update(guard = "is_authorized")]
// fn set_asset_content(arg: SetAssetContentArguments) {
//   do_set_asset_content(arg);
// }

// #[update(guard = "is_authorized")]
// fn unset_asset_content(arg: UnsetAssetContentArguments) {
//   do_unset_asset_content(arg);
// }

// #[update(guard = "is_authorized")]
// fn delete_content(arg: DeleteAssetArguments) {
//   do_delete_asset(arg);
// }

// #[update(guard = "is_authorized")]
// fn clear() {
//   do_clear();
// }

#[update(guard = "is_authorized")]
fn commit_batch(arg: CommitBatchArguments) {
  let batch_id = arg.batch_id;
  ic_cdk::print(format!("commit_batch by {}", ic_cdk::caller()));
  ic_cdk::print(format!(
    "batch_id {} ops length {}",
    batch_id,
    arg.operations.len()
  ));
  for op in arg.operations {
    match op {
      BatchOperation::CreateAsset(arg) => {
        ic_cdk::print(format!("CreateAsset operation"));
        do_create_asset(arg)
      },
      BatchOperation::SetAssetContent(arg) => {
        ic_cdk::print(format!("SetAssetContent operation"));
        do_set_asset_content(arg)
      }
      BatchOperation::UnsetAssetContent(arg) => {
        ic_cdk::print(format!("UnsetAssetContent operation"));
        //do_unset_asset_content(arg)
      }
      BatchOperation::DeleteAsset(arg) => {
        ic_cdk::print(format!("DeleteAsset operation"));
        //do_delete_asset(arg)
      }
      BatchOperation::Clear(_) => {
        ic_cdk::print(format!("Clear operation"));
        //do_clear()
      }
    }
  }
  ASSET_STATE.with(|s| {
    s.batches.borrow_mut().remove(&batch_id);
  })
}

// #[query]
// fn get(arg: GetArg) -> EncodedAsset {
//   ASSET_STATE.with(|s| {
//     let assets = s.assets.borrow();
//     let asset = assets.get(&arg.key).unwrap_or_else(|| {
//       trap("asset not found");
//     });

//     for enc in arg.accept_encodings.iter() {
//       if let Some(asset_enc) = asset.encodings.get(enc) {
//         return EncodedAsset {
//           content: asset_enc.content_chunks[0].clone(),
//           content_type: asset.content_type.clone(),
//           content_encoding: enc.clone(),
//           total_length: Nat::from(asset_enc.total_length as u64),
//           sha256: Some(ByteBuf::from(asset_enc.sha256)),
//         };
//       }
//     }
//     trap("no such encoding");
//   })
// }

// #[query]
// fn get_chunk(arg: GetChunkArg) -> GetChunkResponse {
//   ASSET_STATE.with(|s| {
//     let assets = s.assets.borrow();
//     let asset = assets
//       .get(&arg.key)
//       .unwrap_or_else(|| trap("asset not found"));

//     let enc = asset
//       .encodings
//       .get(&arg.content_encoding)
//       .unwrap_or_else(|| trap("no such encoding"));

//     if let Some(expected_hash) = arg.sha256 {
//       if expected_hash != enc.sha256 {
//         trap("sha256 mismatch")
//       }
//     }
//     if arg.index >= enc.content_chunks.len() {
//       trap("chunk index out of bounds");
//     }
//     let index: usize = arg.index.0.to_usize().unwrap();

//     GetChunkResponse {
//       content: enc.content_chunks[index].clone(),
//     }
//   })
// }

// fn create_token(
//   _asset: &Asset,
//   enc_name: &str,
//   enc: &AssetEncoding,
//   key: &str,
//   chunk_index: usize,
// ) -> Option<StreamingCallbackToken> {
//   if chunk_index + 1 >= enc.content_chunks.len() {
//     None
//   } else {
//     Some(StreamingCallbackToken {
//       key: key.to_string(),
//       content_encoding: enc_name.to_string(),
//       index: Nat::from(chunk_index + 1),
//       sha256: Some(ByteBuf::from(enc.sha256)),
//     })
//   }
// }

// fn create_strategy(
//   asset: &Asset,
//   enc_name: &str,
//   enc: &AssetEncoding,
//   key: &str,
//   chunk_index: usize,
// ) -> Option<StreamingStrategy> {
//   create_token(asset, enc_name, enc, key, chunk_index).map(|token| StreamingStrategy::Callback {
//     callback: candid::Func {
//       method: "http_request_streaming_callback".to_string(),
//       principal: ic_cdk::id(),
//     },
//     token,
//   })
// }

// fn build_200(
//   asset: &Asset,
//   enc_name: &str,
//   enc: &AssetEncoding,
//   key: &str,
//   chunk_index: usize,
//   certificate_header: Option<HeaderField>,
// ) -> HttpResponse {
//   let mut headers = vec![("Content-Type".to_string(), asset.content_type.to_string())];
//   if enc_name != "identity" {
//     headers.push(("Content-Encoding".to_string(), enc_name.to_string()));
//   }
//   if let Some(head) = certificate_header {
//     headers.push(head);
//   }

//   let streaming_strategy = create_strategy(asset, enc_name, enc, key, chunk_index);

//   HttpResponse {
//     status_code: 200,
//     headers,
//     body: enc.content_chunks[chunk_index].clone(),
//     streaming_strategy,
//   }
// }

// fn build_404(certificate_header: HeaderField) -> HttpResponse {
//   HttpResponse {
//     status_code: 404,
//     headers: vec![certificate_header],
//     body: RcBytes::from(ByteBuf::from("not found")),
//     streaming_strategy: None,
//   }
// }

// fn build_http_response(path: &str, encodings: Vec<String>, index: usize) -> HttpResponse {
//   ASSET_STATE.with(|s| {
//     let assets = s.assets.borrow();

//     let index_redirect_certificate = ASSET_HASHES.with(|t| {
//       let tree = t.borrow();
//       if tree.get(path.as_bytes()).is_none() && tree.get(INDEX_FILE.as_bytes()).is_some() {
//         let absence_proof = tree.witness(path.as_bytes());
//         let index_proof = tree.witness(INDEX_FILE.as_bytes());
//         let combined_proof = merge_hash_trees(absence_proof, index_proof);
//         Some(witness_to_header(combined_proof))
//       } else {
//         None
//       }
//     });

//     if let Some(certificate_header) = index_redirect_certificate {
//       if let Some(asset) = assets.get(INDEX_FILE) {
//         for enc_name in encodings.iter() {
//           if let Some(enc) = asset.encodings.get(enc_name) {
//             if enc.certified {
//               return build_200(
//                 asset,
//                 enc_name,
//                 enc,
//                 INDEX_FILE,
//                 index,
//                 Some(certificate_header),
//               );
//             }
//           }
//         }
//       }
//     }

//     let certificate_header =
//       ASSET_HASHES.with(|t| witness_to_header(t.borrow().witness(path.as_bytes())));

//     if let Some(asset) = assets.get(path) {
//       for enc_name in encodings.iter() {
//         if let Some(enc) = asset.encodings.get(enc_name) {
//           if enc.certified {
//             return build_200(asset, enc_name, enc, path, index, Some(certificate_header));
//           } else {
//             // Find if identity is certified, if it's not.
//             if let Some(id_enc) = asset.encodings.get("identity") {
//               if id_enc.certified {
//                 return build_200(asset, enc_name, enc, path, index, Some(certificate_header));
//               }
//             }
//           }
//         }
//       }
//     }

//     build_404(certificate_header)
//   })
// }

// #[query]
// fn http_request(req: HttpRequest) -> HttpResponse {
//   let mut encodings = vec![];
//   for (name, value) in req.headers.iter() {
//     if name.eq_ignore_ascii_case("Accept-Encoding") {
//       for v in value.split(',') {
//         encodings.push(v.trim().to_string());
//       }
//     }
//   }
//   encodings.push("identity".to_string());

//   let path = match req.url.find('?') {
//     Some(i) => &req.url[..i],
//     None => &req.url[..],
//   };

//   build_http_response(&url_decode(&path), encodings, 0)
// }

// #[query]
// fn http_request_streaming_callback(
//   StreamingCallbackToken {
//     key,
//     content_encoding,
//     index,
//     sha256,
//   }: StreamingCallbackToken,
// ) -> StreamingCallbackHttpResponse {
//   ASSET_STATE.with(|s| {
//     let assets = s.assets.borrow();
//     let asset = assets
//       .get(&key)
//       .expect("Invalid token on streaming: key not found.");
//     let enc = asset
//       .encodings
//       .get(&content_encoding)
//       .expect("Invalid token on streaming: encoding not found.");

//     if let Some(expected_hash) = sha256 {
//       if expected_hash != enc.sha256 {
//         trap("sha256 mismatch");
//       }
//     }

//     // MAX is good enough. This means a chunk would be above 64-bits, which is impossible...
//     let chunk_index = index.0.to_usize().unwrap_or(usize::MAX);

//     StreamingCallbackHttpResponse {
//       body: enc.content_chunks[chunk_index].clone(),
//       token: create_token(&asset, &content_encoding, enc, &key, chunk_index),
//     }
//   })
// }

fn do_create_asset(arg: CreateRegistryEntryArguments) {
  ic_cdk::print("do_create_asset");
  
  let wasm_metadata = WasmAssetMetadata {
    modified: time() as u64,
    total_length: arg.total_length.0.to_usize().unwrap_or_else(|| trap("total_length too large for usize")),
    sha256: arg.sha256.into_vec().try_into().unwrap_or_else(|_| trap("invalid SHA-256 length")),
  };
  WASM_ASSETS_METADATA.with(|s| {
    s.borrow_mut().insert(arg.wasm_id, wasm_metadata);
  });
}

fn do_set_asset_content(arg: SetAssetContentArguments) {
  ic_cdk::print("do_set_asset_content");

  //Проверяем, что все чанки существуют и не превышают размер
  ASSET_STATE.with(|s| {
    let mut batches = s.batches.borrow_mut();
    let batch = batches
      .get(&arg.batch_id)
      .unwrap_or_else(|| trap("batch not found"));

    let mut chunks = s.chunks.borrow_mut();
    let mut has_bad_chunks = false;
    let mut last_chunk = false;
    let mut collected_chunks = vec![];
    let mut total_length = 0;
    let mut hasher = sha2::Sha256::new();
    batch.chunk_ids.iter().for_each(|chunk_id| {
      if let Some(chunk) = chunks.get(chunk_id) {
        if chunk.content.len() < CHUNK_SIZE {
          //Только последний чанк может быть меньше CHUNK_SIZE
          if last_chunk {
            has_bad_chunks = true;
          }
          last_chunk = true;
        }
        total_length += chunk.content.len();
        hasher.update(&chunk.content);
        collected_chunks.push(chunk);
      } else {
        has_bad_chunks = true;
      }
    });

    let sha256: [u8; 32] = hasher.finalize().into();

    let mut has_sha_error = false;
    WASM_ASSETS_METADATA.with(|wam| {
      let wasm_metadata = wam.borrow()
          .get(&arg.wasm_id)
          .unwrap_or_else(|| trap("wasm metadata not found"));
      if wasm_metadata.total_length != total_length || wasm_metadata.sha256 != sha256 {
        has_sha_error = true;
      }
    });

    if has_bad_chunks || has_sha_error {
      batch.chunk_ids.iter().for_each(|chunk_id| {
        chunks.remove(chunk_id);
      });
      batches.remove(&arg.batch_id);
      trap(if has_bad_chunks { "bad chunks" } else { "sha256 mismatch" });
    }

    WASM_ASSETS.with(|wa| {
      let mut wasm_assets = wa.borrow_mut();
      let mut chunk_index = 0;
      //заполняем чанки в stable memory
      collected_chunks.iter().for_each(|chunk| {
        let mut chunk_content = [0u8; CHUNK_SIZE];
        chunk_content.copy_from_slice(&chunk.content);
        wasm_assets.insert((arg.wasm_id.clone(), chunk_index), WasmAssetChunk {
          content: chunk_content,
          length: chunk.content.len(),
        });
        chunk_index += 1;
      });

      //очищаем лишние чанки в stable memory, если они есть
      loop {
        let wasm_key = (arg.wasm_id.clone(), chunk_index);
        if wasm_assets.contains_key(&wasm_key) {
          wasm_assets.remove(&wasm_key);
        } else {
          break;
        }
        chunk_index += 1;
      }
    });

    //Очищаем чанки во временном кеше
    batch.chunk_ids.iter().for_each(|chunk_id| {
      chunks.remove(chunk_id);
    });
    batches.remove(&arg.batch_id);
  });
}

// fn do_unset_asset_content(arg: UnsetAssetContentArguments) {
//   ASSET_STATE.with(|s| {
//     let mut assets = s.assets.borrow_mut();
//     let asset = assets
//       .get_mut(&arg.key)
//       .unwrap_or_else(|| trap("asset not found"));

//     if asset.encodings.remove(&arg.content_encoding).is_some() {
//       on_asset_change(&arg.key, asset);
//     }
//   })
// }

// fn do_delete_asset(arg: DeleteAssetArguments) {
//   ASSET_STATE.with(|s| {
//     let mut assets = s.assets.borrow_mut();
//     assets.remove(&arg.key);
//   });
//   delete_asset_hash(&arg.key);
// }

fn do_clear() {}

// fn on_asset_change(key: &str, asset: &mut Asset) {
//   // If the most preferred encoding is present and certified,
//   // there is nothing to do.
//   for enc_name in ENCODING_CERTIFICATION_ORDER.iter() {
//     if let Some(enc) = asset.encodings.get(*enc_name) {
//       if enc.certified {
//         return;
//       } else {
//         break;
//       }
//     }
//   }

//   if asset.encodings.is_empty() {
//     delete_asset_hash(key);
//     return;
//   }

//   // An encoding with a higher priority was added, let's certify it
//   // instead.

//   for enc in asset.encodings.values_mut() {
//     enc.certified = false;
//   }

//   for enc_name in ENCODING_CERTIFICATION_ORDER.iter() {
//     if let Some(enc) = asset.encodings.get_mut(*enc_name) {
//       certify_asset(key.to_string(), &enc.sha256);
//       enc.certified = true;
//       return;
//     }
//   }

//   // No known encodings found. Just pick the first one. The exact
//   // order is hard to predict because we use a hash map. Should
//   // almost never happen anyway.
//   if let Some(enc) = asset.encodings.values_mut().next() {
//     certify_asset(key.to_string(), &enc.sha256);
//     enc.certified = true;
//   }
// }

// fn certify_asset(key: Key, content_hash: &Hash) {
//   ASSET_HASHES.with(|t| {
//     let mut tree = t.borrow_mut();
//     tree.insert(key, *content_hash);
//     set_root_hash(&*tree);
//   });
// }

// fn delete_asset_hash(key: &str) {
//   ASSET_HASHES.with(|t| {
//     let mut tree = t.borrow_mut();
//     tree.delete(key.as_bytes());
//     set_root_hash(&*tree);
//   });
// }

// fn set_root_hash(tree: &AssetHashes) {
//   use ic_certified_map::labeled_hash;
//   let full_tree_hash = labeled_hash(b"http_assets", &tree.root_hash());
//   set_certified_data(&full_tree_hash);
// }

// fn witness_to_header<'a>(witness: HashTree<'a>) -> HeaderField {
//   use ic_certified_map::labeled;

//   let hash_tree = labeled(b"http_assets", witness);
//   let mut serializer = serde_cbor::ser::Serializer::new(vec![]);
//   serializer.self_describe().unwrap();
//   hash_tree.serialize(&mut serializer).unwrap();

//   let certificate = data_certificate().unwrap_or_else(|| trap("no data certificate available"));

//   (
//     "IC-Certificate".to_string(),
//     String::from("certificate=:")
//       + &base64::encode(&certificate)
//       + ":, tree=:"
//       + &base64::encode(&serializer.into_inner())
//       + ":",
//   )
// }

// fn merge_hash_trees<'a>(lhs: HashTree<'a>, rhs: HashTree<'a>) -> HashTree<'a> {
//   use HashTree::{Empty, Fork, Labeled, Leaf, Pruned};

//   match (lhs, rhs) {
//     (Pruned(l), Pruned(r)) => {
//       if l != r {
//         trap("merge_hash_trees: inconsistent hashes");
//       }
//       Pruned(l)
//     }
//     (Pruned(_), r) => r,
//     (l, Pruned(_)) => l,
//     (Fork(l), Fork(r)) => {
//       let (l1, l2) = *l;
//       let (r1, r2) = *r;

//       Fork(Box::new((
//         merge_hash_trees(l1, r1),
//         merge_hash_trees(l2, r2),
//       )))
//     }
//     (Labeled(l_label, l), Labeled(r_label, r)) => {
//       if l_label != r_label {
//         trap("merge_hash_trees: inconsistent hash tree labels");
//       }
//       Labeled(l_label, Box::new(merge_hash_trees(*l, *r)))
//     }
//     (Empty, Empty) => Empty,
//     (Leaf(l), Leaf(r)) => {
//       if l != r {
//         trap("merge_hash_trees: inconsistent leaves");
//       }
//       Leaf(l)
//     }
//     (_l, _r) => {
//       trap("merge_hash_trees: inconsistent tree structure");
//     }
//   }
// }

// fn hash_bytes(bytes: &[u8]) -> Hash {
//   let mut hash = sha2::Sha256::new();
//   hash.update(bytes);
//   hash.finalize().into()
// }

#[init]
fn init() {
  do_clear();
  authorize(caller());
}
