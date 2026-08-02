//! OpenAI-compatible chat completion provider.

use std::sync::Arc;

use futures::StreamExt;
use parking_lot::Mutex;
use serde::Deserialize;
use serde_json::{json, Value};

use super::TranslateProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: OpenAiApiConfig,
    #[ame]
    #[serde(default)]
    pub chat_config: OpenAiChatConfig,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiApiConfig {
    #[ame(desc = "Base URL")]
    #[serde(rename = "baseURL")]
    #[serde(default = "default_base_url")]
    pub base_url: String,
    #[ame(
        readable = "API Key",
        desc = "OpenAI API 使用的密钥，可在 API Keys 页面获取"
    )]
    #[serde(default)]
    pub api_key: String,
    #[ame(readable = "组织", desc = "指定 API 请求所使用的组织")]
    #[serde(default)]
    pub organization: String,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiChatConfig {
    #[ame(desc = "模型")]
    #[serde(default = "default_model")]
    pub model: String,
    #[ame(desc = "最长历史大小")]
    #[serde(default = "default_max_history")]
    pub max_history: u32,
    #[ame(desc = "System Prompt")]
    #[serde(default = "default_prompt")]
    pub system_prompt: String,
    #[ame(desc = "思考强度")]
    #[serde(default = "default_reasoning_effort")]
    pub reasoning_effort: OpenAiReasoningEffort,
}

/// chat.completions `reasoning_effort` parameter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
pub enum OpenAiReasoningEffort {
    #[default]
    #[serde(rename = "none")]
    None,
    #[serde(rename = "minimal")]
    Minimal,
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "xhigh")]
    XHigh,
}

fn default_base_url() -> String {
    "https://api.openai.com/v1".into()
}
fn default_model() -> String {
    "gpt-4".into()
}
fn default_max_history() -> u32 {
    30
}
fn default_prompt() -> String {
    "请将用户输入的日文翻译为中文".into()
}
fn default_reasoning_effort() -> OpenAiReasoningEffort {
    OpenAiReasoningEffort::default()
}

impl Default for OpenAiOptions {
    fn default() -> Self {
        Self {
            enable: false,
            api_config: OpenAiApiConfig {
                base_url: default_base_url(),
                api_key: String::new(),
                organization: String::new(),
            },
            chat_config: OpenAiChatConfig {
                model: default_model(),
                max_history: default_max_history(),
                system_prompt: default_prompt(),
                reasoning_effort: default_reasoning_effort(),
            },
        }
    }
}

impl Default for OpenAiApiConfig {
    fn default() -> Self {
        Self {
            base_url: default_base_url(),
            api_key: String::new(),
            organization: String::new(),
        }
    }
}

impl Default for OpenAiChatConfig {
    fn default() -> Self {
        Self {
            model: default_model(),
            max_history: default_max_history(),
            system_prompt: default_prompt(),
            reasoning_effort: default_reasoning_effort(),
        }
    }
}

pub struct OpenAi {
    pub options: OpenAiOptions,
    client: reqwest::Client,
    /// Conversation history (system + alternating user/assistant messages),
    /// trimmed to `chatConfig.maxHistory`, mirroring the original provider.
    history: Arc<Mutex<Vec<Value>>>,
    /// 串行化同一 provider 的并发调用（Electron 的 TaskQueue 语义）：
    /// 保证流式期间 history 的 user/assistant 占位不会被并发调用交叉污染。
    call_lock: Arc<tokio::sync::Mutex<()>>,
}

impl OpenAi {
    pub fn new(options: OpenAiOptions) -> Self {
        let history = Arc::new(Mutex::new(vec![json!({
            "role": "system",
            "content": options.chat_config.system_prompt.clone(),
        })]));
        Self {
            options,
            client: reqwest::Client::new(),
            history,
            call_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }
}

impl TranslateProvider for OpenAi {
    fn id(&self) -> &str {
        "OpenAI-Compatible API"
    }

    fn description(&self) -> &str {
        "OpenAI 兼容的 Chat Completion API"
    }

    fn options_schema() -> Value {
        <OpenAiOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(OpenAiOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <OpenAiOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        // 与 Electron 一致：OpenAI 始终走流式路径（非流式调用丢弃增量）。
        self.translate_stream(text, Box::new(|_| {})).await
    }

    async fn translate_stream<'a>(
        &'a self,
        text: String,
        mut on_chunk: Box<dyn FnMut(String) + Send + 'a>,
    ) -> Result<String, String> {
        // 整个流生命周期持有调用锁，避免并发调用交叉污染 history 占位
        // （旧版 TaskQueue 串行化；Rust 端 run_translation 是并行调用的）。
        let _guard = self.call_lock.lock().await;

        // Append the user message and an assistant placeholder, then trim the
        // history so the API call always starts with the system prompt and
        // never exceeds `maxHistory` (old behavior: trim to maxHistory/2,
        // removing user+assistant pairs from the oldest end).
        let messages = {
            let mut history = self.history.lock();
            history.push(json!({ "role": "user", "content": text }));
            history.push(json!({ "role": "assistant", "content": "" }));
            trim_history(&mut history, self.options.chat_config.max_history);
            // The in-flight assistant placeholder is excluded from the request.
            history[..history.len() - 1].to_vec()
        };

        let url = format!(
            "{}/chat/completions",
            self.options.api_config.base_url.trim_end_matches('/')
        );
        let mut body = json!({
            "model": self.options.chat_config.model,
            "messages": messages,
            "stream": true,
        });
        // Only forward reasoning_effort when it is actually set, so standard
        // models (which reject the parameter) keep working.
        if self.options.chat_config.reasoning_effort != OpenAiReasoningEffort::None {
            body["reasoning_effort"] =
                serde_json::to_value(self.options.chat_config.reasoning_effort)
                    .map_err(|e| e.to_string())?;
        }

        let mut request = self
            .client
            .post(&url)
            .bearer_auth(&self.options.api_config.api_key)
            .json(&body);
        if !self.options.api_config.organization.is_empty() {
            request = request.header("OpenAI-Organization", &self.options.api_config.organization);
        }

        let resp = request.send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            self.rollback_history();
            return Err(format!("OpenAI API error ({status}): {text}"));
        }
        let mut content = String::new();
        let result =
            super::read_sse_lines(resp.bytes_stream().map(|r| r.map(|b| b.to_vec())), |line| {
                let line = line.trim();
                let Some(data) = line.strip_prefix("data:") else {
                    return Ok(());
                };
                let data = data.trim();
                if data == "[DONE]" || data.is_empty() {
                    return Ok(());
                }
                if let Some(delta) = openai_content_delta(data) {
                    crate::log_info!("provider", "openai stream delta: {delta:?}");
                    content.push_str(&delta);
                    on_chunk(delta);
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
        // Commit the assistant reply to the history.
        self.commit_history(content.clone());
        Ok(content)
    }
}

/// Extract the `choices[0].delta.content` text delta from one OpenAI SSE
/// `data:` payload. Returns `None` for non-content deltas, `[DONE]` and
/// malformed payloads.
fn openai_content_delta(data: &str) -> Option<String> {
    let v: Value = serde_json::from_str(data).ok()?;
    v["choices"].as_array()?.first()?["delta"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

impl OpenAi {
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

/// Trim conversation history to `max_history`, keeping the system prompt and
/// the in-flight user/assistant pair (mirrors the original `maxHistory`
/// semantics: trim to half and remove user+assistant pairs from the oldest).
fn trim_history(history: &mut Vec<Value>, max_history: u32) {
    if history.len() <= max_history.max(3) as usize || history.len() <= 3 {
        return;
    }
    let target = (max_history / 2).max(3) as usize;
    // Remove complete user+assistant pairs from the oldest end, stopping
    // before the in-flight user/assistant pair is touched (the last two
    // entries must always survive).
    while history.len() - 2 >= target && history.len() - 2 >= 3 {
        history.remove(1); // oldest user message
        history.remove(1); // its assistant reply
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// [system, u1/a1, u2/a2, u3/a3, u4, in-flight assistant].
    fn history() -> Vec<Value> {
        vec![
            json!({ "role": "system", "content": "sys" }),
            json!({ "role": "user", "content": "u1" }),
            json!({ "role": "assistant", "content": "a1" }),
            json!({ "role": "user", "content": "u2" }),
            json!({ "role": "assistant", "content": "a2" }),
            json!({ "role": "user", "content": "u3" }),
            json!({ "role": "assistant", "content": "a3" }),
            json!({ "role": "user", "content": "u4" }),
            json!({ "role": "assistant", "content": "" }),
        ]
    }

    #[test]
    fn trim_history_noop_within_limit() {
        let mut h = history();
        trim_history(&mut h, 30);
        assert_eq!(h.len(), 9);
        assert_eq!(h[1]["content"], "u1");
    }

    #[test]
    fn trim_history_removes_oldest_pairs_keeps_inflight() {
        // maxHistory=8 → target=4: drop u1/a1 + u2/a2, keep u3/a3 + u4 + inflight.
        let mut h = history();
        trim_history(&mut h, 8);
        assert_eq!(h.len(), 5);
        assert_eq!(h[0]["content"], "sys");
        assert_eq!(h[1]["content"], "u3");
        assert_eq!(h[2]["content"], "a3");
        assert_eq!(h[3]["content"], "u4");
        assert_eq!(h[4]["role"], "assistant");
    }

    #[test]
    fn trim_history_small_max_keeps_system_and_inflight_pair() {
        // Even with a tiny maxHistory, the system prompt and the in-flight
        // user/assistant pair must survive (never strip the current request).
        for max in [1u32, 2, 3, 4] {
            let mut h = history();
            trim_history(&mut h, max);
            assert_eq!(h.len(), 3, "maxHistory={max}");
            assert_eq!(h[0]["role"], "system");
            assert_eq!(h[1]["role"], "user");
            assert_eq!(h[1]["content"], "u4");
            assert_eq!(h[2]["role"], "assistant");
        }
    }

    #[test]
    fn trim_history_even_length_never_orphans_assistant() {
        // Even-length history (system + 3 pairs + in-flight): trimming must
        // never leave a stray assistant in place of the current user message.
        let mut h = history();
        h.pop(); // drop the in-flight assistant so len is 8 and all pairs complete
        trim_history(&mut h, 4);
        assert_eq!(h.len(), 4);
        assert_eq!(h[0]["role"], "system");
        assert_eq!(h[1]["role"], "user");
        assert_eq!(h[2]["role"], "assistant");
        assert_eq!(h[3]["role"], "user");
    }

    #[test]
    fn new_provider_seeds_system_message() {
        let provider = OpenAi::new(OpenAiOptions::default());
        let history = provider.history.lock();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0]["role"], "system");
        assert_eq!(
            history[0]["content"],
            OpenAiOptions::default().chat_config.system_prompt
        );
    }

    #[test]
    fn commit_history_fills_assistant_and_rollback_removes_pair() {
        let provider = OpenAi::new(OpenAiOptions::default());
        {
            let mut history = provider.history.lock();
            history.push(json!({ "role": "user", "content": "hello" }));
            history.push(json!({ "role": "assistant", "content": "" }));
        }
        provider.commit_history("こんにちは".into());
        assert_eq!(
            provider.history.lock().last().unwrap()["content"],
            "こんにちは"
        );

        // A failed second call must remove exactly its own user/assistant pair.
        {
            let mut history = provider.history.lock();
            history.push(json!({ "role": "user", "content": "again" }));
            history.push(json!({ "role": "assistant", "content": "" }));
        }
        provider.rollback_history();
        let history = provider.history.lock();
        // system + the committed user/assistant exchange survive.
        assert_eq!(history.len(), 3);
        assert_eq!(history[0]["role"], "system");
        assert_eq!(history[1]["content"], "hello");
        assert_eq!(history[2]["content"], "こんにちは");
    }

    #[test]
    fn openai_content_delta_parses_stream_payloads() {
        // 正常内容增量。
        assert_eq!(
            openai_content_delta(r#"{"choices":[{"delta":{"content":"你"}}]}"#),
            Some("你".into())
        );
        // 多个 choices / role-only delta 不产生内容。
        assert_eq!(
            openai_content_delta(r#"{"choices":[{"delta":{"role":"assistant"}}]}"#),
            None
        );
        // 空 choices、[DONE]、畸形 JSON 均返回 None（调用方跳过）。
        assert_eq!(openai_content_delta(r#"{"choices":[]}"#), None);
        assert_eq!(openai_content_delta("[DONE]"), None);
        assert_eq!(openai_content_delta("not json"), None);
    }
}
