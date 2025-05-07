use candid::Nat;
use ic_cdk_macros::query;
use ic_cdk::println;

#[query]
fn get(i: Nat) -> String {
  println!("Hello, world ! {}", i);
  "Hello, world!".to_string()
}



