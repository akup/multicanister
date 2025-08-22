pub mod management_canister_client;

use crate::management_canister_client::*;
use candid::Principal;
use ic_cdk::api::call::RejectionCode;
use ic_cdk::api::time;
use ic_cdk::{caller, print, trap};
use std::fmt::Debug;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub trait UnwrapOrTrap<T> {
  fn unwrap_or_trap(self) -> T;
  fn unwrap_or_trap_with_msg(self, prefix: Option<&str>, postfix: Option<&str>) -> T;
}

impl<T, E> UnwrapOrTrap<T> for Result<T, E>
where
  E: Debug,
{
  fn unwrap_or_trap(self) -> T {
    self.unwrap_or_else(|e| {
      trap(format!("{:?}", e).as_str());
    })
  }

  fn unwrap_or_trap_with_msg(self, prefix: Option<&str>, postfix: Option<&str>) -> T {
    self.unwrap_or_else(|e| {
      if let Some(pre) = prefix {
        if let Some(post) = postfix {
          trap(format!("{} {:?} {}", pre, e, post).as_str());
        } else {
          trap(format!("{} {:?}", pre, e).as_str());
        }
      } else if let Some(post) = postfix {
        trap(format!("{:?} {}", e, post).as_str());
      } else {
        trap(format!("{:?}", e).as_str());
      }
    })
  }
}

pub trait StringifyErr<T> {
  fn stringify_err(self) -> Result<T, String>;
}

impl<T> StringifyErr<T> for Result<T, (RejectionCode, String)> {
  fn stringify_err(self) -> Result<T, String> {
    self.map_err(|(c, m)| format!("[{:?}] {}", c, m))
  }
}

pub async fn deploy_canister_install_code_update_settings(
  caller: Principal,
  this: Principal,
  args_raw: Vec<u8>,
  wasm: Vec<u8>,
) -> Principal {
  let cycles = 1_000_000_000_000u64;
  let management_canister = Principal::management_canister();

  let (resp,) = management_canister
    .create_canister(CreateCanisterRequest { settings: None }, cycles)
    .await
    .unwrap_or_trap_with_msg(Some("Create canister call failed:"), None);

  management_canister
    .install_code(InstallCodeRequest {
      wasm_module: wasm,
      canister_id: resp.canister_id,
      mode: CanisterInstallMode::Install,
      arg: args_raw,
    })
    .await
    .unwrap_or_trap_with_msg(Some("Install code call failed:"), None);

  management_canister
    .update_settings(UpdateSettingsRequest {
      canister_id: resp.canister_id,
      settings: CanisterSettings {
        controllers: vec![caller, this],
      },
    })
    .await
    .unwrap_or_trap_with_msg(Some("Update settings call failed:"), None);

  resp.canister_id
}

#[inline(always)]
pub fn log(msg: &str) {
  print(format!(
    "{}: [caller: {}]: {}",
    make_time(time()),
    caller(),
    msg
  ))
}

fn make_time(nanos: u64) -> String {
  let d = UNIX_EPOCH + Duration::from_nanos(nanos);
  let secs = d.duration_since(UNIX_EPOCH).unwrap().as_secs();
  format!("{}", secs)
}

#[inline(always)]
pub fn random_principal_test() -> Principal {
  Principal::from_slice(
    &SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap()
      .as_nanos()
      .to_be_bytes(),
  )
}
