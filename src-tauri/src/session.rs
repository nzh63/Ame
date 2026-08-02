//! Session lifecycle — replaces `src/main/Session.ts`.
//!
//! A `Session` ties together a text extractor, the enabled translate
//! providers, and the translator overlay window. Extracted text is forwarded
//! to the providers and the results are emitted to the frontend as events:
//! - `original-watch-list-update`  → `{ key, text }`
//! - `translate-watch-list-update` → `{ key, originalText, translateText, providerId }`
//! - `translate-watch-list-update-error` → `{ err, value }`

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Listener, Manager};
use tokio::sync::Notify;

use crate::extractor::textractor::{PostProcessOption, Textractor};
use crate::providers::translate::anthropic::{Anthropic, AnthropicOptions};
use crate::providers::translate::baidu_ai::{Baidu, BaiduOptions};
use crate::providers::translate::dreye::{DrEye, DrEyeOptions};
#[cfg(debug_assertions)]
use crate::providers::translate::echo::Echo;
use crate::providers::translate::jbeijing::{JBeijing, JBeijingOptions};
use crate::providers::translate::openai::{OpenAi, OpenAiOptions};
use crate::providers::translate::tencent::{Tencent, TencentOptions};
use crate::providers::translate::web_scraper::{ScraperSite, WebScraper, WebScraperOptions};
use crate::providers::translate::TranslateProvider;
use crate::store::Store;
use crate::window;

/// All active sessions, keyed by uuid.
pub type SessionRegistry = Arc<Mutex<HashMap<String, Session>>>;

/// A pending OCR-rect debounced write: monotonic sequence + a cancellation
/// flag + its worker thread. The cancellation flag lets `destroy()` / a newer
/// `set_ocr_rect` stop an in-flight writer so no thread outlives the session
/// or writes a stale rect after a newer one was submitted.
struct OcrRectDebounce {
    seq: u64,
    cancel: Arc<AtomicBool>,
    handle: std::thread::JoinHandle<()>,
}

/// Create a new, empty session registry (managed as Tauri state).
pub fn registry() -> SessionRegistry {
    Arc::new(Mutex::new(HashMap::new()))
}

/// A running translation session.
#[allow(dead_code)]
pub struct Session {
    pub uuid: String,
    pub game_pids: Vec<u32>,
    pub extractor_type: String,
    /// App handle used to unlisten this session's event listeners (`None` in
    /// unit-test dummy sessions).
    app: Option<AppHandle>,
    textractor: Option<Textractor>,
    #[allow(dead_code)]
    providers: Arc<Vec<Box<dyn TranslateProviderObj>>>,
    #[allow(dead_code)]
    ocr_extractor: Option<Arc<Mutex<crate::extractor::ocr::OcrExtractor>>>,
    #[allow(dead_code)]
    ocr_providers: Arc<Mutex<Vec<Box<dyn OcrProviderObj>>>>,
    /// Accumulated extracted text, keyed by hook/ocr key (for get_all_extract_text).
    extract_text: Arc<Mutex<HashMap<String, String>>>,
    /// App-level event listeners owned by this session; all are unlistened in
    /// `destroy()` so switching extractors or closing a session never leaks
    /// handlers (old code leaked one `listen_any` per session start).
    listener_ids: Vec<tauri::EventId>,
    /// OCR 任务队列（旧版 TaskQueue 语义）：pending 标志 + 通知。
    /// 触发只置位并通知；worker 串行消费，忙时新触发合并/覆盖旧排队任务，
    /// 保证不会因为 OCR 忙而永久丢失最新画面（替代旧的 try_lock 跳过）。
    ocr_queue_pending: Arc<AtomicBool>,
    ocr_queue_notify: Arc<Notify>,
    /// movement 检测已截取的帧（worker 复用，避免一次移动 = 两次截图）。
    ocr_queue_frame: Arc<Mutex<Option<(image::GrayImage, u32, u32)>>>,
    /// 周期性 movement 检测任务句柄（destroy 时取消）。
    ocr_movement_task: Option<tauri::async_runtime::JoinHandle<()>>,
    /// Periodic frame-diff movement detector (interval configured in options).
    /// Whether the game window is currently visible (minimized → no triggers).
    game_window_visible: Arc<AtomicBool>,
    /// Keys the frontend has subscribed to for translation
    /// (`watch_translate`). Only these keys are forwarded to the translate
    /// providers — mirrors the old Electron `translateWatchList` per-key
    /// subscription (unselected keys must NOT be translated).
    translate_watch_keys: Arc<Mutex<HashMap<String, ()>>>,
    /// Store handle, used to persist OCR rect/preprocess into the game entry.
    store: Store,
    /// Debounced OCR-rect persistence (slider drags don't rewrite the store
    /// file on every tick — memory updates are immediate, disk writes wait).
    ocr_rect_debounce: Arc<Mutex<Option<OcrRectDebounce>>>,
    /// Monotonic sequence for the OCR-rect debounce: each `set_ocr_rect`
    /// bumps it; a pending writer only commits if it still holds the latest
    /// sequence (see `set_ocr_rect`).
    ocr_rect_seq: std::sync::atomic::AtomicU64,
}

/// Resolve the session uuid from an invoking window's label.
///
/// Translator/OCR-guide windows are labelled `translator-{uuid}` /
/// `ocr-guide-{uuid}`. The frontend calls session-scoped commands without a
/// uuid, so we recover it from the calling window.
pub fn uuid_from_window(label: &str) -> Option<String> {
    label
        .strip_prefix("translator-")
        .or_else(|| label.strip_prefix("ocr-guide-"))
        .map(|s| s.to_string())
}

/// Look up the uuid of the single active session (fallback when the calling
/// window is not session-scoped, e.g. the main window).
pub fn single_session_uuid(registry: &SessionRegistry) -> Option<String> {
    registry.lock().keys().next().cloned()
}

/// Object-safe translation provider used at runtime.
pub(crate) trait TranslateProviderObj: Send + Sync {
    fn id(&self) -> &str;
    fn enabled(&self) -> bool;
    fn translate_stream<'a>(
        &'a self,
        text: String,
        on_chunk: Box<dyn FnMut(String) + Send + 'a>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send + 'a>>;
}

impl<T: TranslateProvider> TranslateProviderObj for T {
    fn id(&self) -> &str {
        TranslateProvider::id(self)
    }
    fn enabled(&self) -> bool {
        TranslateProvider::enabled(self)
    }
    fn translate_stream<'a>(
        &'a self,
        text: String,
        on_chunk: Box<dyn FnMut(String) + Send + 'a>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send + 'a>>
    {
        let id = self.id().to_string();
        crate::log_info!("provider", "{id} translate-stream <- {:?}", text);
        let fut = TranslateProvider::translate_stream(self, text, on_chunk);
        Box::pin(async move {
            let r = fut.await;
            match &r {
                Ok(out) => crate::log_info!("provider", "{id} translate-stream -> {:?}", out),
                Err(e) => crate::log_info!("provider", "{id} translate-stream !! {e}"),
            }
            r
        })
    }
}

/// Object-safe OCR provider used at runtime.
trait OcrProviderObj: Send + Sync {
    fn id(&self) -> &str;
    fn enabled(&self) -> bool;
    fn recognize<'a>(
        &'a mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send + 'a>>;
}

impl<T: crate::providers::ocr::OcrProvider> OcrProviderObj for T {
    fn id(&self) -> &str {
        crate::providers::ocr::OcrProvider::id(self)
    }
    fn enabled(&self) -> bool {
        crate::providers::ocr::OcrProvider::enabled(self)
    }
    fn recognize<'a>(
        &'a mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send + 'a>>
    {
        let id = self.id().to_string();
        crate::log_info!(
            "provider",
            "{id} recognize <- {}x{} ({} bytes)",
            width,
            height,
            data.len()
        );
        let fut = crate::providers::ocr::OcrProvider::recognize(self, data, width, height);
        Box::pin(async move {
            let r = fut.await;
            match &r {
                Ok(out) => crate::log_info!("provider", "{id} recognize -> {:?}", out),
                Err(e) => crate::log_info!("provider", "{id} recognize !! {e}"),
            }
            r
        })
    }
}

impl Session {
    /// Create and start a new session.
    #[allow(clippy::too_many_arguments)]
    pub fn start(
        app: AppHandle,
        store: Store,
        registry: SessionRegistry,
        uuid: String,
        game_pids: Vec<u32>,
        hook_code: String,
        extractor_type: String,
        static_dir: PathBuf,
        start_hooks: bool,
    ) -> Result<Session, String> {
        crate::log_info!("session", "start game for pids {game_pids:?} uuid={uuid}");
        // Build the enabled translate providers from stored options.
        let providers = Arc::new(build_translate_providers(&store, &app, &static_dir));

        // Build OCR providers (used when extractor_type == "ocr").
        let ocr_providers = Arc::new(Mutex::new(build_ocr_providers(&store, &static_dir)));

        // Start the extractor.
        let textractor = if extractor_type == "textractor" {
            let t = Textractor::start(app.clone(), game_pids.clone(), hook_code, static_dir)?;
            Some(t)
        } else {
            None
        };

        // OCR extractor state (capture/crop/preprocess + movement detection).
        let ocr_extractor = if extractor_type == "ocr" {
            let opts: crate::extractor::ocr::OcrExtractorOptions =
                serde_json::from_value(store.get("ocrExtractor", None)).unwrap_or_default();
            let ext = Arc::new(Mutex::new(crate::extractor::ocr::OcrExtractor::new(
                &game_pids, opts,
            )));
            // Restore persisted OCR rect/preprocess from the game entry.
            let games = store.get("games", Some(serde_json::json!([])));
            if let Some(game) = games
                .as_array()
                .and_then(|arr| arr.iter().find(|g| g["uuid"] == uuid))
            {
                if let Ok(r) = serde_json::from_value::<crate::extractor::ocr::CropRect>(
                    game["ocr"]["rect"].clone(),
                ) {
                    ext.lock().rect = Some(r);
                }
                if let Ok(o) = serde_json::from_value::<crate::extractor::ocr::PreprocessOption>(
                    game["ocr"]["preprocess"].clone(),
                ) {
                    ext.lock().preprocess_option = o;
                }
            }
            Some(ext)
        } else {
            None
        };

        // Create the translator overlay window and start window-following hooks.
        window::create_translator_window(&app, &uuid)?;
        if start_hooks {
            crate::hook::start(&app, game_pids.clone());
        }

        // Accumulated extracted text (for get_all_extract_text).
        let extract_text: Arc<Mutex<HashMap<String, String>>> =
            Arc::new(Mutex::new(HashMap::new()));

        // OCR trigger state (used when extractor_type == "ocr").
        let game_window_visible = Arc::new(AtomicBool::new(true));
        let ocr_queue_pending = Arc::new(AtomicBool::new(false));
        let ocr_queue_notify = Arc::new(Notify::new());
        let ocr_queue_frame: Arc<Mutex<Option<(image::GrayImage, u32, u32)>>> =
            Arc::new(Mutex::new(None));
        let translate_watch_keys = Arc::new(Mutex::new(HashMap::<String, ()>::new()));
        let mut ocr_movement_task: Option<tauri::async_runtime::JoinHandle<()>> = None;
        let mut listener_ids: Vec<tauri::EventId> = Vec::new();

        // Wire extractor output → translation pipeline.
        // The Textractor emits `original-watch-list-update` directly; we listen
        // and forward each line to the providers.
        let app2 = app.clone();
        {
            let providers = providers.clone();
            let extract_text = extract_text.clone();
            let translate_watch_keys_evt = translate_watch_keys.clone();
            listener_ids.push(app.listen_any("original-watch-list-update", move |event| {
                if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
                    let key = payload["key"].as_str().unwrap_or("").to_string();
                    let text = payload["text"].as_str().unwrap_or("").to_string();
                    crate::log_info!(
                        "session",
                        "original-watch-list-update <- key={key} text={text:?}"
                    );
                    if text.is_empty() {
                        return;
                    }
                    // Accumulate for get_all_extract_text.
                    extract_text.lock().insert(key.clone(), text.clone());
                    // 只翻译被前端订阅的 key（旧版 watchTranslate 语义）；
                    // 未选中的 key 只做记录，不进翻译管线。
                    // 订阅了 `any` 时所有 key 都进翻译管线（旧版 extractor
                    // 会把每个 key 同时 emit 到 `update:any`）。
                    let watched = {
                        let keys = translate_watch_keys_evt.lock();
                        keys.contains_key("any") || keys.contains_key(&key)
                    };
                    if !watched {
                        crate::log_info!("session", "skip translation for unselected key={key}");
                        return;
                    }
                    let app3 = app2.clone();
                    let providers = providers.clone();
                    tauri::async_runtime::spawn(async move {
                        run_translation(&app3, providers, key, text).await;
                    });
                }
            }));
        }

        // Wire game-window movement → translator overlay follows.
        let app_move = app.clone();
        let uuid_move = uuid.clone();
        listener_ids.push(app.listen_any("window-move", move |event| {
            if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
                let diff_left = payload["diffLeft"].as_i64().unwrap_or(0) as i32;
                let diff_top = payload["diffTop"].as_i64().unwrap_or(0) as i32;
                let _ = window::move_translator_window(&app_move, &uuid_move, diff_left, diff_top);
            }
        }));

        // Wire game-window minimize/restore → mirror on the overlay.
        let app_min = app.clone();
        let uuid_min = format!("translator-{uuid}");
        let game_visible_min = game_window_visible.clone();
        listener_ids.push(app.listen_any("window-minimize", move |_| {
            game_visible_min.store(false, Ordering::SeqCst);
            if let Some(w) = app_min.get_webview_window(&uuid_min) {
                let _ = w.minimize();
            }
        }));
        let app_res = app.clone();
        let uuid_res = format!("translator-{uuid}");
        let game_visible_res = game_window_visible.clone();
        listener_ids.push(app.listen_any("window-restore", move |_| {
            game_visible_res.store(true, Ordering::SeqCst);
            if let Some(w) = app_res.get_webview_window(&uuid_res) {
                let _ = w.unminimize();
            }
        }));

        // Wire game-exit → close the overlay windows and destroy the session
        // (mirrors the old Electron `Session.destroy()` on game-exit).
        let app_exit = app.clone();
        let uuid_exit = uuid.clone();
        let reg_exit = registry.clone();
        listener_ids.push(app.listen_any("game-exit", move |_| {
            // Destroy the session first so the extractor (Textractor
            // stdout thread / OCR worker) stops emitting before we tear down
            // the overlay windows — otherwise a final extraction could fire
            // `original-watch-list-update` into a window that is already gone.
            if let Some(mut session) = reg_exit.lock().remove(&uuid_exit) {
                session.destroy();
            }
            for label in [
                format!("translator-{uuid_exit}"),
                format!("ocr-guide-{uuid_exit}"),
            ] {
                if let Some(w) = app_exit.get_webview_window(&label) {
                    let _ = w.close();
                }
            }
            // Electron: game-exit 后 destroy() + createMainWindow() ——
            // 恢复主窗口（游戏会话结束回到主界面）。
            if let Some(main) = app_exit.get_webview_window("main") {
                let _ = main.show();
                let _ = main.unminimize();
            }
            let _ = app_exit.emit("session-game-exit", ());
        }));

        // Wire OCR extraction triggers (mouse/keyboard/movement) when in OCR
        // mode, mirroring the old OcrExtractor:
        //  - mouse left-up / wheel → debounced by `delay`
        //  - Enter/Space key-up → debounced by `delay`
        //  - periodic frame-diff movement → immediate extraction
        //  - no triggers while the game window is minimized
        if extractor_type == "ocr" {
            if let Some(ocr_ext) = ocr_extractor.clone() {
                let ocr_providers = ocr_providers.clone();

                let store_trigger = store.clone();
                let pending_mouse = ocr_queue_pending.clone();
                let notify_mouse = ocr_queue_notify.clone();
                let game_visible_mouse = game_window_visible.clone();
                let ocr_ext_mouse = ocr_ext.clone();
                listener_ids.push(app.listen_any("global-mouse", move |event| {
                    if !game_visible_mouse.load(Ordering::SeqCst) {
                        return;
                    }
                    // try_lock：OCR worker/截图正持有锁时跳过本次触发，
                    // 绝不在 hook 事件派发路径上阻塞——否则 pump 线程卡在锁上，
                    // 低级 hook 还挂着但不再处理输入，鼠标会一卡一卡。
                    let Some(ext_guard) = ocr_ext_mouse.try_lock() else {
                        return;
                    };
                    if ext_guard.paused.load(Ordering::SeqCst) {
                        return;
                    }
                    if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
                        let wparam = payload["wParam"].as_u64().unwrap_or(0);
                        let opts = ocr_trigger_options(&store_trigger);
                        if mouse_trigger(wparam, &opts.trigger) {
                            pending_mouse.store(true, Ordering::SeqCst);
                            notify_mouse.notify_one();
                        }
                    }
                }));

                let store_kb = store.clone();
                let pending_kb = ocr_queue_pending.clone();
                let notify_kb = ocr_queue_notify.clone();
                let game_visible_kb = game_window_visible.clone();
                let ocr_ext_kb = ocr_ext.clone();
                listener_ids.push(app.listen_any("global-keyboard", move |event| {
                    if !game_visible_kb.load(Ordering::SeqCst) {
                        return;
                    }
                    let Some(ext_guard) = ocr_ext_kb.try_lock() else {
                        return;
                    };
                    if ext_guard.paused.load(Ordering::SeqCst) {
                        return;
                    }
                    if let Ok(payload) = serde_json::from_str::<Value>(event.payload()) {
                        // WM_KEYUP = 0x0101 (mirrors old `key-up` event).
                        if payload["wParam"].as_u64() != Some(0x0101) {
                            return;
                        }
                        let vk = payload["vkCode"].as_u64().unwrap_or(0) as u32;
                        let opts = ocr_trigger_options(&store_kb);
                        if keyboard_trigger(0x0101, vk, &opts.trigger) {
                            pending_kb.store(true, Ordering::SeqCst);
                            notify_kb.notify_one();
                        }
                    }
                }));

                // Movement detection loop (interval > 0 enables it, like the
                // old `setupMovementDetector` guard).
                let movement_interval = ocr_ext.lock().options.trigger.movement.interval;
                if movement_interval > 0 {
                    let store_mv = store.clone();
                    let ocr_ext_mv = ocr_ext.clone();
                    let pending_mv = ocr_queue_pending.clone();
                    let notify_mv = ocr_queue_notify.clone();
                    let frame_mv = ocr_queue_frame.clone();
                    let game_visible_mv = game_window_visible.clone();
                    ocr_movement_task = Some(tauri::async_runtime::spawn(movement_detect_loop(
                        store_mv,
                        ocr_ext_mv,
                        pending_mv,
                        notify_mv,
                        frame_mv,
                        game_visible_mv,
                        movement_interval.max(50),
                    )));
                }
                // OCR worker：串行消费队列请求。
                let worker_pending = ocr_queue_pending.clone();
                let worker_notify = ocr_queue_notify.clone();
                let worker_frame = ocr_queue_frame.clone();
                let worker_ext = ocr_ext.clone();
                let worker_providers = ocr_providers.clone();
                let worker_app = app.clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        worker_notify.notified().await;
                        crate::log_info!("ocr", "OCR worker woke (pending=true)");
                        while worker_pending.swap(false, Ordering::SeqCst) {
                            // 优先复用 movement 检测已截取的帧（避免一次移动 =
                            // 两次截图）；鼠标/键盘触发路径没有现成帧。
                            let frame = worker_frame.lock().take();
                            run_ocr_cycle_inner(
                                worker_app.clone(),
                                worker_ext.clone(),
                                worker_providers.clone(),
                                frame,
                            )
                            .await;
                        }
                    }
                });
            }
        }

        Ok(Session {
            uuid,
            game_pids,
            extractor_type,
            app: Some(app),
            textractor,
            providers,
            ocr_extractor,
            ocr_providers,
            extract_text,
            listener_ids,
            ocr_queue_pending,
            ocr_queue_notify,
            ocr_queue_frame,
            ocr_movement_task,
            game_window_visible,
            translate_watch_keys,
            store,
            ocr_rect_debounce: Arc::new(Mutex::new(None)),
            ocr_rect_seq: std::sync::atomic::AtomicU64::new(0),
        })
    }

    /// Update Textractor post-processing options.
    pub fn set_textractor_post_process(&mut self, option: PostProcessOption) {
        if let Some(t) = self.textractor.as_mut() {
            t.set_post_process(option);
        }
    }

    pub fn get_textractor_post_process(&self) -> Option<PostProcessOption> {
        self.textractor.as_ref().map(|t| t.get_post_process())
    }

    /// The hook code of the running Textractor, if any.
    pub fn textractor_hook_code(&self) -> Option<String> {
        self.textractor.as_ref().map(|t| t.hook_code())
    }

    /// Return all accumulated extracted text as a key→text map.
    pub fn get_all_extract_text(&self) -> Value {
        let guard = self.extract_text.lock();
        serde_json::to_value(&*guard).unwrap_or_else(|_| serde_json::json!({}))
    }

    /// Return one accumulated text by key.
    pub fn get_extract_text(&self, key: &str) -> Option<String> {
        self.extract_text.lock().get(key).cloned()
    }

    /// Clone the translate providers (for async translation dispatch).
    pub fn providers(&self) -> Arc<Vec<Box<dyn TranslateProviderObj>>> {
        self.providers.clone()
    }

    /// Replace the accumulated extracted text (used when switching extractors).
    pub fn restore_extract_text(&self, map: std::collections::HashMap<String, String>) {
        let mut guard = self.extract_text.lock();
        *guard = map;
    }

    /// Access the OCR extractor (if this session is in OCR mode).
    pub fn ocr_extractor(&self) -> Option<Arc<Mutex<crate::extractor::ocr::OcrExtractor>>> {
        self.ocr_extractor.clone()
    }

    /// Capture the current game window as a PNG byte buffer (for the OCR guide).
    pub fn capture_png(&self, force: bool) -> Result<Vec<u8>, String> {
        let ext = self.ocr_extractor.as_ref().ok_or("not in OCR mode")?;
        let guard = ext.lock();
        let img = crate::win32::screen_capturer::capture(guard.hwnd)?;
        let rgba = crate::extractor::ocr::bgra_to_rgba_flipped(&img.buffer, img.width, img.height)
            .ok_or("failed to build image")?;
        let _ = force;
        let mut png = Vec::new();
        rgba.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(png)
    }

    /// Get the current OCR crop rectangle (persisted on the game entry).
    pub fn get_ocr_rect(&self) -> Value {
        self.game_ocr_field("rect")
    }

    /// Set the OCR crop rectangle: apply to the live extractor immediately
    /// (memory only), and persist to the store debounced so dragging the
    /// guide slider doesn't rewrite the whole store file on every tick.
    pub fn set_ocr_rect(&self, rect: Value) -> Result<(), String> {
        if let Some(ext) = self.ocr_extractor.as_ref() {
            // 用 try_lock：movement 检测可能正持锁截图（几十到几百 ms），
            // 滑块拖动时不能阻塞等锁（否则每 tick 都卡一下）。
            if let Ok(r) = serde_json::from_value::<crate::extractor::ocr::CropRect>(rect.clone()) {
                if let Some(mut guard) = ext.try_lock() {
                    guard.rect = Some(r);
                } else {
                    // 锁被占用：本轮跳过，下一 tick 的 rect 仍会带最新值，
                    // 且持久化照常进行——不阻塞滑块。
                }
            }
        }
        // 防抖持久化：只保留一个延迟写入线程；拖动期间新请求到来时，
        // 旧线程发现自己的序列号已过期就立即退出，由最新线程在安静 300ms
        // 后写入。用单调递增序列号，而不是线程 id 比较——线程 id 判断
        // "谁是最新"依赖竞态推断，序列号更可靠也更容易测试。
        let store = self.store.clone();
        let uuid = self.uuid.clone();
        let field = "rect".to_string();
        let value = rect;
        let state = self.ocr_rect_debounce.clone();
        let seq = self
            .ocr_rect_seq
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        // 取消上一个仍在等待/写入的防抖线程：它可能已持有一份旧快照，
        // 若它在新请求之后才写盘会把最新的 rect 覆盖回旧值，或在新会话
        // 销毁后仍访问 Store。取消后 destroy() 才能安全 join。
        {
            let mut guard = state.lock();
            if let Some(prev) = guard.as_mut() {
                prev.cancel.store(true, Ordering::SeqCst);
            }
        }
        let cancel = Arc::new(AtomicBool::new(false));
        let cancel_clone = cancel.clone();
        let handle = std::thread::spawn(move || {
            // 每 25ms 检查一次取消，避免 destroy() join 时被 300ms 睡眠拖住。
            let deadline = std::time::Instant::now() + std::time::Duration::from_millis(300);
            while std::time::Instant::now() < deadline {
                if cancel_clone.load(Ordering::SeqCst) {
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            // 若已有更新的请求占位，则放弃本次写入（最新占位者会写）。
            let is_latest = {
                let guard = state.lock();
                guard.as_ref().is_some_and(|d| d.seq == seq)
            };
            if !is_latest || cancel_clone.load(Ordering::SeqCst) {
                return;
            }
            let mut games = store.get("games", Some(serde_json::json!([])));
            if let Some(arr) = games.as_array_mut() {
                if let Some(game) = arr.iter_mut().find(|g| g["uuid"] == uuid) {
                    if game.get("ocr").is_none() {
                        game["ocr"] = serde_json::json!({});
                    }
                    game["ocr"][field] = value;
                }
            }
            let _ = store.set("games", games);
            // 写入完成后清掉占位（若仍指向自己的序列号），避免残留。
            let mut guard = state.lock();
            if guard.as_ref().is_some_and(|d| d.seq == seq) {
                *guard = None;
            }
        });
        *self.ocr_rect_debounce.lock() = Some(OcrRectDebounce {
            seq,
            cancel,
            handle,
        });
        Ok(())
    }

    /// Get the current OCR preprocess option (persisted on the game entry).
    pub fn get_ocr_preprocess(&self) -> Value {
        let v = self.game_ocr_field("preprocess");
        if v.is_null() {
            serde_json::json!({ "color": "colorful" })
        } else {
            v
        }
    }

    /// Set + persist the OCR preprocess option.
    pub fn set_ocr_preprocess(&self, option: Value) -> Result<(), String> {
        if let Some(ext) = self.ocr_extractor.as_ref() {
            if let Ok(o) =
                serde_json::from_value::<crate::extractor::ocr::PreprocessOption>(option.clone())
            {
                ext.lock().preprocess_option = o;
            }
        }
        self.set_game_ocr_field("preprocess", option)
    }

    /// Subscribe a key to the translation pipeline (old Electron
    /// `watchTranslate`). Only subscribed keys are forwarded to providers.
    pub fn watch_translate(&self, key: &str) {
        crate::log_info!("session", "watch translate at {key}");
        self.translate_watch_keys.lock().insert(key.to_string(), ());
    }

    /// Unsubscribe a key (old Electron `unwatchTranslate`).
    pub fn unwatch_translate(&self, key: &str) {
        crate::log_info!("session", "unwatch translate at {key}");
        self.translate_watch_keys.lock().remove(key);
    }

    /// Whether the given extraction key should be forwarded to the translate
    /// providers.
    ///
    /// Subscribing `any` watches every key (the old extractor emitted each
    /// key to both `update:${key}` and `update:any`); otherwise only the exact
    /// key is watched.
    pub fn is_key_watched(&self, key: &str) -> bool {
        let guard = self.translate_watch_keys.lock();
        guard.contains_key("any") || guard.contains_key(key)
    }

    /// Snapshot the currently watched translate keys.
    ///
    /// `switch_extractor_type` rebuilds the session; the old Electron
    /// `switchExtractor` kept the session-level `translateWatchList`, so the
    /// watched keys must survive the rebuild (otherwise every OCR/textractor
    /// extraction after the switch logs "skip translation for unselected key").
    pub fn translate_watch_keys_snapshot(&self) -> Vec<String> {
        self.translate_watch_keys.lock().keys().cloned().collect()
    }

    /// Restore watched keys on a rebuilt session (see
    /// [`translate_watch_keys_snapshot`]).
    pub fn restore_translate_watch_keys(&self, keys: Vec<String>) {
        let mut guard = self.translate_watch_keys.lock();
        for key in keys {
            guard.insert(key, ());
        }
    }

    // ── store helpers ────────────────────────────────────────────────────────

    fn game_ocr_field(&self, field: &str) -> Value {
        let games = self.store.get("games", Some(serde_json::json!([])));
        games
            .as_array()
            .and_then(|arr| arr.iter().find(|g| g["uuid"] == self.uuid))
            .and_then(|g| g.get("ocr"))
            .and_then(|ocr| ocr.get(field))
            .cloned()
            .unwrap_or(Value::Null)
    }

    fn set_game_ocr_field(&self, field: &str, value: Value) -> Result<(), String> {
        let mut games = self.store.get("games", Some(serde_json::json!([])));
        if let Some(arr) = games.as_array_mut() {
            if let Some(game) = arr.iter_mut().find(|g| g["uuid"] == self.uuid) {
                if game.get("ocr").is_none() {
                    game["ocr"] = serde_json::json!({});
                }
                game["ocr"][field] = value;
            }
        }
        self.store.set("games", games).map_err(|e| e.to_string())
    }

    /// Tear down the session.
    pub fn destroy(&mut self) {
        crate::log_info!("session", "General destroy uuid={}", self.uuid);
        if let Some(t) = self.textractor.as_mut() {
            t.destroy();
        }
        // Cancel the movement OCR task (worker/queue are session-scoped and
        // die with the async runtime, so nothing to join here).
        if let Some(task) = self.ocr_movement_task.take() {
            task.abort();
        }
        // Cancel + join the in-flight OCR-rect debounce writer so it never
        // outlives the session (it holds a `Store` Arc and would otherwise
        // write to a freed/superseded session after teardown).
        if let Some(deb) = self.ocr_rect_debounce.lock().take() {
            deb.cancel.store(true, Ordering::SeqCst);
            let _ = deb.handle.join();
        }
        // Unregister every app-level listener this session registered.
        if let Some(app) = self.app.as_ref() {
            for id in self.listener_ids.drain(..) {
                tauri::Listener::unlisten(app, id);
            }
        } else {
            self.listener_ids.clear();
        }
        crate::hook::stop();
    }
}

/// Read the OCR extractor options (used by triggers so option changes apply
/// live, mirroring the old `store.onDidChange('ocrExtractor', ...)`).
fn ocr_trigger_options(store: &Store) -> crate::extractor::ocr::OcrExtractorOptions {
    serde_json::from_value(store.get("ocrExtractor", None)).unwrap_or_default()
}

/// Whether a global-mouse message should trigger an OCR cycle.
///
/// WM_LBUTTONUP = 0x0202, WM_MOUSEWHEEL = 0x020a (mirrors the old
/// `mouse-left-up` / `mouse-wheel` hook events).
fn mouse_trigger(wparam: u64, opts: &crate::extractor::ocr::TriggerOptions) -> bool {
    (wparam == 0x0202 && opts.mouse.left) || (wparam == 0x020a && opts.mouse.wheel)
}

/// Whether a global-keyboard message should trigger an OCR cycle.
///
/// WM_KEYUP = 0x0101 (mirrors the old `key-up` hook event); VK_SPACE = 0x20,
/// VK_RETURN = 0x0d.
fn keyboard_trigger(
    wparam: u64,
    vk_code: u32,
    opts: &crate::extractor::ocr::TriggerOptions,
) -> bool {
    wparam == 0x0101
        && ((vk_code == 0x20 && opts.keyboard.space) || (vk_code == 0x0d && opts.keyboard.enter))
}

/// Periodically capture + frame-diff; extract immediately on movement.
async fn movement_detect_loop(
    store: Store,
    ocr_ext: Arc<Mutex<crate::extractor::ocr::OcrExtractor>>,
    pending: Arc<AtomicBool>,
    notify: Arc<Notify>,
    frame_slot: Arc<Mutex<Option<(image::GrayImage, u32, u32)>>>,
    game_visible: Arc<AtomicBool>,
    interval_ms: u64,
) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_millis(interval_ms));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    // 上一帧检测仍在运行时丢弃本次 tick（旧版 TaskQueue：忙时新任务取消，
    // 不会积压 spawn_blocking 任务把 CPU 打满，也不会因 tick 追赶到 0 间隔）。
    let detecting = Arc::new(AtomicBool::new(false));
    // 连续截图失败计数：游戏窗口消失（进程残留但窗口没了）时停止空转。
    let mut consecutive_failures = 0u32;
    loop {
        ticker.tick().await;
        if !game_visible.load(Ordering::SeqCst) {
            continue;
        }
        // try_lock 检查暂停：OCR worker/向导正持锁时不阻塞本循环
        // （tokio 线程被 parking_lot 阻塞锁卡住会拖累整个运行时）。
        {
            let Some(guard) = ocr_ext.try_lock() else {
                continue;
            };
            if guard.paused.load(Ordering::SeqCst) {
                continue;
            }
        }
        if detecting.swap(true, Ordering::SeqCst) {
            // 上一帧还在截图/比较，本次 tick 直接跳过。
            continue;
        }
        // Re-read the interval each tick so option changes apply without
        // restarting the session (old version watched `ocrExtractor` changes).
        let opts = ocr_trigger_options(&store);
        if opts.trigger.movement.interval == 0 {
            detecting.store(false, Ordering::SeqCst);
            continue;
        }
        let interval = opts.trigger.movement.interval.max(50);

        // 短锁取快照：截图 + 像素 diff 期间不持有 ocr_ext 锁（截图大窗口
        // 可能耗时数百 ms，持锁会阻塞 hook 监听器 / OCR worker）。
        let (hwnd, rect, preprocess, detector, game_pids) = {
            let guard = ocr_ext.lock();
            (
                guard.hwnd,
                guard.rect,
                guard.preprocess_option.clone(),
                guard.movement_detector.clone(),
                guard.game_pids.clone(),
            )
        };
        // 验证 hwnd 仍属于游戏进程：窗口销毁后系统可能把句柄值复用给
        // 其他窗口，截图仍会"成功"，导致持续对错误窗口做 OCR 拖垮 CPU。
        if !crate::win32::screen_capturer::window_belongs_to(hwnd, &game_pids) {
            crate::log_info!(
                "ocr",
                "movement detection: window no longer owned by game, loop exits"
            );
            break;
        }
        let frame = {
            tokio::task::spawn_blocking(move || {
                let Ok(frame) = crate::extractor::ocr::OcrExtractor::capture_and_process_from(
                    hwnd,
                    rect,
                    &preprocess,
                ) else {
                    crate::log_info!("ocr", "capture_and_process failed");
                    return DetectResult::Failed;
                };
                let (gray, w, h) = frame;
                let moved = detector
                    .as_ref()
                    .map(|d| d.detect(gray.clone()))
                    .unwrap_or(false);
                if moved {
                    DetectResult::Moved(gray, w, h)
                } else {
                    DetectResult::NoMove
                }
            })
            .await
            .unwrap_or(DetectResult::Failed)
        };
        detecting.store(false, Ordering::SeqCst);

        match frame {
            DetectResult::Moved(gray, w, h) => {
                consecutive_failures = 0;
                // 请求队列：worker 会串行处理（即使当前 OCR 忙也会排队，不丢）。
                *frame_slot.lock() = Some((gray, w, h));
                pending.store(true, Ordering::SeqCst);
                notify.notify_one();
            }
            DetectResult::Failed => {
                consecutive_failures += 1;
                // 连续 ~1s 截图失败：游戏窗口已消失，继续每 100ms 空转只会
                // 白耗 CPU/刷日志，直接退出（重开会话时重建）。
                if consecutive_failures >= 10 {
                    crate::log_info!("ocr", "movement detection: window lost, loop exits");
                    break;
                }
            }
            DetectResult::NoMove => {
                consecutive_failures = 0;
            }
        }
        // Reschedule based on the latest interval.
        let next = std::time::Duration::from_millis(interval);
        if ticker.period() != next {
            ticker = tokio::time::interval(next);
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            ticker.tick().await; // skip the immediate first tick
        }
    }
}

/// movement 检测单轮结果。
enum DetectResult {
    /// 截图/预处理失败。
    Failed,
    /// 截图成功但未检测到移动。
    NoMove,
    /// 检测到移动，携带已预处理帧。
    Moved(image::GrayImage, u32, u32),
}

/// 实际的 OCR 周期：截图 → 预处理 → 识别 → 去重发射。
async fn run_ocr_cycle_inner(
    app: AppHandle,
    ocr_ext: Arc<Mutex<crate::extractor::ocr::OcrExtractor>>,
    ocr_providers: Arc<Mutex<Vec<Box<dyn OcrProviderObj>>>>,
    frame: Option<(image::GrayImage, u32, u32)>,
) {
    // Take providers out of the mutex synchronously (guard is !Send).
    let mut taken = {
        let mut guard = ocr_providers.lock();
        std::mem::take(&mut *guard)
    };

    // 优先复用 movement 检测已截取的帧（避免一次移动 = 两次截图）；
    // 鼠标/键盘触发路径没有现成帧，才在这里截图。
    let (gray, w, h) = match frame {
        Some(frame) => frame,
        None => {
            // 短锁取快照，无锁截图（避免在截图期间持有 ocr_ext 锁）。
            let (hwnd, rect, preprocess) = {
                let guard = ocr_ext.lock();
                (guard.hwnd, guard.rect, guard.preprocess_option.clone())
            };
            let capture_result = tokio::task::spawn_blocking(move || {
                crate::extractor::ocr::OcrExtractor::capture_and_process_from(
                    hwnd,
                    rect,
                    &preprocess,
                )
            })
            .await;
            match capture_result {
                Ok(Ok(frame)) => frame,
                _ => {
                    *ocr_providers.lock() = taken;
                    return;
                }
            }
        }
    };

    // Convert greyscale image back to a BGRA-like buffer for the providers.
    let mut bgra = Vec::with_capacity((w * h * 4) as usize);
    for &g in gray.as_raw() {
        bgra.push(g); // B
        bgra.push(g); // G
        bgra.push(g); // R
        bgra.push(255); // A
    }

    for provider in taken.iter_mut() {
        if !provider.enabled() {
            continue;
        }
        let provider_id = provider.id().to_string();
        // 超时保护：某个 provider 卡住（本地推理死锁/云端超时）时不能永久
        // 持有 cycle_lock，否则 movement 检测和后续 OCR 周期全部停摆。
        let recognize = provider.recognize(bgra.clone(), w, h);
        let result = tokio::time::timeout(std::time::Duration::from_secs(20), recognize).await;
        if let Ok(Ok(text)) = result {
            // 去重：文本没变就不发事件，避免 OCR 模式下事件风暴。
            let key = format!("ocr-{provider_id}");
            let should_emit = {
                let ext_guard = ocr_ext.lock();
                let mut last = ext_guard.last_text.lock();
                let changed =
                    last.get(&key).map(|l| text != *l).unwrap_or(true) && !text.trim().is_empty();
                if changed {
                    last.insert(key.clone(), text.clone());
                }
                changed
            };
            if should_emit {
                crate::log_info!("ocr", "{provider_id} -> emit: {:?}", text);
                let _ = app.emit(
                    "original-watch-list-update",
                    serde_json::json!({ "key": key, "text": text }),
                );
            }
        } else {
            // Electron: OCR provider 出错时把错误信息也当作提取文本显示，
            // 让用户看到哪个 provider 出了问题。
            let err_text = match result {
                Err(_) => format!("{provider_id} 识别超时"),
                Ok(Err(e)) => format!("{provider_id} 识别错误: {e}"),
                Ok(Ok(_)) => unreachable!(),
            };
            crate::log_info!("ocr", "{provider_id} error: {err_text}");
            let key = format!("ocr-{provider_id}");
            let should_emit = {
                let ext_guard = ocr_ext.lock();
                let mut last = ext_guard.last_text.lock();
                let changed = last.get(&key).map(|l| err_text != *l).unwrap_or(true)
                    && !err_text.trim().is_empty();
                if changed {
                    last.insert(key.clone(), err_text.clone());
                }
                changed
            };
            if should_emit {
                let _ = app.emit(
                    "original-watch-list-update",
                    serde_json::json!({ "key": key, "text": err_text }),
                );
            }
        }
    }

    // Put providers back.
    *ocr_providers.lock() = taken;
}

/// Run all enabled providers over the text and emit results.
pub(crate) async fn run_translation(
    app: &AppHandle,
    providers: Arc<Vec<Box<dyn TranslateProviderObj>>>,
    key: String,
    text: String,
) {
    // Electron 的 TranslateManager.translate 并行启动所有 provider；
    // 串行 await 会让慢的 provider 阻塞其他结果展示。
    let mut futures = Vec::new();
    for provider in providers.iter() {
        if !provider.enabled() {
            continue;
        }
        let provider_id = provider.id().to_string();
        let app = app.clone();
        let key = key.clone();
        let text = text.clone();
        let app_emit = app.clone();
        let key_emit = key.clone();
        let text_emit = text.clone();
        let pid_emit = provider_id.clone();
        futures.push(async move {
            // 流式：每个增量都带完整累加文本推送（Electron TranslateManager
            // 每次 chunk 都 callback 完整 text）。非流式 provider 的默认实现
            // 只回调一次，行为与旧版一致。
            let mut acc = String::new();
            let on_chunk = Box::new(move |chunk: String| {
                acc.push_str(&chunk);
                let _ = app_emit.emit(
                    "translate-watch-list-update",
                    serde_json::json!({
                        "key": key_emit,
                        "originalText": text_emit,
                        "translateText": acc,
                        "providerId": pid_emit,
                    }),
                );
            });
            match provider.translate_stream(text.clone(), on_chunk).await {
                Ok(_) => {
                    // 最后一个增量已携带完整译文。
                }
                Err(err) => {
                    let _ = app.emit(
                        "translate-watch-list-update-error",
                        serde_json::json!({
                            "err": err,
                            "value": {
                                "key": key,
                                "originalText": text,
                                "translateText": "",
                                "providerId": provider_id,
                            }
                        }),
                    );
                }
            }
        });
    }
    futures::future::join_all(futures).await;
}

/// Instantiate translate providers from their stored options.
fn build_translate_providers(
    store: &Store,
    app: &AppHandle,
    static_dir: &std::path::Path,
) -> Vec<Box<dyn TranslateProviderObj>> {
    let mut providers: Vec<Box<dyn TranslateProviderObj>> = Vec::new();

    #[cfg(debug_assertions)]
    {
        // Echo (dev convenience; not shipped in release builds).
        providers.push(Box::new(Echo));
    }

    // HTTP API providers.
    if let Ok(opts) = serde_json::from_value::<OpenAiOptions>(
        store.get("translateProviders.OpenAI-Compatible API", None),
    ) {
        providers.push(Box::new(OpenAi::new(opts)));
    }
    if let Ok(opts) = serde_json::from_value::<AnthropicOptions>(
        store.get("translateProviders.Anthropic Message API", None),
    ) {
        providers.push(Box::new(Anthropic::new(opts)));
    }
    if let Ok(opts) =
        serde_json::from_value::<BaiduOptions>(store.get("translateProviders.百度AI开放平台", None))
    {
        providers.push(Box::new(Baidu::new(opts)));
    }
    if let Ok(opts) =
        serde_json::from_value::<TencentOptions>(store.get("translateProviders.腾讯云", None))
    {
        providers.push(Box::new(Tencent::new(opts)));
    }

    // Offline CLI providers.
    if let Ok(opts) =
        serde_json::from_value::<JBeijingOptions>(store.get("translateProviders.JBeijing", None))
    {
        providers.push(Box::new(JBeijing::new(opts, static_dir.to_path_buf())));
    }
    if let Ok(opts) =
        serde_json::from_value::<DrEyeOptions>(store.get("translateProviders.DrEye", None))
    {
        providers.push(Box::new(DrEye::new(opts, static_dir.to_path_buf())));
    }

    // Web-scraping providers (hidden webview).
    let scraper_sites = [
        (ScraperSite::QqFanyi, "腾讯翻译君"),
        (ScraperSite::YoudaoFanyi, "有道翻译"),
    ];
    for (site, id) in scraper_sites {
        if let Ok(opts) = serde_json::from_value::<WebScraperOptions>(
            store.get(&format!("translateProviders.{id}"), None),
        ) {
            providers.push(Box::new(WebScraper::new(site, opts, app.clone())));
        }
    }

    providers
}

/// Instantiate OCR providers from their stored options.
fn build_ocr_providers(
    store: &Store,
    static_dir: &std::path::Path,
) -> Vec<Box<dyn OcrProviderObj>> {
    use crate::providers::ocr::baidu_ai::{BaiduOcr, BaiduOcrOptions};
    use crate::providers::ocr::tencent::{TencentOcr, TencentOcrOptions};

    let mut providers: Vec<Box<dyn OcrProviderObj>> = Vec::new();
    use crate::providers::ocr::ppocr::{PpOcr, PpOcrOptions};
    if let Ok(opts) = serde_json::from_value::<PpOcrOptions>(store.get("ocrProviders.PP-OCR", None))
    {
        providers.push(Box::new(PpOcr::new(opts, static_dir)));
    }
    if let Ok(opts) =
        serde_json::from_value::<BaiduOcrOptions>(store.get("ocrProviders.百度AI开放平台", None))
    {
        providers.push(Box::new(BaiduOcr::new(opts)));
    }
    if let Ok(opts) =
        serde_json::from_value::<TencentOcrOptions>(store.get("ocrProviders.腾讯云", None))
    {
        providers.push(Box::new(TencentOcr::new(opts)));
    }
    providers
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_from_translator_window_label() {
        assert_eq!(
            uuid_from_window("translator-550e8400-e29b-41d4-a716-446655440000"),
            Some("550e8400-e29b-41d4-a716-446655440000".to_string())
        );
    }

    #[test]
    fn uuid_from_ocr_guide_window_label() {
        assert_eq!(
            uuid_from_window("ocr-guide-abc-123"),
            Some("abc-123".to_string())
        );
    }

    #[test]
    fn main_window_has_no_uuid() {
        assert_eq!(uuid_from_window("main"), None);
        assert_eq!(uuid_from_window(""), None);
        assert_eq!(uuid_from_window("translator-"), Some(String::new()));
    }

    #[test]
    fn single_session_returns_first_or_none() {
        let registry = registry();
        assert_eq!(single_session_uuid(&registry), None);

        {
            let mut guard = registry.lock();
            guard.insert("s1".to_string(), Session::dummy());
            guard.insert("s2".to_string(), Session::dummy());
        }
        let uuid = single_session_uuid(&registry);
        assert!(matches!(uuid.as_deref(), Some("s1") | Some("s2")));
    }

    #[test]
    fn mouse_trigger_respects_options() {
        use crate::extractor::ocr::TriggerOptions;

        let opts = TriggerOptions::default();
        // WM_LBUTTONUP / WM_MOUSEWHEEL trigger by default.
        assert!(mouse_trigger(0x0202, &opts));
        assert!(mouse_trigger(0x020a, &opts));
        // Other mouse messages never trigger.
        assert!(!mouse_trigger(0x0201, &opts)); // WM_LBUTTONDOWN
        assert!(!mouse_trigger(0, &opts));

        let mut left_off = opts.clone();
        left_off.mouse.left = false;
        assert!(!mouse_trigger(0x0202, &left_off));
        assert!(mouse_trigger(0x020a, &left_off));

        left_off.mouse.wheel = false;
        assert!(!mouse_trigger(0x020a, &left_off));
    }

    #[test]
    fn keyboard_trigger_respects_options() {
        use crate::extractor::ocr::TriggerOptions;

        let opts = TriggerOptions::default();
        // WM_KEYUP + Space/Enter trigger by default.
        assert!(keyboard_trigger(0x0101, 0x20, &opts));
        assert!(keyboard_trigger(0x0101, 0x0d, &opts));
        // Key-down (WM_KEYDOWN) and unrelated keys never trigger.
        assert!(!keyboard_trigger(0x0100, 0x20, &opts));
        assert!(!keyboard_trigger(0x0101, 0x41, &opts)); // 'A'

        let mut space_off = opts.clone();
        space_off.keyboard.space = false;
        assert!(!keyboard_trigger(0x0101, 0x20, &space_off));
        assert!(keyboard_trigger(0x0101, 0x0d, &space_off));

        space_off.keyboard.enter = false;
        assert!(!keyboard_trigger(0x0101, 0x0d, &space_off));
    }

    #[test]
    fn ocr_trigger_options_falls_back_to_defaults_when_missing() {
        let dir = std::env::temp_dir().join(format!(
            "ame-session-ocr-options-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = crate::store::Store::load_from_dir(dir.clone()).unwrap();
        let opts = ocr_trigger_options(&store);
        assert_eq!(opts.delay, 500);
        assert!(opts.trigger.mouse.left);
        assert!(opts.trigger.keyboard.enter);
        assert_eq!(opts.trigger.movement.interval, 100);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn translate_watch_keys_survive_session_rebuild() {
        // switch_extractor_type 重建会话时必须保留已订阅的 key
        // （旧版 switchExtractor 保留 session 级 translateWatchList）。
        let old = Session::dummy();
        old.watch_translate("ocr-PP-OCR");
        old.watch_translate("any");

        let keys = old.translate_watch_keys_snapshot();
        assert_eq!(keys.len(), 2);

        let rebuilt = Session::dummy();
        rebuilt.restore_translate_watch_keys(keys);
        let restored = rebuilt.translate_watch_keys_snapshot();
        assert!(restored.contains(&"ocr-PP-OCR".to_string()));
        assert!(restored.contains(&"any".to_string()));
    }

    #[test]
    fn is_key_watched_respects_any_subscription() {
        let session = Session::dummy();
        // No subscriptions → nothing is watched.
        assert!(!session.is_key_watched("addr:name"));

        // Exact key subscription only watches that key.
        session.watch_translate("addr:1");
        assert!(session.is_key_watched("addr:1"));
        assert!(!session.is_key_watched("addr:2"));

        // Subscribing `any` watches every key.
        session.watch_translate("any");
        assert!(session.is_key_watched("addr:1"));
        assert!(session.is_key_watched("addr:2"));
        assert!(session.is_key_watched("ocr-PP-OCR"));

        // Unsubscribing `any` reverts to exact-key matching only.
        session.unwatch_translate("any");
        assert!(session.is_key_watched("addr:1"));
        assert!(!session.is_key_watched("addr:2"));
    }

    /// A session with an OCR extractor and a store whose `games` already
    /// contains an entry for `uuid`.
    fn session_with_game() -> (Session, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "ame-session-rect-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = crate::store::Store::load_from_dir(dir.clone()).unwrap();
        store
            .set(
                "games",
                serde_json::json!([{ "uuid": "game-uuid", "name": "test" }]),
            )
            .unwrap();
        let mut session = Session::dummy();
        session.store = store;
        session.uuid = "game-uuid".to_string();
        (session, dir)
    }

    #[test]
    fn set_ocr_rect_persists_latest_after_debounce() {
        // 拖动滑块连续 set_ocr_rect：只有最后一次应落盘（且必须是最新值）。
        let (session, dir) = session_with_game();
        let rect_a = serde_json::json!({ "left": 0, "top": 0, "width": 10, "height": 10 });
        let rect_b = serde_json::json!({ "left": 5, "top": 5, "width": 20, "height": 20 });
        session.set_ocr_rect(rect_a.clone()).unwrap();
        session.set_ocr_rect(rect_b.clone()).unwrap();

        // 等待防抖线程完成写盘（取消仅会取消旧线程，最新线程 300ms 后写入）。
        std::thread::sleep(std::time::Duration::from_millis(600));
        let games = session.store.get("games", None);
        assert_eq!(games[0]["ocr"]["rect"], rect_b, "latest rect must win");
        assert_ne!(games[0]["ocr"]["rect"], rect_a, "stale rect must not win");
        drop(session);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn destroy_cancels_inflight_ocr_rect_writer() {
        // destroy() 必须取消并 join 在途的防抖线程，使其不再写 store
        // （老 bug: 线程在会话销毁后仍可能访问已释放的 Store / 覆盖新值）。
        let (mut session, dir) = session_with_game();
        let rect = serde_json::json!({ "left": 1, "top": 2, "width": 3, "height": 4 });
        session.set_ocr_rect(rect.clone()).unwrap();

        // 立即销毁：取消在途 writer，join 返回（不应阻塞 300ms）。
        let start = std::time::Instant::now();
        session.destroy();
        assert!(
            start.elapsed() < std::time::Duration::from_millis(200),
            "destroy must not wait for the full debounce delay"
        );

        // 销毁后防抖线程要么被取消、要么已经完成写盘；无论哪种，不能 panic
        // 且 store 句柄仍可安全读取（线程已 join，不会悬挂访问）。
        let _ = session.store.get("games", None);
        drop(session);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn destroy_after_newer_rect_submission_keeps_latest() {
        // 旧线程被新请求取消，destroy 时新线程若已占位则不允许覆盖为新值之后
        // 又被旧线程回退。模拟：提交 A → 立即提交 B → 立即 destroy。
        let (mut session, dir) = session_with_game();
        let rect_a = serde_json::json!({ "left": 0, "top": 0, "width": 1, "height": 1 });
        let rect_b = serde_json::json!({ "left": 9, "top": 9, "width": 2, "height": 2 });
        session.set_ocr_rect(rect_a.clone()).unwrap();
        session.set_ocr_rect(rect_b.clone()).unwrap();
        session.destroy();

        // 两个线程都已 join（destroy 取消 + join），不会悬挂。
        drop(session);
        let _ = std::fs::remove_dir_all(dir);
    }

    impl Session {
        #[cfg(test)]
        fn dummy() -> Self {
            // Minimal, safe instance for registry tests.
            let dir = std::env::temp_dir().join(format!(
                "ame-session-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            Self {
                uuid: String::new(),
                game_pids: Vec::new(),
                extractor_type: String::new(),
                app: None,
                textractor: None,
                providers: Arc::new(Vec::new()),
                ocr_extractor: None,
                ocr_providers: Arc::new(Mutex::new(Vec::new())),
                extract_text: Arc::new(Mutex::new(HashMap::new())),
                listener_ids: Vec::new(),
                ocr_queue_pending: Arc::new(AtomicBool::new(false)),
                ocr_queue_notify: Arc::new(Notify::new()),
                ocr_queue_frame: Arc::new(Mutex::new(None)),
                ocr_movement_task: None,
                game_window_visible: Arc::new(AtomicBool::new(true)),
                translate_watch_keys: Arc::new(Mutex::new(HashMap::new())),
                store: crate::store::Store::load_from_dir(dir).unwrap(),
                ocr_rect_debounce: Arc::new(Mutex::new(None)),
                ocr_rect_seq: std::sync::atomic::AtomicU64::new(0),
            }
        }
    }
}
