//! Window management commands — translator overlay + OCR guide windows.

use tauri::AppHandle;
use tauri::Manager;

use crate::window;

/// Create the translator overlay window for a session.
///
/// Must be `async`: on Windows, creating a WebviewWindow inside a synchronous
/// command deadlocks (see Tauri docs for `WebviewWindowBuilder`).
#[tauri::command]
pub async fn create_translator_window(app: AppHandle, uuid: String) -> Result<(), String> {
    crate::log_info!("rpc", "create_translator_window <- {uuid}");
    window::create_translator_window(&app, &uuid)
}

/// Create the OCR guide wizard window.
#[tauri::command]
pub async fn open_ocr_guide_window<R: tauri::Runtime>(
    app: AppHandle,
    registry: tauri::State<'_, crate::session::SessionRegistry>,
    window: tauri::Webview<R>,
) -> Result<(), String> {
    crate::log_info!("rpc", "open_ocr_guide_window");
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry))
        .ok_or("no active session")?;
    // Electron: 打开 OCR 向导时隐藏 translator 并暂停提取（避免向导
    // 调整期间后台持续截图识别）。
    let is_ocr = registry
        .lock()
        .get(&uuid)
        .and_then(|s| s.ocr_extractor())
        .is_some();
    if !is_ocr {
        // Electron: `openOcrGuideWindow` 非 OCR 模式抛错。
        return Err("not in OCR mode".into());
    }
    if let Some(session) = registry.lock().get(&uuid) {
        if let Some(ext) = session.ocr_extractor() {
            ext.lock()
                .paused
                .store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }
    let translator_label = format!("translator-{uuid}");
    if let Some(translator) = app.get_webview_window(&translator_label) {
        let _ = translator.hide();
    }
    window::create_ocr_guide_window(&app, &uuid)
}

/// Start the window-following and global input hooks for a session.
#[tauri::command]
pub fn start_session_hooks(app: AppHandle, pids: Vec<u32>) {
    crate::log_info!("rpc", "start_session_hooks <- pids={pids:?}");
    window::start_session_hooks(&app, pids);
}

/// Stop all session hooks.
#[tauri::command]
pub fn stop_session_hooks() {
    crate::log_info!("rpc", "stop_session_hooks");
    window::stop_session_hooks();
}

/// Find a game window by clicking on it.
#[tauri::command]
pub async fn find_window_by_click(app: AppHandle) -> Result<u32, String> {
    crate::log_info!("rpc", "find_window_by_click");
    let r = window::find_window_by_click(&app).await;
    crate::log_info!("rpc", "find_window_by_click -> {r:?}");
    r
}
