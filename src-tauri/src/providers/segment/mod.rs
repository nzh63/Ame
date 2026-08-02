//! Segment (word segmentation) providers — replaces `src/main/providers/segment/`.
//!
//! `Intl.Segmenter` runs in the frontend; MeCab runs as a subprocess.

use serde_json::Value;

/// A word-segmentation provider.
pub trait SegmentProvider: Send + Sync {
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
    fn options_description() -> Value
    where
        Self: Sized,
    {
        Value::Null
    }
    fn enabled(&self) -> bool {
        true
    }
    /// Segment text into words. Each item is (word, optional extra info).
    fn segment(&self, text: String) -> Vec<(String, Option<String>)>;
}

pub mod mecab;

/// Intl.Segmenter is handled in the frontend; marker for the options UI.
pub struct IntlSegmenter;

impl SegmentProvider for IntlSegmenter {
    fn id(&self) -> &str {
        "intl-segmenter"
    }

    fn description(&self) -> &str {
        "浏览器内置分词 (Intl.Segmenter)"
    }

    fn options_schema() -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "enable": { "type": "boolean", "enum": [true, false], "default": true },
                "language": { "type": "string", "default": "ja" }
            }
        })
    }

    fn default_options() -> Value {
        serde_json::json!({ "enable": true, "language": "ja" })
    }

    fn options_description() -> Value {
        serde_json::json!({ "enable": "启用", "language": "语言" })
    }

    fn segment(&self, _text: String) -> Vec<(String, Option<String>)> {
        // Actual segmentation happens in the frontend via Intl.Segmenter.
        Vec::new()
    }
}
