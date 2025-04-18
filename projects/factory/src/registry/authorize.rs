use candid::Principal;
use ic_cdk::api::caller;
use ic_cdk::update;
use std::cell::RefCell;
use ic_stable_structures::{StableVec, DefaultMemoryImpl};
use ic_stable_structures::memory_manager::{MemoryManager, MemoryId, VirtualMemory};

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

pub static AUTHORIZED_LIST_MEMORY_ID: MemoryId = MemoryId::new(0);

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
}

#[update]
pub fn authorize(new_authorized: Principal) {
  let caller = caller();
  AUTHORIZED_LIST.with(|authorized_list| {
    let mut contains = false;
    let mut caller_authorized = false;
    authorized_list.borrow().iter().for_each(|p| {
      if p == new_authorized {
        contains = true;
      }
      if p == caller {
        caller_authorized = true;
      }
    });
    if caller_authorized && !contains {
      authorized_list.borrow_mut().push(&new_authorized);
    }
  })
}

pub fn is_authorized() -> Result<(), String> {
  let caller = caller();
  AUTHORIZED_LIST.with(|authorized_list| {
    authorized_list
      .borrow().iter()
      .any(|p| p == caller)
      .then(|| ())
      .ok_or("Caller is not authorized".to_string())
  })
}
