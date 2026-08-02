//! Anthropic Messages API provider.

use std::sync::Arc;

use futures::StreamExt;
use parking_lot::Mutex;
use serde::Deserialize;
use serde_json::{json, Value};

use super::TranslateProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Default, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: AnthropicApiConfig,
    #[ame]
    #[serde(default)]
    pub chat_config: AnthropicChatConfig,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicApiConfig {
    #[ame(desc = "Base URL")]
    #[serde(rename = "baseURL", default = "default_base_url")]
    pub base_url: String,
    #[ame(
        readable = "API Key",
        desc = "Anthropic API 密钥，以 X-Api-Key 请求头发送，可在 https://console.anthropic.com/ 获取"
    )]
    #[serde(default)]
    pub api_key: String,
    #[ame(
        readable = "Auth Token",
        desc = "API Key 的替代方案，以 Authorization: Bearer 请求头发送"
    )]
    #[serde(default)]
    pub auth_token: String,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct AnthropicChatConfig {
    #[ame(desc = "模型")]
    #[serde(default = "default_model")]
    pub model: String,
    #[ame(desc = "最长历史大小")]
    #[serde(default = "default_max_history")]
    pub max_history: u32,
    #[ame(desc = "最大 Token 数")]
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[ame(desc = "System Prompt")]
    #[serde(default = "default_prompt")]
    pub system_prompt: String,
    #[ame(
        readable = "思考模式",
        desc = "扩展思考模式：disabled（禁用）、enabled（固定预算）、adaptive（自适应）"
    )]
    #[serde(default)]
    pub thinking_type: AnthropicThinkingType,
    #[ame(
        readable = "思考预算 Token",
        desc = "扩展思考的 Token 预算（仅 enabled 模式下有效，最小 1024）"
    )]
    #[serde(default = "default_thinking_budget")]
    pub thinking_budget_tokens: u32,
    #[ame(
        readable = "输出强度",
        desc = "输出努力程度：low、medium、high、xhigh、max"
    )]
    #[serde(default)]
    pub output_effort: AnthropicOutputEffort,
    #[ame(
        readable = "缓存控制",
        desc = "在 System Prompt 上启用 Ephemeral 缓存控制"
    )]
    #[serde(default)]
    pub cache_control: bool,
}

/// Anthropic extended-thinking mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
pub enum AnthropicThinkingType {
    #[default]
    #[serde(rename = "disabled")]
    Disabled,
    #[serde(rename = "enabled")]
    Enabled,
    #[serde(rename = "adaptive")]
    Adaptive,
}

/// Anthropic output effort level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
pub enum AnthropicOutputEffort {
    #[default]
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "xhigh")]
    XHigh,
    #[serde(rename = "max")]
    Max,
}

fn default_base_url() -> String {
    "https://api.anthropic.com".into()
}
fn default_model() -> String {
    "claude-opus-4-7".into()
}
fn default_max_history() -> u32 {
    30
}
fn default_max_tokens() -> u32 {
    4096
}
fn default_prompt() -> String {
    "请将用户输入的日文翻译为中文".into()
}
fn default_thinking_budget() -> u32 {
    1024
}

impl Default for AnthropicApiConfig {
    fn default() -> Self {
        Self {
            base_url: default_base_url(),
            api_key: String::new(),
            auth_token: String::new(),
        }
    }
}

impl Default for AnthropicChatConfig {
    fn default() -> Self {
        Self {
            model: default_model(),
            max_history: default_max_history(),
            max_tokens: default_max_tokens(),
            system_prompt: default_prompt(),
            thinking_type: AnthropicThinkingType::default(),
            thinking_budget_tokens: default_thinking_budget(),
            output_effort: AnthropicOutputEffort::default(),
            cache_control: false,
        }
    }
}

pub struct Anthropic {
    pub options: AnthropicOptions,
    client: reqwest::Client,
    /// Conversation history (user/assistant pairs), trimmed to `maxHistory`
    /// exactly like the original provider.
    history: Arc<Mutex<Vec<Value>>>,
    /// 串行化同一 provider 的并发调用（Electron 的 TaskQueue 语义）。
    call_lock: Arc<tokio::sync::Mutex<()>>,
}

impl Anthropic {
    pub fn new(options: AnthropicOptions) -> Self {
        Self {
            options,
            client: reqwest::Client::new(),
            history: Arc::new(Mutex::new(Vec::new())),
            call_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }
}

impl TranslateProvider for Anthropic {
    fn id(&self) -> &str {
        "Anthropic Message API"
    }

    fn description(&self) -> &str {
        "Anthropic Messages API（你可能对以下链接感兴趣：https://docs.anthropic.com/en/api/messages）"
    }

    fn options_schema() -> Value {
        <AnthropicOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(AnthropicOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <AnthropicOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        // 与 Electron 一致：Anthropic 始终走流式路径（非流式调用丢弃增量）。
        self.translate_stream(text, Box::new(|_| {})).await
    }

    async fn translate_stream<'a>(
        &'a self,
        text: String,
        mut on_chunk: Box<dyn FnMut(String) + Send + 'a>,
    ) -> Result<String, String> {
        // 整个流生命周期持有调用锁，避免并发调用交叉污染 history 占位。
        let _guard = self.call_lock.lock().await;

        // Append the user message and an assistant placeholder, then trim
        // pairs from the oldest end (old behavior: trim to maxHistory/2).
        let messages = {
            let mut history = self.history.lock();
            history.push(json!({ "role": "user", "content": text }));
            history.push(json!({ "role": "assistant", "content": "" }));
            trim_history(&mut history, self.options.chat_config.max_history);
            history[..history.len() - 1].to_vec()
        };

        let body = build_request_body(&self.options, messages);

        let url = format!(
            "{}/v1/messages",
            self.options.api_config.base_url.trim_end_matches('/')
        );
        let mut request = self
            .client
            .post(&url)
            .header("anthropic-version", "2023-06-01")
            .json(&body);
        if !self.options.api_config.api_key.is_empty() {
            request = request.header("x-api-key", &self.options.api_config.api_key);
        }
        if !self.options.api_config.auth_token.is_empty() {
            request = request.bearer_auth(&self.options.api_config.auth_token);
        }

        let resp = request.send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            self.rollback_history();
            return Err(format!("Anthropic API error ({status}): {text}"));
        }
        let mut content = String::new();
        let result =
            super::read_sse_lines(resp.bytes_stream().map(|r| r.map(|b| b.to_vec())), |line| {
                let line = line.trim();
                let Some(data) = line.strip_prefix("data:") else {
                    return Ok(());
                };
                match anthropic_delta(data.trim()) {
                    // 文本增量计入历史并上报（Electron 语义）。
                    Some(AnthropicDelta::Text(t)) => {
                        crate::log_info!("provider", "anthropic stream text delta: {t:?}");
                        content.push_str(&t);
                        on_chunk(t);
                    }
                    // 思考增量只上报、不计入历史（Electron 只 yield 不累加）。
                    Some(AnthropicDelta::Thinking(t)) => {
                        crate::log_info!("provider", "anthropic stream thinking delta: {t:?}");
                        on_chunk(t);
                    }
                    None => {}
                }
                Ok(())
            })
            .await;
        if let Err(e) = result {
            self.rollback_history();
            return Err(e);
        }
        if content.is_empty() {
            self.rollback_history();
            return Err("No content in response".to_string());
        }
        self.commit_history(content.clone());
        Ok(content)
    }
}

/// One Anthropic SSE `data:` delta we care about.
#[derive(Debug)]
enum AnthropicDelta {
    Text(String),
    Thinking(String),
}

/// Parse a `content_block_delta` payload; `text_delta` → text, `thinking_delta`
/// → thinking. Other event types (start/stop, ping, tool deltas) → `None`,
/// mirroring the Electron provider's event filter.
fn anthropic_delta(data: &str) -> Option<AnthropicDelta> {
    let v: Value = serde_json::from_str(data).ok()?;
    if v["type"].as_str() != Some("content_block_delta") {
        return None;
    }
    match v["delta"]["type"].as_str() {
        Some("text_delta") => v["delta"]["text"]
            .as_str()
            .map(|s| AnthropicDelta::Text(s.to_string())),
        Some("thinking_delta") => v["delta"]["thinking"]
            .as_str()
            .map(|s| AnthropicDelta::Thinking(s.to_string())),
        _ => None,
    }
}

impl Anthropic {
    fn commit_history(&self, content: String) {
        let mut history = self.history.lock();
        if let Some(last) = history.last_mut() {
            last["content"] = Value::String(content);
        }
    }

    fn rollback_history(&self) {
        let mut history = self.history.lock();
        if history.len() >= 2 {
            history.pop();
            history.pop();
        }
    }
}

/// Trim conversation history to `max_history` by removing the oldest
/// user+assistant pairs (mirrors the original `maxHistory` behavior).
fn trim_history(history: &mut Vec<Value>, max_history: u32) {
    if history.len() <= max_history.max(2) as usize || history.len() <= 2 {
        return;
    }
    let target = (max_history / 2).max(2) as usize;
    while history.len() > target {
        history.remove(0); // oldest user message
        if !history.is_empty() {
            history.remove(0); // its assistant reply
        }
    }
}

/// Build the Messages API request body from provider options.
fn build_request_body(options: &AnthropicOptions, messages: Vec<Value>) -> Value {
    let system = if options.chat_config.cache_control {
        json!([{
            "type": "text",
            "text": options.chat_config.system_prompt,
            "cache_control": { "type": "ephemeral" }
        }])
    } else {
        json!(options.chat_config.system_prompt)
    };
    let thinking = match options.chat_config.thinking_type {
        AnthropicThinkingType::Disabled => json!({ "type": "disabled" }),
        AnthropicThinkingType::Enabled => json!({
            "type": "enabled",
            "budget_tokens": options.chat_config.thinking_budget_tokens.max(1024)
        }),
        AnthropicThinkingType::Adaptive => json!({ "type": "adaptive" }),
    };
    let output_config = json!({
        "effort": serde_json::to_value(options.chat_config.output_effort).unwrap()
    });
    json!({
        "model": options.chat_config.model,
        "max_tokens": options.chat_config.max_tokens,
        "system": system,
        "thinking": thinking,
        "output_config": output_config,
        "messages": messages,
        "stream": true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_original_config() {
        let opts = AnthropicOptions::default();
        assert!(!opts.enable);
        assert_eq!(opts.api_config.base_url, "https://api.anthropic.com");
        assert_eq!(opts.chat_config.model, "claude-opus-4-7");
        assert_eq!(opts.chat_config.max_history, 30);
        assert_eq!(opts.chat_config.max_tokens, 4096);
        assert_eq!(
            opts.chat_config.system_prompt,
            "请将用户输入的日文翻译为中文"
        );
        assert_eq!(
            opts.chat_config.thinking_type,
            AnthropicThinkingType::Disabled
        );
        assert_eq!(opts.chat_config.thinking_budget_tokens, 1024);
        assert_eq!(opts.chat_config.output_effort, AnthropicOutputEffort::Low);
        assert!(!opts.chat_config.cache_control);
    }

    #[test]
    fn schema_matches_original_layout() {
        let schema = Anthropic::options_schema();
        let props = schema["properties"].as_object().unwrap();

        let api = &props["apiConfig"]["properties"];
        for key in ["baseURL", "apiKey", "authToken"] {
            assert!(api.get(key).is_some(), "missing apiConfig.{key}");
        }

        let chat = &props["chatConfig"]["properties"];
        for key in [
            "model",
            "maxHistory",
            "maxTokens",
            "systemPrompt",
            "thinkingType",
            "thinkingBudgetTokens",
            "outputEffort",
            "cacheControl",
        ] {
            assert!(chat.get(key).is_some(), "missing chatConfig.{key}");
        }

        // Enum values mirror the original provider options.
        let thinking: Vec<&str> = chat["thinkingType"]["enum"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|v| v.as_str())
            .collect();
        assert_eq!(thinking, vec!["disabled", "enabled", "adaptive"]);
        let effort: Vec<&str> = chat["outputEffort"]["enum"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|v| v.as_str())
            .collect();
        assert_eq!(effort, vec!["low", "medium", "high", "xhigh", "max"]);
    }

    #[test]
    fn trim_history_removes_oldest_pairs_keeps_inflight() {
        let mut history = vec![
            json!({ "role": "user", "content": "u1" }),
            json!({ "role": "assistant", "content": "a1" }),
            json!({ "role": "user", "content": "u2" }),
            json!({ "role": "assistant", "content": "a2" }),
            json!({ "role": "user", "content": "u3" }),
            json!({ "role": "assistant", "content": "" }),
        ];
        trim_history(&mut history, 4); // target=2 → drop u1/a1 + u2/a2
        assert_eq!(history.len(), 2);
        assert_eq!(history[0]["content"], "u3");
        assert_eq!(history[1]["role"], "assistant");
    }

    #[test]
    fn trim_history_tiny_max_keeps_inflight_pair() {
        let history = vec![
            json!({ "role": "user", "content": "u1" }),
            json!({ "role": "assistant", "content": "a1" }),
            json!({ "role": "user", "content": "u2" }),
            json!({ "role": "assistant", "content": "" }),
        ];
        for max in [0u32, 1, 2] {
            let mut h = history.clone();
            trim_history(&mut h, max);
            assert_eq!(h.len(), 2, "maxHistory={max}");
            assert_eq!(h[0]["content"], "u2");
            assert_eq!(h[1]["role"], "assistant");
        }
    }

    #[test]
    fn body_uses_chat_config_and_effort() {
        let mut opts = AnthropicOptions::default();
        opts.chat_config.thinking_type = AnthropicThinkingType::Enabled;
        let body = build_request_body(&opts, vec![]);
        assert_eq!(body["model"], "claude-opus-4-7");
        assert_eq!(body["max_tokens"], 4096);
        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["thinking"]["budget_tokens"], 1024);
        assert_eq!(body["output_config"]["effort"], "low");
    }

    #[test]
    fn thinking_budget_is_never_below_minimum() {
        let mut opts = AnthropicOptions::default();
        opts.chat_config.thinking_type = AnthropicThinkingType::Enabled;
        opts.chat_config.thinking_budget_tokens = 100;
        let body = build_request_body(&opts, vec![]);
        assert_eq!(body["thinking"]["budget_tokens"], 1024);
    }

    #[test]
    fn cache_control_wraps_system_prompt() {
        let mut opts = AnthropicOptions::default();
        opts.chat_config.cache_control = true;
        let body = build_request_body(&opts, vec![]);
        assert!(body["system"].is_array());
        assert_eq!(body["system"][0]["text"], opts.chat_config.system_prompt);
        assert_eq!(body["system"][0]["cache_control"]["type"], "ephemeral");

        opts.chat_config.cache_control = false;
        let body = build_request_body(&opts, vec![]);
        assert!(body["system"].is_string());
    }

    #[test]
    fn body_carries_messages_unchanged() {
        let opts = AnthropicOptions::default();
        let messages = vec![json!({ "role": "user", "content": "hi" })];
        let body = build_request_body(&opts, messages.clone());
        assert_eq!(body["messages"], serde_json::json!(messages));
        // 始终请求流式响应（Electron 语义）。
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn anthropic_delta_parses_stream_events() {
        let text = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好"}}"#;
        match anthropic_delta(text) {
            Some(AnthropicDelta::Text(t)) => assert_eq!(t, "你好"),
            other => panic!("expected text delta, got {other:?}"),
        }

        let thinking = r#"{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"思考中"}}"#;
        match anthropic_delta(thinking) {
            Some(AnthropicDelta::Thinking(t)) => assert_eq!(t, "思考中"),
            other => panic!("expected thinking delta, got {other:?}"),
        }

        // 其他事件（message_start、content_block_start、ping、工具调用）忽略。
        assert!(anthropic_delta(r#"{"type":"message_start","message":{}}"#).is_none());
        assert!(
            anthropic_delta(r#"{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{}"}}"#)
                .is_none()
        );
        assert!(anthropic_delta("not json").is_none());
    }
}
