//! Provider trait architecture — replaces `src/main/providers/BaseProvider.ts`.
//!
//! Each provider type (translate, tts, ocr, segment, dict) implements the
//! `Provider` trait. The `Manager` manages provider lifecycle.

use serde_json::Value;

/// Trait implemented by all providers.
pub trait Provider: Send + Sync {
    /// Unique provider identifier (e.g. "openai", "baiduAi").
    fn id(&self) -> &str;

    /// Human-readable description.
    fn description(&self) -> &str {
        ""
    }

    /// JSON Schema for this provider's options.
    fn options_schema(&self) -> Value;

    /// Default options value.
    fn default_options(&self) -> Value;

    /// Optional descriptions for each option field.
    fn options_description(&self) -> Value {
        Value::Null
    }

    /// Initialize the provider (called once on creation).
    fn init(&mut self) {}

    /// Destroy the provider (called on removal).
    fn destroy(&mut self) {}
}

/// Provider metadata for IPC transfer.
#[derive(serde::Serialize)]
pub struct ProviderMeta {
    pub id: String,
    pub description: String,
    #[serde(rename = "jsonSchema")]
    pub json_schema: Value,
    #[serde(rename = "optionsDescription")]
    pub options_description: Value,
}

impl ProviderMeta {
    pub fn from_provider(p: &dyn Provider) -> Self {
        Self {
            id: p.id().to_string(),
            description: p.description().to_string(),
            json_schema: p.options_schema(),
            options_description: p.options_description(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct MinimalProvider;

    impl Provider for MinimalProvider {
        fn id(&self) -> &str {
            "minimal"
        }

        fn options_schema(&self) -> Value {
            json!({ "type": "object", "properties": {} })
        }

        fn default_options(&self) -> Value {
            json!({})
        }
    }

    #[test]
    fn trait_defaults_are_noop() {
        let mut p = MinimalProvider;
        assert_eq!(p.description(), "");
        assert_eq!(p.options_description(), Value::Null);

        // Default init/destroy must not panic.
        p.init();
        p.destroy();
    }

    #[test]
    fn provider_meta_serializes_with_camel_case_keys() {
        let meta = ProviderMeta::from_provider(&MinimalProvider);
        let value = serde_json::to_value(&meta).unwrap();
        assert_eq!(value["id"], json!("minimal"));
        assert_eq!(value["description"], json!(""));
        assert_eq!(
            value["jsonSchema"],
            json!({ "type": "object", "properties": {} })
        );
        assert_eq!(value["optionsDescription"], Value::Null);
    }
}
