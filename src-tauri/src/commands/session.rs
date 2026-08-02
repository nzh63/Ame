//! Session commands — replaces `src/remote/extract.ts`, `textractor.ts`.

use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::extractor::textractor::PostProcessOption;
use crate::paths;
use crate::session::{Session, SessionRegistry};
use crate::store::Store;

/// Start a new extraction/translation session.
///
/// Must be `async`: on Windows, creating a WebviewWindow inside a synchronous
/// command deadlocks the WebView2 controller initialization (see the Tauri
/// docs for `WebviewWindowBuilder`).
#[tauri::command]
pub async fn start_extract(
    app: AppHandle,
    store: State<'_, Store>,
    registry: State<'_, SessionRegistry>,
    uuid: String,
    game_pids: Vec<u32>,
    hook_code: Option<String>,
    r#type: Option<String>,
) -> Result<(), String> {
    crate::log_info!(
        "rpc",
        "start_extract <- uuid={uuid} pids={game_pids:?} type={:?}",
        r#type
    );
    let extractor_type = r#type.unwrap_or_else(|| "textractor".into());
    let hook_code = hook_code.unwrap_or_default();
    let static_dir = paths::static_dir(&app);

    let session = Session::start(
        app,
        (*store).clone(),
        registry.inner().clone(),
        uuid.clone(),
        game_pids,
        hook_code,
        extractor_type,
        static_dir,
        true,
    )?;

    registry.lock().insert(uuid, session);
    crate::log_info!("rpc", "start_extract -> ok");
    Ok(())
}

/// Get the extractor type for a session.
#[tauri::command]
pub fn get_extractor_type<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: tauri::Webview<R>,
) -> Option<String> {
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry))?;
    registry.lock().get(&uuid).map(|s| s.extractor_type.clone())
}

/// Get Textractor post-processing options.
#[tauri::command]
pub fn get_textractor_post_process_option<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: tauri::Webview<R>,
) -> Option<PostProcessOption> {
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry))?;
    registry
        .lock()
        .get(&uuid)
        .and_then(|s| s.get_textractor_post_process())
}

/// Set Textractor post-processing options.
#[tauri::command]
pub fn set_textractor_post_process_option<R: tauri::Runtime>(
    registry: State<'_, SessionRegistry>,
    window: tauri::Webview<R>,
    option: PostProcessOption,
) -> Result<(), String> {
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry))
        .ok_or("no active session")?;
    registry
        .lock()
        .get_mut(&uuid)
        .map(|s| s.set_textractor_post_process(option))
        .ok_or_else(|| "session not found".into())
}

/// Destroy a session.
#[tauri::command]
pub fn destroy_session(registry: State<'_, SessionRegistry>, uuid: String) {
    crate::log_info!("rpc", "destroy_session <- {uuid}");
    if let Some(mut session) = registry.lock().remove(&uuid) {
        session.destroy();
    }
}

/// Keep the registry type referenced so it is managed as state.
#[allow(dead_code)]
fn _assert_registry(reg: Arc<SessionRegistry>) -> Arc<SessionRegistry> {
    reg
}
