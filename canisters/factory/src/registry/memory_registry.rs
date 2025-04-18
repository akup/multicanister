use candid::Principal;
use std::cell::RefCell;
use ic_stable_structures::{StableVec, StableBTreeMap, DefaultMemoryImpl};
use ic_stable_structures::memory_manager::{MemoryManager, MemoryId, VirtualMemory};
use super::types_and_args::{Key, ChunkKey, WasmAssetChunk, WasmAssetMetadata};

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

pub static AUTHORIZED_LIST_MEMORY_ID: MemoryId = MemoryId::new(0);
pub static WASM_ASSETS_METADATA_MEMORY_ID: MemoryId = MemoryId::new(1);
pub static WASM_ASSETS_MEMORY_ID: MemoryId = MemoryId::new(2);

thread_local! {
  pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
      MemoryManager::init(DefaultMemoryImpl::default())
  );

  pub static AUTHORIZED_LIST: RefCell<StableVec<Principal, Memory>>
      = RefCell::new(
      StableVec::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(AUTHORIZED_LIST_MEMORY_ID)),
      ).expect("Failed to initialize AUTHORIZED_LIST")
  );

  pub static WASM_ASSETS_METADATA: RefCell<StableBTreeMap<Key, WasmAssetMetadata, Memory>>
      = RefCell::new(
      StableBTreeMap::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(WASM_ASSETS_METADATA_MEMORY_ID)),
      )
  );
  pub static WASM_ASSETS: RefCell<StableBTreeMap<ChunkKey, WasmAssetChunk, Memory>>
      = RefCell::new(
      StableBTreeMap::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(WASM_ASSETS_MEMORY_ID)),
      )
  );
}