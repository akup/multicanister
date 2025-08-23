use candid::Principal;
use std::cell::RefCell;
use ic_stable_structures::{StableVec, StableBTreeMap, DefaultMemoryImpl};
use ic_stable_structures::memory_manager::{MemoryManager, MemoryId, VirtualMemory};
use super::types_and_args::{Key, ChunkKey, WasmAssetChunkV1, WasmAssetMetadataV1};

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

//All ids should be with version suffix ${ID}_V1
//It is important to use different memory ids for different versions of the same data structure
//This is because the memory id is used to identify the data structure in the memory
//If we use the same memory id for different versions, the data structure will be overwritten
//We need to increment version only when Storable::BOUND is changed to handle size difference of a stored structures
pub static AUTHORIZED_LIST_MEMORY_ID_V1: MemoryId = MemoryId::new(0);
pub static WASM_ASSETS_METADATA_MEMORY_ID_V1: MemoryId = MemoryId::new(1);
pub static WASM_ASSETS_MEMORY_ID_V1: MemoryId = MemoryId::new(2);

thread_local! {
  pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
      MemoryManager::init(DefaultMemoryImpl::default())
  );

  pub static AUTHORIZED_LIST: RefCell<StableVec<Principal, Memory>>
      = RefCell::new(
      StableVec::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(AUTHORIZED_LIST_MEMORY_ID_V1)),
      ).expect("Failed to initialize AUTHORIZED_LIST")
  );

  pub static WASM_ASSETS_METADATA: RefCell<StableBTreeMap<Key, WasmAssetMetadataV1, Memory>>
      = RefCell::new(
      StableBTreeMap::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(WASM_ASSETS_METADATA_MEMORY_ID_V1)),
      )
  );
  pub static WASM_ASSETS: RefCell<StableBTreeMap<ChunkKey, WasmAssetChunkV1, Memory>>
      = RefCell::new(
      StableBTreeMap::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(WASM_ASSETS_MEMORY_ID_V1)),
      )
  );
}