//! TTS providers — replaces `src/main/providers/tts/`.
//!
//! The primary TTS engine is the Web Speech Synthesis API, which runs in the
//! frontend (WebView2). Rust-side providers are reserved for system TTS.

use serde_json::Value;

/// A text-to-speech provider.
pub trait TtsProvider: Send + Sync {
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
    /// Speak the given text. Returns when speech completes or is interrupted.
    fn speak(&self, text: String) -> impl std::future::Future<Output = Result<(), String>> + Send;
}

/// Web Speech Synthesis is handled entirely in the frontend; this is a marker
/// so the provider list can advertise it for the options UI.
pub struct WebSpeechSynthesisApi;

impl TtsProvider for WebSpeechSynthesisApi {
    fn id(&self) -> &str {
        "WebSpeechSynthesisApi"
    }

    fn description(&self) -> &str {
        "浏览器语音合成 (Web Speech Synthesis API)"
    }

    fn options_schema() -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "enable": { "type": "boolean", "enum": [true, false], "default": true },
                "voice": {
                    "type": "object",
                    "properties": {
                        "originalVoiceURI": { "type": ["string", "null"], "default": null },
                        "translateVoiceURI": { "type": ["string", "null"], "default": null }
                    }
                }
            }
        })
    }

    fn default_options() -> Value {
        serde_json::json!({
            "enable": true,
            "voice": { "originalVoiceURI": null, "translateVoiceURI": null }
        })
    }

    fn options_description() -> Value {
        serde_json::json!({
            "enable": "启用",
            "voice": { "originalVoiceURI": "源语言语音", "translateVoiceURI": "翻译语言语音" }
        })
    }

    async fn speak(&self, _text: String) -> Result<(), String> {
        // Actual speech happens in the frontend via window.speechSynthesis.
        Ok(())
    }
}
