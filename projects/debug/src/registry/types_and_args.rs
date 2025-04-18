use ic_stable_structures::storable::{Bound, Storable};
use std::borrow::Cow;
use storable_derive::SizedStorable;
use std::mem::size_of;

pub type ChunkKey = (String, u32);

pub const MAX_WASM_SIZE: usize = 1000 * 1024; //10MB
//Размер хранимого чанка
//В стабильной памяти нужно хранить элементы известного размера, чтобы избегать фрагментации памяти
//Все wasm файлы бьются на чанки по 500KB (размер чанка подлежит настройке)
pub const CHUNK_SIZE: usize = 500 * 1024; // 500KB (500 * 1024)

#[derive(Clone, Debug, SizedStorable)]
pub struct WasmAssetMetadata {
  pub modified: u64,
  pub total_length: usize,
  pub sha256: [u8; 32],
}

#[derive(Clone, Debug, SizedStorable)]
pub struct WasmAssetChunk {
  pub content: [u8; CHUNK_SIZE],
  pub length: usize,
}

//TODO: проверить сериализацию и десериализацию и размер