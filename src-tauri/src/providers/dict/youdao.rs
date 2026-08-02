//! Youdao dictionary provider (有道词典).
//!
//! Opens the word in the system browser at dict.youdao.com.

use serde_json::Value;

use super::DictProvider;

pub struct YoudaoDict;

impl DictProvider for YoudaoDict {
    fn id(&self) -> &str {
        "有道词典"
    }

    fn description(&self) -> &str {
        "有道词典"
    }

    fn options_schema() -> Value {
        Value::Null
    }

    fn default_options() -> Value {
        Value::Null
    }

    fn query(&self, word: &str) -> String {
        let encoded = urlencoding(word);
        format!("https://dict.youdao.com/w/jap/{encoded}")
    }
}

/// Minimal percent-encoding for URL path segments.
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
