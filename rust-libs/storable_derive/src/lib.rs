use proc_macro::TokenStream;
use quote::quote;

#[proc_macro_derive(SizedStorable)]
pub fn sized_storable_derive(input: TokenStream) -> TokenStream {
  // Construct a representation of Rust code as a syntax tree
  // that we can manipulate
  let ast = syn::parse(input).unwrap();

  // Build the trait implementation
  impl_sized_storable(&ast)
}

fn impl_sized_storable(ast: &syn::DeriveInput) -> TokenStream {
  let name = &ast.ident;
  let gen = quote! {
    impl Storable for #name {
      const BOUND: Bound = Bound::Bounded {
        max_size: size_of::<#name>() as u32,
        is_fixed_size: true,
      };

      fn to_bytes(&self) -> Cow<[u8]> {
        unsafe {
          return Cow::from(std::slice::from_raw_parts(
            self as *const _ as *const u8,
            std::mem::size_of::<#name>(),
          ));
        }
      }

      fn from_bytes(bytes: Cow<'_, [u8]>) -> Self {
        unsafe {
          std::ptr::read_unaligned(bytes.clone().as_ref().as_ptr() as *const #name)
        }
      }
    }
  };
  gen.into()
}
