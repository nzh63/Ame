//! Window management — replaces `src/main/window/`.
//!
//! Creates and manages the translator overlay window (transparent, frameless,
//! always-on-top) and the OCR guide wizard window.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::win32;

/// Create the translator overlay window for a game session.
///
/// The window is transparent, frameless, and follows the game window via the
/// window-move/minimize/restore events emitted by `win32::window_event_hook`.
pub fn create_translator_window(app: &AppHandle, uuid: &str) -> Result<(), String> {
    let label = format!("translator-{uuid}");
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }
    crate::log_info!("window", "create TranslatorWindow for uuid {uuid}");

    let url = window_url(app, "TranslatorWindow.html");
    #[cfg(debug_assertions)]
    let e2e_mode = std::env::var("AME_E2E_CDP_PORT").is_ok();
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("Ame Translator")
        .inner_size(800.0, 300.0)
        .min_inner_size(350.0, 50.0)
        .transparent(true)
        .decorations(false)
        // 透明叠加层不需要系统阴影：无边框窗口默认带 undecorated shadow，
        // 会画出难看的黑边/阴影框。
        .shadow(false)
        .maximizable(false);
    // Electron: translator 窗口 ready-to-show 后隐藏主窗口（游戏覆盖层模式）。
    if !e2e_mode {
        builder = builder.on_page_load(move |win, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                if let Some(main) = win.app_handle().get_webview_window("main") {
                    let _ = main.hide();
                }
            }
        });
    }
    #[cfg(debug_assertions)]
    if e2e_mode {
        // Keep overlay windows hidden during parallel e2e runs.
        builder = builder.visible(false);
        // Share the main window's WebView2 browser process so the overlay is
        // reachable over the same CDP endpoint. Additional browser args and
        // user-data folder MUST match the main window: WebView2 refuses to
        // run two browser processes on the same user-data folder, which
        // silently destroys the second window.
        if let Ok(port) = std::env::var("AME_E2E_CDP_PORT") {
            builder = builder.additional_browser_args(&format!("--remote-debugging-port={port}"));
        }
        if let Ok(dir) = std::env::var("AME_E2E_USER_DATA") {
            builder = builder.data_directory(std::path::PathBuf::from(dir));
        }
    }
    // Note: the overlay is transparent, so it is invisible on screen until
    // content paints — no need for visible(false)+show (mirrors the old
    // Electron `ready-to-show` → `show()` without the white-flash concern).
    let window = builder.build().map_err(|e| e.to_string())?;
    // Electron: translator 窗口 focus/blur 时向渲染进程发送
    // `window-focus` / `window-blur`（前端用它们控制标题栏显隐）。
    let app_handle = window.app_handle().clone();
    // Electron: 按是否平板/触屏设置 `tablet-mode` 属性（影响标题栏高度）。
    let window_label = window.label().to_string();
    let tablet_mode = crate::win32::is_tablet_mode();
    let _ = window.eval(format!(
        "document.documentElement.setAttribute('tablet-mode', '{}');",
        if tablet_mode { "true" } else { "false" }
    ));
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Focused(focused) => {
                let _ = app_handle.emit(
                    if *focused {
                        "window-focus"
                    } else {
                        "window-blur"
                    },
                    (),
                );
            }
            // Electron: resize 时重新判断平板模式。
            tauri::WindowEvent::Resized(_) => {
                let tablet = crate::win32::is_tablet_mode();
                if let Some(win) = app_handle.get_webview_window(&window_label) {
                    let _ = win.eval(format!(
                        "document.documentElement.setAttribute('tablet-mode', '{}');",
                        if tablet { "true" } else { "false" }
                    ));
                }
            }
            _ => {}
        }
    });
    Ok(())
}

/// Create the OCR guide wizard window.
pub fn create_ocr_guide_window(app: &AppHandle, uuid: &str) -> Result<(), String> {
    let label = format!("ocr-guide-{uuid}");
    if app.get_webview_window(&label).is_some() {
        let _ = app.get_webview_window(&label).map(|w| w.set_focus());
        return Ok(());
    }

    let url = window_url(app, "OcrGuide.html");
    #[cfg(debug_assertions)]
    let e2e_mode = std::env::var("AME_E2E_CDP_PORT").is_ok();
    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title("OCR 设置向导")
        .inner_size(900.0, 600.0);
    #[cfg(debug_assertions)]
    if e2e_mode {
        // Same WebView2 browser-process sharing rules as the translator
        // window (see create_translator_window).
        builder = builder.visible(false);
        if let Ok(port) = std::env::var("AME_E2E_CDP_PORT") {
            builder = builder.additional_browser_args(&format!("--remote-debugging-port={port}"));
        }
        if let Ok(dir) = std::env::var("AME_E2E_USER_DATA") {
            builder = builder.data_directory(std::path::PathBuf::from(dir));
        }
    }
    let window = builder.build().map_err(|e| e.to_string())?;
    // Electron: 向导关闭后恢复 translator 显示并 resume 提取。
    let translator_label = format!("translator-{uuid}");
    let uuid2 = uuid.to_string();
    let app_handle = window.app_handle().clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(session_registry) =
                app_handle.try_state::<crate::session::SessionRegistry>()
            {
                if let Some(session) = session_registry.lock().get(&uuid2) {
                    if let Some(ext) = session.ocr_extractor() {
                        ext.lock()
                            .paused
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                    }
                }
            }
            if let Some(translator) = app_handle.get_webview_window(&translator_label) {
                let _ = translator.show();
            }
        }
    });
    Ok(())
}

/// Move the translator window by a screen-space delta (from game window move).
pub fn move_translator_window(
    app: &AppHandle,
    uuid: &str,
    diff_left: i32,
    diff_top: i32,
) -> Result<(), String> {
    let label = format!("translator-{uuid}");
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| "translator window not found".to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    window
        .set_position(tauri::PhysicalPosition::new(
            pos.x + diff_left,
            pos.y + diff_top,
        ))
        .map_err(|e| e.to_string())
}

/// Find a game window by having the user click on it.
/// Returns the PID of the clicked window.
///
/// Mirrors `src/remote/findWindow.ts`: waits for the next global left-click
/// (`WM_LBUTTONDOWN`) and returns the PID of the window under the cursor.
pub async fn find_window_by_click(app: &AppHandle) -> Result<u32, String> {
    use tauri::Listener;

    // 全局鼠标钩子只在会话启动后才存在；点击选取窗口是独立入口，
    // 这里临时占用一次（引用计数，不会拆掉正在运行的会话钩子）。
    crate::win32::windows_hook::start(app.clone());

    // 旧版行为：最小化主窗口，让用户能直接点到游戏窗口。
    let main_minimized = app
        .get_webview_window("main")
        .is_some_and(|w| w.minimize().is_ok());
    // 系统通知提示用户点击游戏窗口（非模态，不阻挡点击；主窗口已最小化，
    // UI 提示不可见，所以用系统通知）。
    use tauri_plugin_notification::NotificationExt;
    let _ = app
        .notification()
        .builder()
        .title("Ame")
        .body("请点击要跟踪的游戏窗口")
        .show();

    let (tx, rx) = tokio::sync::oneshot::channel::<u32>();
    let tx = std::sync::Mutex::new(Some(tx));

    // Listen for the next global mouse left-button-down event.
    let _listener_id = app.listen_any("global-mouse", move |event| {
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            let wparam = payload["wParam"].as_u64().unwrap_or(0);
            // WM_LBUTTONDOWN = 0x0201
            if wparam == 0x0201 {
                let x = payload["pt"]["x"].as_i64().unwrap_or(0) as i32;
                let y = payload["pt"]["y"].as_i64().unwrap_or(0) as i32;
                let pid = crate::win32::process::get_pid_from_point(x, y);
                if pid != 0 {
                    if let Some(tx) = tx.lock().unwrap().take() {
                        let _ = tx.send(pid);
                    }
                }
            }
        }
    });

    // Wait for the click (with a timeout so the UI never hangs forever).
    // Unlisten on EVERY exit path — the `?`-free match below guarantees the
    // listener is removed even on timeout/channel errors, so a later click
    // cannot fire into the dropped channel.
    let waited = tokio::time::timeout(std::time::Duration::from_secs(60), rx).await;
    app.unlisten(_listener_id);

    // 释放临时占用；若主窗口被我们最小化了则恢复。
    crate::win32::windows_hook::stop();
    if main_minimized {
        if let Some(win) = app.get_webview_window("main") {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }
    }

    match waited {
        Ok(Ok(pid)) => Ok(pid),
        Ok(Err(_)) => Err("等待点击失败".to_string()),
        Err(_) => Err("等待点击超时".to_string()),
    }
}
/// Resolve the frontend URL for a given HTML page, respecting dev/prod mode.
fn window_url(app: &AppHandle, page: &str) -> String {
    // In dev, Tauri serves the frontend from devUrl; in prod, from the bundled
    // assets. WebviewUrl::App already handles the base, so we just return the
    // relative page path.
    let _ = app;
    page.to_string()
}

/// Start watching a game's windows (minimize/move) and global input hooks.
pub fn start_session_hooks(app: &AppHandle, pids: Vec<u32>) {
    win32::window_event_hook::start(app.clone(), pids);
    win32::windows_hook::start(app.clone());
}

/// Stop all session hooks.
pub fn stop_session_hooks() {
    win32::window_event_hook::stop();
    win32::windows_hook::stop();
}
