use candid::{CandidType, Deserialize};
use ic_stable_structures::storable::{Bound, Storable};
use storable_derive::SizedStorable;
use std::borrow::Cow;
use std::mem::size_of;

pub type Key = String;
pub type Timestamp = u64;
pub type ChunkKey = (String, u32);

pub const MAX_WASM_SIZE: usize = 1000 * 1024; //10MB
//Размер хранимого чанка
//В стабильной памяти нужно хранить элементы известного размера, чтобы избегать фрагментации памяти
//Все wasm файлы бьются на чанки по 500KB (размер чанка подлежит настройке)
pub const CHUNK_SIZE: usize = 500 * 1024; // 500KB (500 * 1024)

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct ActorConstructorArg {
  actor_id: Key,
  constructor_args: String,
}

#[derive(Clone, Debug, SizedStorable)]
pub struct WasmAssetMetadataV1 {
  pub modified: Timestamp,
  pub total_length: usize,
  pub sha256: [u8; 32],
}

#[derive(Clone, Debug, SizedStorable)]
pub struct WasmAssetChunkV1 {
  pub content: [u8; CHUNK_SIZE],
  pub length: usize,
}