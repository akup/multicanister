use candid::Nat;
use ic_cdk_macros::{update};

#[update]
fn get(i: Nat) -> String {
  let i_u64 = i.0.to_string();
  ic_cdk::println!("Hello, world!!! {}", i_u64);
  format!("Hello, world! {}", i_u64)
}



