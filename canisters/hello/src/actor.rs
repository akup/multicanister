use ic_cdk_macros::query;

#[query]
fn get() -> String {
  "Hello, world!".to_string()
}



