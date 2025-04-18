/// An iterator-like structure that decode a URL.
struct UrlDecode<'a> {
  bytes: std::slice::Iter<'a, u8>,
}

fn convert_percent(iter: &mut std::slice::Iter<u8>) -> Option<u8> {
  let mut cloned_iter = iter.clone();
  let result = match cloned_iter.next()? {
    b'%' => b'%',
    h => {
      let h = char::from(*h).to_digit(16)?;
      let l = char::from(*cloned_iter.next()?).to_digit(16)?;
      h as u8 * 0x10 + l as u8
    }
  };
  // Update this if we make it this far, otherwise "reset" the iterator.
  *iter = cloned_iter;
  Some(result)
}

impl<'a> Iterator for UrlDecode<'a> {
  type Item = char;

  fn next(&mut self) -> Option<Self::Item> {
    let b = self.bytes.next()?;
    match b {
      b'%' => Some(char::from(convert_percent(&mut self.bytes).expect(
        "error decoding url: % must be followed by '%' or two hex digits",
      ))),
      b'+' => Some(' '),
      x => Some(char::from(*x)),
    }
  }

  fn size_hint(&self) -> (usize, Option<usize>) {
    let bytes = self.bytes.len();
    (bytes / 3, Some(bytes))
  }
}

pub fn url_decode(url: &str) -> String {
  UrlDecode {
    bytes: url.as_bytes().into_iter(),
  }
  .collect()
}

#[test]
fn check_url_decode() {
  assert_eq!(url_decode("/%"), "/%");
  assert_eq!(url_decode("/%%"), "/%");
  assert_eq!(url_decode("/%20a"), "/ a");
  assert_eq!(url_decode("/%%+a%20+%@"), "/% a  %@");
  assert_eq!(url_decode("/has%percent.txt"), "/has%percent.txt");
  assert_eq!(url_decode("/%e6"), "/æ");
}
