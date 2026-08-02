//! Hujiang dictionary provider (沪江小D).
//!
//! Opens the word in the system browser at dict.hjenglish.com.

use serde_json::Value;

use super::DictProvider;

pub struct HujiangDict;

impl DictProvider for HujiangDict {
    fn id(&self) -> &str {
        "沪江小D"
    }

    fn description(&self) -> &str {
        "沪江小D"
    }

    fn options_schema() -> Value {
        Value::Null
    }

    fn default_options() -> Value {
        Value::Null
    }

    fn query(&self, word: &str) -> String {
        let encoded = urlencoding(word);
        format!("https://dict.hjenglish.com/jp/jc/{encoded}")
    }
}

#[allow(dead_code)]
fn urlencoding(s: &str) -> String {
    let mut out = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                out.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    out
}
