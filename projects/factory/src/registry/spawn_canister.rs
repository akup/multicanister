use ic_cdk::update;
use ic_cdk::api::caller;
use candid::Principal;
use utils::deploy_canister_install_code_update_settings;
use super::types_and_args::{Key, ActorConstructorArg};


#[update]
pub async fn spawn(key: Key, constructors: Vec<ActorConstructorArg>) {
  ic_cdk::print(format!("spawn by {}", caller()));

  //TODO: check has access to spawn

  // let mut canisters_to_spawn: Vec<(String, Vec<u8>, Vec<u8>)> = Vec::new();
  // ASSET_STATE.with(|s| {
  //   s.fabric_assets.borrow().get(&key).map(|fabric_assets| {
  //     for (canister_key, wasm) in fabric_assets.wasms.iter() {
  //       if wasm.total_length == 0 {
  //         trap(format!("No wasm for {} {}", &key, canister_key).as_str())
  //       }

  //       ic_cdk::print(format!("spawn instance for {} {}", &key, canister_key));

  //       let arguments = constructors
  //         .iter()
  //         .find(|arg| arg.actor_id == *canister_key)
  //         .map(|arg| arg.constructor_args.clone())
  //         .unwrap_or_else(|| "".to_string());

  //       ic_cdk::print(format!("arguments {}", arguments));

  //       let mut wasm_code: Vec<u8> = Vec::new();
  //       for chunk in &wasm.content_chunks {
  //         wasm_code.extend(chunk.deref())
  //       }

  //       ic_cdk::print(format!(
  //         "wasm length {} {}",
  //         wasm_code.len(),
  //         wasm.total_length
  //       ));

  //       let args = encode_args((arguments,)).unwrap();

  //       canisters_to_spawn.push((canister_key.clone(), wasm_code, args))
  //     }
  //   });
  // });

  // for (canister_key, wasm_code, args) in canisters_to_spawn {
  //   let canister_id =
  //     deploy_canister_install_code_update_settings(caller(), id(), args, wasm_code).await;

  //   ic_cdk::print(format!(
  //     "spawned canister {} {} : {}",
  //     &key, canister_key, canister_id
  //   ));
  // }
}