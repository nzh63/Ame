//! Miscellaneous commands — watch/unwatch, TTS, segment, dict, context menu,
//! extractor switching, and OCR-guide image pipelines.

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State, Webview};

use crate::extractor::ocr::PreprocessOption;
use crate::session::{self, SessionRegistry};
use crate::store::Store;

/// Resolve a session from the calling window's label (`translator-{uuid}` /
/// `ocr-guide-{uuid}`), falling back to the only active session.
fn session_uuid<R: tauri::Runtime>(
    window: &Webview<R>,
    registry: &SessionRegistry,
) -> Option<String> {
    if let Some(uuid) = session::uuid_from_window(window.label()) {
        return Some(uuid);
    }
    session::single_session_uuid(registry)
}

// ─── Watch / Unwatch ─────────────────────────────────────────────────────────
// The Rust backend emits all events unconditionally; the frontend filters by
// key. These commands exist for API compatibility but are no-ops.

#[tauri::command]
pub fn watch_original(_registry: State<'_, SessionRegistry>, key: String) {
    crate::log_info!("rpc", "watch_original <- {key}");
}

#[tauri::command]
pub fn unwatch_original(_registry: State<'_, SessionRegistry>, key: String) {
    crate::log_info!("rpc", "unwatch_original <- {key}");
}

#[tauri::command]
pub fn watch_translate<R: tauri::Runtime>(
    app: AppHandle,
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    key: String,
) {
    crate::log_info!("rpc", "watch_translate <- {key}");
    let Some(uuid) = session_uuid(&window, &registry) else {
        crate::log_info!("rpc", "watch_translate: no session");
        return;
    };
    let (providers, pending_text) = {
        let reg = registry.lock();
        let Some(session) = reg.get(&uuid) else {
            return;
        };
        session.watch_translate(&key);
        // Electron: 订阅时如果该 key 已有提取文本，立即触发一次翻译
        // （`watchTranslate` 里 `if (this.extractor.text[key]) callback(...)`）。
        // 订阅 `any` 时对每个已提取的 key 都触发一次（旧版 extractor 会把
        // 每个 key 以 `update:any` 回调给 `watchTranslate('any')`）。
        let pending = if key == "any" {
            session
                .get_all_extract_text()
                .as_object()
                .map(|m| {
                    m.iter()
                        .map(|(k, v)| (k.clone(), v.as_str().unwrap_or_default().to_string()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        } else {
            session
                .get_extract_text(&key)
                .map(|t| vec![(key.clone(), t)])
                .unwrap_or_default()
        };
        (session.providers(), pending)
    };
    for (key, text) in pending_text {
        let app = app.clone();
        let providers = providers.clone();
        tauri::async_runtime::spawn(async move {
            crate::session::run_translation(&app, providers, key, text).await;
        });
    }
}

#[tauri::command]
pub fn unwatch_translate<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    key: String,
) {
    crate::log_info!("rpc", "unwatch_translate <- {key}");
    let Some(uuid) = session_uuid(&window, &registry) else {
        crate::log_info!("rpc", "unwatch_translate: no session");
        return;
    };
    let reg = registry.lock();
    if let Some(session) = reg.get(&uuid) {
        session.unwatch_translate(&key);
    }
}

// ─── TTS ─────────────────────────────────────────────────────────────────────

/// Speak `text` via the Web Speech Synthesis API inside the calling window.
///
/// Mirrors the old `TtsManager.speak` → hidden-window `speechSynthesis.speak`
/// flow: the utterance runs in the translator window's webview, with the
/// configured voice (`ttsProviders.WebSpeechSynthesisApi.voice.*`) applied.
#[tauri::command]
pub fn tts_speak<R: tauri::Runtime>(
    store: State<'_, Store>,
    window: Webview<R>,
    text: String,
    r#type: String,
) {
    crate::log_info!("rpc", "tts_speak <- type={} text={:?}", r#type, text);
    // Only speak when the Web Speech Synthesis provider is enabled
    // (mirrors the old TtsManager default-provider ready check).
    let tts = store.get("ttsProviders.WebSpeechSynthesisApi", None);
    if tts["enable"].as_bool() == Some(false) {
        return;
    }
    let voice_uri = if r#type == "original" {
        tts["voice"]["originalVoiceURI"]
            .as_str()
            .map(|s| s.to_string())
    } else {
        tts["voice"]["translateVoiceURI"]
            .as_str()
            .map(|s| s.to_string())
    };
    let _ = window.eval(tts_speak_js(&text, voice_uri.as_deref()));
}

fn tts_speak_js(text: &str, voice_uri: Option<&str>) -> String {
    let text_json = serde_json::json!(text).to_string();
    let voice_js = match voice_uri {
        Some(uri) => format!(
            "const v = speechSynthesis.getVoices().find(v => v.voiceURI === {}); if (v) u.voice = v;",
            serde_json::json!(uri)
        ),
        None => String::new(),
    };
    format!(
        // WebView2/Chromium 的 speechSynthesis.cancel() 是异步的：紧跟着
        // speak() 时新 utterance 会被上一个 cancel 吞掉（表现为只有第一次
        // 点击出声）。cancel 后延迟一帧再 speak，并把引擎从暂停状态恢复。
        "speechSynthesis.cancel(); \
         setTimeout(() => {{ \
           const u = new SpeechSynthesisUtterance({text_json}); \
           {voice_js} \
           speechSynthesis.resume(); \
           speechSynthesis.speak(u); \
         }}, 50);"
    )
}

// ─── Segment ─────────────────────────────────────────────────────────────────
// Original: SegmentManager picks the default provider from store
// (`segmentManager.defaultProvider`). MeCab runs as a subprocess; intl-segmenter
// is handled on the frontend. Returns `SegmentWord[]` = [{ word, extraInfo? }].

#[tauri::command]
pub fn segment<R: tauri::Runtime>(
    store: State<'_, Store>,
    _registry: State<'_, SessionRegistry>,
    _window: Webview<R>,
    text: String,
) -> Vec<Value> {
    crate::log_info!("rpc", "segment <- {text:?}");
    let words = segment_words(&store, &text);
    crate::log_info!("rpc", "segment -> {} items", words.len());
    words
}

/// Core segment logic (testable without a Tauri runtime).
///
/// `intl-segmenter` runs in the frontend (`Intl.Segmenter`), so this command
/// only handles `mecab` (subprocess) and falls back to per-character
/// segmentation so the UI always shows clickable words.
fn segment_words(store: &Store, text: &str) -> Vec<Value> {
    use crate::providers::segment::SegmentProvider;

    let default_provider = store
        .get("segmentManager", None)
        .get("defaultProvider")
        .and_then(|v| v.as_str())
        .unwrap_or("intl-segmenter")
        .to_string();

    let words: Vec<Value> = if default_provider == "mecab" {
        let opts: crate::providers::segment::mecab::MecabOptions =
            serde_json::from_value(store.get("segmentProviders.mecab", None)).unwrap_or_default();
        let mecab = crate::providers::segment::mecab::Mecab::new(opts);
        if mecab.enabled() {
            mecab
                .segment(text.to_string())
                .into_iter()
                .map(|(word, extra)| {
                    let mut v = serde_json::json!({ "word": word });
                    if let Some(extra) = extra {
                        v["extraInfo"] = Value::String(extra);
                    }
                    v
                })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        // intl-segmenter (and anything else) is frontend-handled: return empty.
        Vec::new()
    };

    // Fall back to per-character segmentation so the UI still shows clickable
    // words when no segment provider is enabled (matches frontend Intl.Segmenter).
    if !words.is_empty() {
        return words;
    }
    text.chars()
        .map(|c| serde_json::json!({ "word": c.to_string() }))
        .collect()
}

// ─── Dict ────────────────────────────────────────────────────────────────────
// Original: DictManager picks the default provider, which opens the dictionary
// website in the system browser via `shell.openExternal`.

#[tauri::command]
pub async fn dict_query<R: tauri::Runtime>(
    app: AppHandle,
    store: State<'_, Store>,
    _registry: State<'_, SessionRegistry>,
    _window: Webview<R>,
    text: String,
) -> Result<Value, String> {
    crate::log_info!("rpc", "dict_query <- {text:?}");
    use crate::providers::dict::DictProvider;

    let default_provider = store
        .get("dictManager", None)
        .get("defaultProvider")
        .and_then(|v| v.as_str())
        .unwrap_or("有道词典")
        .to_string();

    let url = if default_provider == "沪江小D" {
        crate::providers::dict::hujiang::HujiangDict.query(&text)
    } else {
        crate::providers::dict::youdao::YoudaoDict.query(&text)
    };

    // Open the dictionary page in the system browser (mirrors shell.openExternal).
    #[allow(deprecated)]
    {
        use tauri_plugin_shell::ShellExt;
        let _ = app.shell().open(&url, None);
    }

    crate::log_info!("rpc", "dict_query -> {url}");
    Ok(serde_json::json!({ "url": url }))
}

// ─── Context Menu ────────────────────────────────────────────────────────────

/// Windows that already have the "大声朗读" menu-event handler registered.
///
/// `on_menu_event` registers a new handler on every call; `show_context_menu`
/// is invoked on each right-click / long-press, so without deduplication the
/// handlers would accumulate and clicking the item would emit multiple
/// `tts-speak-reply` events.
static MENU_HANDLER_REGISTERED: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashSet<String>>,
> = std::sync::OnceLock::new();

fn menu_registered() -> &'static std::sync::Mutex<std::collections::HashSet<String>> {
    MENU_HANDLER_REGISTERED.get_or_init(|| std::sync::Mutex::new(std::collections::HashSet::new()))
}

/// Returns `true` if the menu-event handler has already been registered for
/// this window label (and performs the first-time registration).
///
/// This is extracted so the deduplication logic is unit-testable without a
/// live Tauri window.
fn try_register_menu_handler(label: &str) -> bool {
    let mut set = menu_registered().lock().unwrap();
    !set.insert(label.to_string())
}

/// Forget a window label so a future window with the same label registers a
/// fresh handler.
///
/// 去重集合按 label 记录，但 label 在会话重建/游戏重启时会被复用
/// （`translator-{uuid}`）：旧窗口销毁后若不清除记录，新窗口永远注册
/// 不上处理器，右键"大声朗读"静默失效。窗口 Destroyed 时调用本函数。
fn unregister_menu_handler(label: &str) {
    menu_registered().lock().unwrap().remove(label);
}

/// Show the translator's native context menu (旧版 "大声朗读") at the cursor,
/// or at the given screen coordinates for touch long-press.
#[tauri::command]
pub fn show_context_menu<R: tauri::Runtime>(
    app: AppHandle,
    window: Webview<R>,
    x: Option<f64>,
    y: Option<f64>,
) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem};

    let label = window.label().to_string();
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("window '{label}' not found"))?;

    let speak = MenuItem::with_id(&app, "ttsSpeak", "大声朗读", true, None::<&str>)
        .map_err(|e| e.to_string())?;
    let menu = Menu::with_items(&app, &[&speak]).map_err(|e| e.to_string())?;

    // Clicking "大声朗读" tells the frontend to invoke `tts_speak` (the same
    // contract as the old Electron `webContents.send('tts-speak-reply')`).
    // Register the handler once per window to avoid accumulating duplicates.
    let already_registered = try_register_menu_handler(&label);
    if !already_registered {
        // 窗口销毁时清除去重记录：label 会被复用（translator-{uuid}），
        // 不清除的话新窗口注册不上处理器（右键菜单静默失效）。
        let label_destroyed = label.clone();
        win.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                unregister_menu_handler(&label_destroyed);
            }
        });
        win.on_menu_event(move |window, event| {
            if event.id.as_ref() == "ttsSpeak" {
                let _ = window.emit("tts-speak-reply", ());
            }
        });
    }

    match (x, y) {
        (Some(x), Some(y)) => {
            // Touch long-press passes screen coordinates; Tauri wants a
            // position relative to the window's top-left corner.
            let scale = win.scale_factor().map_err(|e| e.to_string())?;
            let origin = win.inner_position().map_err(|e| e.to_string())?;
            let rel_x = (x * scale - origin.x as f64).round() as i32;
            let rel_y = (y * scale - origin.y as f64).round() as i32;
            win.popup_menu_at(&menu, tauri::PhysicalPosition::new(rel_x, rel_y))
                .map_err(|e| e.to_string())
        }
        _ => win.popup_menu(&menu).map_err(|e| e.to_string()),
    }
}

// ─── Extract text ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_all_extract_text<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
) -> Value {
    let Some(uuid) = session_uuid(&window, &registry) else {
        return serde_json::json!({});
    };
    let reg = registry.lock();
    match reg.get(&uuid) {
        Some(session) => session.get_all_extract_text(),
        None => serde_json::json!({}),
    }
}

/// Switch the extractor type at runtime (textractor ↔ ocr).
///
/// Mirrors the original `Session.switchExtractor`: destroys the current
/// session and starts a new one with the requested extractor, preserving the
/// session uuid, game PIDs, and accumulated text.
#[tauri::command]
pub fn switch_extractor_type<R: tauri::Runtime>(
    app: AppHandle,
    store: State<'_, Store>,
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    r#type: String,
) -> Result<(), String> {
    let Some(uuid) = session_uuid(&window, &registry) else {
        return Err("no active session".into());
    };

    let (game_pids, hook_code, extract_text, watch_keys) = {
        let reg = registry.lock();
        let session = reg.get(&uuid).ok_or("session not found")?;
        if session.extractor_type == r#type {
            return Ok(());
        }
        (
            session.game_pids.clone(),
            session.textractor_hook_code().unwrap_or_default(),
            session.get_all_extract_text(),
            session.translate_watch_keys_snapshot(),
        )
    };

    if r#type != "textractor" && r#type != "ocr" {
        let t = &r#type;
        return Err(format!("unknown extractor type: {t}"));
    }

    // Destroy the old session (stops hooks/extractor) and start a new one.
    // The translator window label is reused, so no duplicate window is created.
    let static_dir = crate::paths::static_dir(&app);
    let new_session = crate::session::Session::start(
        app.clone(),
        (*store).clone(),
        registry.inner().clone(),
        uuid.clone(),
        game_pids.clone(),
        hook_code,
        r#type,
        static_dir,
        // Hooks are restarted below after the old session is torn down, so
        // start/stop never race or leave the global hooks stopped.
        false,
    )?;

    let mut reg = registry.lock();
    if let Some(mut old) = reg.remove(&uuid) {
        old.destroy();
        // Preserve extracted text across the switch.
        let new_extract =
            serde_json::from_value::<std::collections::HashMap<String, String>>(extract_text)
                .unwrap_or_default();
        new_session.restore_extract_text(new_extract);
    }
    // Re-establish the global input/window hooks for the new session.
    crate::hook::start(&app, game_pids);
    // 旧版 switchExtractor 保留 session 级 translateWatchList：重建会话时
    // 把已订阅的 key 迁移过来，切换提取方法后不需要重新选择。
    new_session.restore_translate_watch_keys(watch_keys);
    reg.insert(uuid, new_session);
    Ok(())
}

// ─── OCR commands ────────────────────────────────────────────────────────────
// These power the OCR guide window (OcrGuide.html):
//  - get_screen_capture             → PNG bytes of the game window
//  - get_screen_capture_crop_rect   → { left, top, width, height } (persisted)
//  - set_screen_capture_crop_rect   → persist + apply
//  - get_screen_capture_preprocess_option → { color, threshold? }
//  - set_screen_capture_preprocess_option → persist + apply
//  - get_preprocessed_image         → PNG bytes after color/threshold

#[tauri::command]
pub async fn get_screen_capture<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    force: Option<bool>,
) -> Result<Vec<u8>, String> {
    crate::log_info!("rpc", "get_screen_capture <- force={force:?}");
    let Some(uuid) = session_uuid(&window, &registry) else {
        return Err("no active session".into());
    };
    let ocr_ext = {
        let reg = registry.lock();
        let session = reg.get(&uuid).ok_or("session not found")?;
        session.ocr_extractor().ok_or("not in OCR mode")?
    };
    let force = force.unwrap_or(false);
    tokio::task::spawn_blocking(move || {
        let ext = ocr_ext.lock();
        // Electron `getLastCapture(force)`: force=false 复用上次截图，
        // force=true 重新截图（OCR 向导"重新加载"按钮传 force=true）。
        let img = ext.get_last_capture(force)?;
        let rgba = crate::extractor::ocr::bgra_to_rgba_flipped(&img.buffer, img.width, img.height)
            .ok_or("failed to build image")?;
        let mut png = Vec::new();
        rgba.write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        crate::log_info!("rpc", "get_screen_capture -> {} bytes", png.len());
        Ok(png)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_screen_capture_crop_rect<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
) -> Value {
    let Some(uuid) = session_uuid(&window, &registry) else {
        return Value::Null;
    };
    let reg = registry.lock();
    match reg.get(&uuid) {
        Some(session) => session.get_ocr_rect(),
        None => Value::Null,
    }
}

#[tauri::command]
pub fn set_screen_capture_crop_rect<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    rect: Value,
) -> Result<(), String> {
    crate::log_info!("rpc", "set_screen_capture_crop_rect <- {rect}");
    let Some(uuid) = session_uuid(&window, &registry) else {
        return Err("no active session".into());
    };
    let reg = registry.lock();
    match reg.get(&uuid) {
        Some(session) => session.set_ocr_rect(rect),
        None => Err("session not found".into()),
    }
}

#[tauri::command]
pub fn get_screen_capture_preprocess_option<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
) -> Value {
    let Some(uuid) = session_uuid(&window, &registry) else {
        return serde_json::json!({ "color": "colorful" });
    };
    let reg = registry.lock();
    match reg.get(&uuid) {
        Some(session) => session.get_ocr_preprocess(),
        None => serde_json::json!({ "color": "colorful" }),
    }
}

#[tauri::command]
pub fn set_screen_capture_preprocess_option<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: Webview<R>,
    option: Value,
) -> Result<(), String> {
    crate::log_info!("rpc", "set_screen_capture_preprocess_option <- {option}");
    let Some(uuid) = session_uuid(&window, &registry) else {
        return Err("no active session".into());
    };
    let reg = registry.lock();
    match reg.get(&uuid) {
        Some(session) => session.set_ocr_preprocess(option),
        None => Err("session not found".into()),
    }
}

#[tauri::command]
pub async fn get_preprocessed_image<R: tauri::Runtime>(
    _registry: State<'_, SessionRegistry>,
    _window: Webview<R>,
    img: Vec<u8>,
    option: Value,
) -> Result<Vec<u8>, String> {
    crate::log_info!("rpc", "get_preprocessed_image <- {} bytes", img.len());
    let preprocess: PreprocessOption =
        serde_json::from_value(option).unwrap_or_else(|_| PreprocessOption::default());
    // PNG 解码/灰度化/重编码是 CPU 密集操作，全屏截图动辄几 MB。
    // 必须在 blocking 线程池执行，否则同步命令会卡死 UI（OCR 向导滑块
    // 拖动时此命令被反复调用）。
    let inner: Result<Vec<u8>, String> = tokio::task::spawn_blocking(move || {
        let decoded = image::load_from_memory(&img).map_err(|e| e.to_string())?;
        let rgba = decoded.to_rgba8();
        let gray = crate::extractor::ocr::preprocess(&rgba, &preprocess);
        let mut out = Vec::new();
        gray.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?;
    let result = inner?;
    crate::log_info!("rpc", "get_preprocessed_image -> {} bytes", result.len());
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::segment_words;
    use super::try_register_menu_handler;
    use super::tts_speak_js;
    use super::unregister_menu_handler;
    use crate::store::Store;
    use serde_json::json;

    /// A temp store with a given `segmentManager.defaultProvider` (or a default
    /// of `intl-segmenter` when `None`).
    fn store_with_default_provider(default_provider: Option<&str>) -> Store {
        let dir = std::env::temp_dir().join(format!(
            "ame-segment-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = Store::load_from_dir(dir).unwrap();
        if let Some(p) = default_provider {
            store
                .set("segmentManager", json!({ "defaultProvider": p }))
                .unwrap();
        }
        store
    }

    #[test]
    fn segment_intl_segmenter_default_falls_back_to_per_char() {
        // intl-segmenter is frontend-handled: the Rust command returns the
        // per-character fallback so the UI still shows clickable words.
        let store = store_with_default_provider(None); // defaults to intl-segmenter
        let words = segment_words(&store, "こんにちは");
        let texts: Vec<&str> = words.iter().filter_map(|w| w["word"].as_str()).collect();
        assert_eq!(texts, vec!["こ", "ん", "に", "ち", "は"]);
    }

    #[test]
    fn segment_with_mecab_disabled_falls_back_to_per_char() {
        // mecab provider without a configured exe → not enabled → fallback.
        let store = store_with_default_provider(Some("mecab"));
        let words = segment_words(&store, "テスト");
        let texts: Vec<&str> = words.iter().filter_map(|w| w["word"].as_str()).collect();
        assert_eq!(texts, vec!["テ", "ス", "ト"]);
    }

    #[test]
    fn segment_empty_text_returns_empty() {
        let store = store_with_default_provider(None);
        let words = segment_words(&store, "");
        assert!(words.is_empty());
    }

    #[test]
    fn segment_unknown_provider_falls_back_to_per_char() {
        let store = store_with_default_provider(Some("nonexistent-provider"));
        let words = segment_words(&store, "abc");
        let texts: Vec<&str> = words.iter().filter_map(|w| w["word"].as_str()).collect();
        assert_eq!(texts, vec!["a", "b", "c"]);
    }

    #[test]
    fn tts_script_cancels_first_and_escapes_text() {
        let js = tts_speak_js("He said \"hi\"", None);
        assert!(js.starts_with("speechSynthesis.cancel();"));
        assert!(js.contains("new SpeechSynthesisUtterance(\"He said \\\"hi\\\"\")"));
        assert!(js.contains("speechSynthesis.speak(u);"));
        // WebView2 的 cancel() 异步生效，speak 必须延迟到 cancel 之后。
        assert!(js.contains("speechSynthesis.cancel();"));
        assert!(js.contains("setTimeout"));
        assert!(js.contains("speechSynthesis.resume();"));
        assert!(!js.contains("voiceURI"));
    }

    #[test]
    fn tts_script_applies_voice_uri_when_configured() {
        let js = tts_speak_js("text", Some("Microsoft Huihui Desktop"));
        assert!(js.contains("v.voiceURI === \"Microsoft Huihui Desktop\""));
    }

    #[test]
    fn menu_handler_is_registered_only_once_per_window() {
        // 每个窗口 label 只允许注册一次，重复点击右键不得累积多个回调
        // （old bug: 每次 show_context_menu 都 on_menu_event，导致重复 emit）。
        assert!(!try_register_menu_handler("translator-abc")); // first: not yet registered
        assert!(try_register_menu_handler("translator-abc")); // second: already registered
        assert!(try_register_menu_handler("translator-abc")); // third: still registered

        // 不同窗口互不影响。
        assert!(!try_register_menu_handler("translator-def")); // different window: first
        assert!(try_register_menu_handler("translator-def"));
    }

    #[test]
    fn menu_handler_reregisters_after_window_destroyed() {
        // 回归：label 会被复用（translator-{uuid}）。旧窗口 Destroyed 后
        // 必须清除记录，否则新窗口（同 label）的右键菜单静默失效。
        let label = "translator-reg";
        assert!(!try_register_menu_handler(label));
        assert!(try_register_menu_handler(label));
        unregister_menu_handler(label);
        // 新窗口同 label：必须允许重新注册。
        assert!(
            !try_register_menu_handler(label),
            "recreated window must register a fresh handler"
        );
    }
}
