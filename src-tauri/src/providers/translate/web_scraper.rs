//! Web-scraping translate providers (腾讯翻译君, 有道翻译).
//!
//! The original implementation drives the vendors' public websites inside a
//! hidden Electron BrowserWindow via DOM manipulation + MutationObserver.
//!
//! In Tauri the faithful equivalent is a hidden `WebviewWindow` into which we
//! inject JavaScript via `evaluate_script`. Because each site has bespoke DOM
//! structure, we keep a small per-site script. These providers require a live
//! webview and therefore a Tauri `AppHandle`; they are constructed lazily.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Listener, Manager, WebviewUrl, WebviewWindowBuilder};

use super::TranslateProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct WebScraperOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame(desc = "源语言")]
    #[serde(default)]
    pub from_language: String,
    #[ame(desc = "目标语言")]
    #[serde(default)]
    pub to_language: String,
}

impl Default for WebScraperOptions {
    fn default() -> Self {
        Self {
            enable: true,
            from_language: String::new(),
            to_language: String::new(),
        }
    }
}

/// Which site this scraper drives.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ScraperSite {
    QqFanyi,
    YoudaoFanyi,
}

impl ScraperSite {
    fn url(self) -> String {
        match self {
            ScraperSite::QqFanyi => "https://fanyi.qq.com/".into(),
            // 经典文本翻译页（#/TextTranslate），输入后自动翻译，结果在
            // #js_fanyi_output。主站首页已改版为 AI 对话界面，不再适合脚本驱动。
            ScraperSite::YoudaoFanyi => "https://fanyi.youdao.com/index.html#/TextTranslate".into(),
        }
    }

    fn id(self) -> &'static str {
        match self {
            ScraperSite::QqFanyi => "腾讯翻译君",
            ScraperSite::YoudaoFanyi => "有道翻译",
        }
    }

    #[allow(dead_code)]
    fn default_from(self) -> &'static str {
        match self {
            ScraperSite::QqFanyi | ScraperSite::YoudaoFanyi => "日语",
        }
    }

    #[allow(dead_code)]
    fn default_to(self) -> &'static str {
        match self {
            ScraperSite::QqFanyi => "简体中文",
            ScraperSite::YoudaoFanyi => "中文",
        }
    }

    /// JavaScript that sets the input text, triggers translation, and emits
    /// the result back to Rust via a Tauri event (`scraper-result`).
    fn translate_script(self, text: &str, event_id: &str) -> String {
        let escaped = json!(text).to_string();
        let event_id = json!(event_id).to_string();
        // Helper that resolves with the translated text, then emits it.
        let emit = r#"
            const __emit = (value) => {
                if (window.__AME_EMIT__) { window.__AME_EMIT__(__ID, value); }
            };
        "#
        .replace("__ID", &event_id);

        let body = match self {
            ScraperSite::YoudaoFanyi => format!(
                r#"
                    // 有道经典文本翻译页：在 #js_fanyi_input 写入文本后自动翻译，
                    // 结果出现在 #js_fanyi_output（末尾带一行来源说明，取首行）。
                    const input = document.querySelector('#js_fanyi_input');
                    if (!input) {{ __emit(''); return; }}
                    input.focus();
                    document.execCommand('insertText', false, {escaped});
                    const t0 = Date.now();
                    const poll = () => {{
                        const out = document.querySelector('#js_fanyi_output');
                        const text = out ? out.innerText.trim() : '';
                        if (text && text !== {escaped}) {{
                            const firstLine = text.split('\n')[0].trim();
                            __emit(firstLine);
                            return;
                        }}
                        if (Date.now() - t0 > 10000) {{ __emit(''); return; }}
                        setTimeout(poll, 300);
                    }};
                    poll();
                "#
            ),
            ScraperSite::QqFanyi => format!(
                r#"
                    const input = document.querySelector('.translate-content .content-left .tea-textarea');
                    if (!input) {{ __emit(''); return; }}
                    input.value = {escaped};
                    input.dispatchEvent(new Event('compositionstart'));
                    input.dispatchEvent(new Event('compositionend'));
                    const box = document.querySelector('.translate-content .content-right .target-text-box');
                    const obs = new MutationObserver(() => {{
                        const nodes = document.querySelectorAll('.translate-content .content-right .target-text-box');
                        const text = Array.from(nodes).map(n => n.innerText).join('');
                        const placeholder = nodes[0] && nodes[0].querySelector('.placeholder');
                        if (text.trim() && !placeholder) {{ obs.disconnect(); __emit(text); }}
                    }});
                    if (box && box.parentElement) obs.observe(box.parentElement, {{ childList: true, subtree: true }});
                    setTimeout(() => {{
                        const nodes = document.querySelectorAll('.translate-content .content-right .target-text-box');
                        const placeholder = nodes[0] && nodes[0].querySelector('.placeholder');
                        __emit(placeholder ? '' : Array.from(nodes).map(n => n.innerText).join(''));
                    }}, 8000);
                "#
            ),
        };

        format!("(async () => {{ {emit} {body} }})()")
    }
}

pub struct WebScraper {
    pub site: ScraperSite,
    pub options: WebScraperOptions,
    app: AppHandle,
    /// 同一站点的隐藏窗口是共享资源：并行翻译会互相覆盖输入框、结果事件
    /// 也可能错配到另一条请求（run_translation 对多个 key 是并发分发的）。
    /// 整个 translate 期间持锁串行化（与 OpenAI/Anthropic 的 call_lock 同理）。
    call_lock: std::sync::Arc<tokio::sync::Mutex<()>>,
}

impl WebScraper {
    pub fn new(site: ScraperSite, options: WebScraperOptions, app: AppHandle) -> Self {
        Self {
            site,
            options,
            app,
            call_lock: std::sync::Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    fn window_label(&self) -> String {
        format!("scraper-{}", self.site.id())
    }

    async fn ensure_window(&self) -> Result<tauri::WebviewWindow, String> {
        let label = self.window_label();
        if let Some(w) = self.app.get_webview_window(&label) {
            return Ok(w);
        }
        let url = self.site.url();
        let window = WebviewWindowBuilder::new(&self.app, &label, WebviewUrl::External(url.parse().unwrap()))
            .title(self.site.id())
            .inner_size(800.0, 600.0)
            .visible(false)
            // 伪装成普通 Chrome，避免站点按 WebView2 UA 拒绝服务。
            .user_agent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            )
            .initialization_script(
                "window.__AME_EMIT__ = (id, value) => { \
                   if (window.__TAURI_INTERNALS__) { \
                     window.__TAURI_INTERNALS__.invoke('plugin:event|emit', { event: 'scraper-result', payload: { id, value } }); \
                   } \
                 };",
            )
            .build()
            .map_err(|e| e.to_string())?;
        // Give the page time to load before first use.
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        Ok(window)
    }
}

impl TranslateProvider for WebScraper {
    fn id(&self) -> &str {
        self.site.id()
    }

    fn options_schema() -> Value {
        <WebScraperOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        // Site-specific from/to languages are filled in by the constructor
        // helpers (`selftest.rs`); the stored defaults are site-agnostic.
        serde_json::to_value(WebScraperOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <WebScraperOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        // 串行化整个流程（含 ensure_window）：两个并发 translate 各自 eval
        // 插入文本脚本会互相覆盖页面输入框，结果事件按 event_id 匹配也
        // 可能张冠李戴。
        let _guard = self.call_lock.lock().await;
        let window = self.ensure_window().await?;
        let event_id = uuid::Uuid::new_v4().to_string();

        // Listen for the result event matching our event_id.
        let (tx, rx) = tokio::sync::oneshot::channel::<String>();
        let tx = std::sync::Mutex::new(Some(tx));
        let id_clone = event_id.clone();
        let event_id_handle = self.app.listen_any("scraper-result", move |event| {
            if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
                if payload["id"].as_str() == Some(id_clone.as_str()) {
                    if let Some(tx) = tx.lock().unwrap().take() {
                        let _ = tx.send(payload["value"].as_str().unwrap_or("").to_string());
                    }
                }
            }
        });

        let script = self.site.translate_script(&text, &event_id);
        let result = match window.eval(&script).map_err(|e| e.to_string()) {
            Ok(()) => tokio::time::timeout(std::time::Duration::from_secs(20), rx).await,
            Err(e) => {
                // Unlisten before returning so a failed eval does not leak
                // the `scraper-result` listener.
                self.app.unlisten(event_id_handle);
                return Err(e);
            }
        };

        self.app.unlisten(event_id_handle);

        match result {
            Ok(Ok(text)) => Ok(text),
            _ => Err("Web scraper translation timed out".into()),
        }
    }
}
