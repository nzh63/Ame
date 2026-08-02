//! Translate providers — replaces `src/main/providers/translate/`.

pub mod anthropic;
pub mod baidu_ai;
pub mod dreye;
#[cfg(debug_assertions)]
pub mod echo;
pub mod jbeijing;
pub mod openai;
pub mod tencent;
pub mod web_scraper;

use serde_json::Value;

/// A translation provider.
pub trait TranslateProvider: Send + Sync {
    /// Unique id.
    fn id(&self) -> &str;
    /// Human-readable description.
    fn description(&self) -> &str {
        ""
    }
    /// JSON Schema for options.
    fn options_schema() -> Value
    where
        Self: Sized;
    /// Default options.
    fn default_options() -> Value
    where
        Self: Sized;
    /// Option field descriptions.
    fn options_description() -> Value
    where
        Self: Sized,
    {
        Value::Null
    }
    /// Whether this provider is enabled in its options.
    fn enabled(&self) -> bool {
        true
    }
    /// Translate text. Returns the translated string.
    fn translate(
        &self,
        text: String,
    ) -> impl std::future::Future<Output = Result<String, String>> + Send;

    /// Translate text with incremental deltas.
    ///
    /// `on_chunk` is invoked for every delta (typically a few tokens); the
    /// returned string is the accumulated translation. The default
    /// implementation yields the whole result of [`translate`] as a single
    /// chunk, so non-streaming providers keep the old behavior. OpenAI and
    /// Anthropic override this to stream SSE deltas, mirroring the Electron
    /// providers (`TranslateManager` accumulates each chunk and emits the
    /// full text on every update).
    fn translate_stream<'a>(
        &'a self,
        text: String,
        mut on_chunk: Box<dyn FnMut(String) + Send + 'a>,
    ) -> impl std::future::Future<Output = Result<String, String>> + Send + 'a {
        async move {
            let out = self.translate(text).await?;
            on_chunk(out.clone());
            Ok(out)
        }
    }
}

/// Consume an SSE byte stream, calling `on_line` for every complete line
/// (newline-terminated). A trailing unterminated line is flushed at EOF.
pub(crate) async fn read_sse_lines<S, E>(
    mut stream: S,
    mut on_line: impl FnMut(&str) -> Result<(), String>,
) -> Result<(), String>
where
    S: futures::Stream<Item = Result<Vec<u8>, E>> + Unpin,
    E: std::fmt::Display,
{
    use futures::StreamExt;
    let mut buf: Vec<u8> = Vec::new();
    loop {
        match stream.next().await {
            Some(Ok(bytes)) => {
                buf.extend_from_slice(&bytes);
                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=pos).collect();
                    on_line(&String::from_utf8_lossy(&line))?;
                }
            }
            Some(Err(e)) => return Err(e.to_string()),
            None => {
                if !buf.is_empty() {
                    on_line(&String::from_utf8_lossy(&buf))?;
                }
                return Ok(());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::translate::{
        anthropic::{Anthropic, AnthropicOptions},
        baidu_ai::{Baidu, BaiduOptions},
        dreye::{DrEye, DrEyeOptions},
        jbeijing::{JBeijing, JBeijingOptions},
        openai::{OpenAi, OpenAiOptions, OpenAiReasoningEffort},
        tencent::{Tencent, TencentOptions},
    };

    /// Every translate provider must expose an object-typed JSON schema with a
    /// `properties` map.
    fn assert_schema_shape(id: &str, schema: &Value) {
        assert_eq!(schema["type"], "object", "{id} schema type");
        assert!(schema["properties"].is_object(), "{id} schema properties");
    }

    #[test]
    fn openai_options_schema_is_valid() {
        assert_schema_shape("openai", &OpenAi::options_schema());
        let opts: OpenAiOptions = serde_json::from_value(OpenAi::default_options()).unwrap();
        assert!(!opts.enable);
        assert_eq!(opts.api_config.base_url, "https://api.openai.com/v1");
        assert_eq!(opts.chat_config.model, "gpt-4");
        assert_eq!(opts.chat_config.max_history, 30);
        assert_eq!(
            opts.chat_config.reasoning_effort,
            OpenAiReasoningEffort::None
        );
    }

    #[test]
    fn anthropic_options_schema_is_valid() {
        assert_schema_shape("anthropic", &Anthropic::options_schema());
        let opts: AnthropicOptions = serde_json::from_value(Anthropic::default_options()).unwrap();
        assert!(!opts.enable);
    }

    #[test]
    fn tencent_options_schema_is_valid() {
        let schema = Tencent::options_schema();
        assert_schema_shape("tencent", &schema);
        assert!(schema["properties"]["apiConfig"].is_object());
        let opts: TencentOptions = serde_json::from_value(Tencent::default_options()).unwrap();
        assert!(opts.enable);
        assert_eq!(opts.api_config.region, "ap-guangzhou");
    }

    #[test]
    fn baidu_options_schema_is_valid() {
        assert_schema_shape("baidu", &Baidu::options_schema());
        let opts: BaiduOptions = serde_json::from_value(Baidu::default_options()).unwrap();
        assert!(opts.enable);
    }

    #[test]
    fn jbeijing_options_schema_is_valid() {
        assert_schema_shape("jbeijing", &JBeijing::options_schema());
        let opts: JBeijingOptions = serde_json::from_value(JBeijing::default_options()).unwrap();
        assert!(opts.enable);
    }

    #[test]
    fn dreye_options_schema_is_valid() {
        assert_schema_shape("dreye", &DrEye::options_schema());
        let opts: DrEyeOptions = serde_json::from_value(DrEye::default_options()).unwrap();
        assert!(opts.enable);
    }

    #[tokio::test]
    async fn read_sse_lines_handles_chunk_boundaries() {
        use futures::stream;
        // SSE 事件被拆成多个网络包（含跨行边界 + EOF 时无换行的残留）。
        let chunks = vec![
            Ok::<_, String>(b"data: {\"a\":1}\n\nda".to_vec()),
            Ok::<_, String>(b"ta: {\"a\":2}".to_vec()),
            Ok::<_, String>(b"\n".to_vec()),
        ];
        let mut lines = Vec::new();
        let result = read_sse_lines(stream::iter(chunks), |line| {
            lines.push(line.to_string());
            Ok(())
        })
        .await;
        assert!(result.is_ok());
        assert_eq!(
            lines,
            vec![
                "data: {\"a\":1}\n",
                // SSE 事件之间的空行同样会回调（provider 侧自行忽略）。
                "\n",
                // 跨包拼接后的完整 data 行。
                "data: {\"a\":2}\n",
            ]
        );
    }

    #[tokio::test]
    async fn read_sse_lines_propagates_stream_errors() {
        use futures::stream;
        let chunks = vec![
            Ok::<_, String>(b"data: x\n".to_vec()),
            Err::<Vec<u8>, _>("connection reset".into()),
        ];
        let result = read_sse_lines(stream::iter(chunks), |_| Ok(())).await;
        assert_eq!(result.unwrap_err(), "connection reset");
    }
}
