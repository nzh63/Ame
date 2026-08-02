//! Dictionary providers — replaces `src/main/providers/dict/`.
//!
//! Both providers simply open the vendor's dictionary website in the system
//! browser for the given word (no in-app HTTP request).

use serde_json::Value;

/// A dictionary lookup provider. `query` returns the URL to open.
pub trait DictProvider: Send + Sync {
    fn id(&self) -> &str;
    fn description(&self) -> &str {
        ""
    }
    fn options_schema() -> Value
    where
        Self: Sized;
    fn default_options() -> Value
    where
        Self: Sized;
    fn enabled(&self) -> bool {
        true
    }
    /// Build the dictionary URL for the given word.
    fn query(&self, word: &str) -> String;
}

pub mod hujiang;
pub mod youdao;
