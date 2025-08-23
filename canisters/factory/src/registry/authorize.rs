use candid::Principal;
use ic_cdk::api::msg_caller;
use ic_cdk::update;
use super::memory_registry::AUTHORIZED_LIST;

#[update]
pub fn authorize(new_authorized: Principal) -> String {
  ic_cdk::println!("Authorizing user: {}", new_authorized.to_text());
  //TODO: only controller (DAO) can add to authorized list (call this method)
  let caller = msg_caller();
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
    //Temporary authorize the caller
    //TODO: remove this after testing
    caller_authorized = true;
    if caller_authorized && !contains {
      let _ = authorized_list.borrow_mut().push(&new_authorized);
    }
  });
  "Authorized called successfully".to_string()
}

pub fn is_authorized() -> Result<(), String> {
  let caller = msg_caller();
  AUTHORIZED_LIST.with(|authorized_list| {
    authorized_list
      .borrow().iter()
      .any(|p| p == caller)
      .then(|| ())
      .ok_or("Caller is not authorized".to_string())
  })
}
