// Provider trait methods are invoked via dynamic dispatch (trait objects),
// which the compiler cannot statically trace. Suppress the resulting noise.
#![allow(dead_code)]
// The `ame` crate is also built as a cdylib; MSVC's link.exe prints the
// "creating library ... .lib and object ... .exp" lines for the import lib,
// which rustc surfaces via the `linker_messages` lint. Harmless — silence it.
#![allow(linker_messages)]

mod commands;
mod crypto;
mod extractor;
mod hook;
pub mod logger;
mod manager;
mod paths;
mod provider;
mod providers;
mod schema;
mod session;
mod store;
mod win32;
mod window;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Set before `app.exit(0)` from the tray "退出" item so the
/// `ExitRequested` handler knows the quit is intentional.
static QUITTING: AtomicBool = AtomicBool::new(false);

// The lib unit-test harness is compiled as a separate executable and, unlike
// the app binary and integration-test binaries, does not receive tauri-build's
// `resource.lib` (which embeds the Common Controls v6 manifest) via Cargo link
// directives. Without the manifest, the test binary fails to start on systems
// whose comctl32 v5 lacks entries like TaskDialogIndirect (STATUS_ENTRYPOINT_NOT_FOUND,
// 0xC0000139). Link the resource from the build script's OUT_DIR directly.
#[cfg(all(test, target_os = "windows", target_env = "msvc"))]
#[link(name = "resource", kind = "static")]
extern "C" {}

/// Create the main window.
///
/// The window is created hidden and shown once the page finished loading
/// (mirrors the old Electron `ready-to-show` → `show()`). Debug builds
/// additionally support E2E tests, which drive hidden per-worker WebView2
/// instances via environment variables:
///  - AME_E2E_CDP_PORT: enable the DevTools protocol on this port
///  - AME_E2E_USER_DATA: isolated WebView2 user data folder
fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    let e2e_mode = std::env::var("AME_E2E_CDP_PORT").is_ok();
    let mut window =
        WebviewWindowBuilder::new(app, "main", WebviewUrl::App("MainWindow.html".into()))
            .title("Ame - Visual Novel Translator")
            .inner_size(1280.0, 720.0)
            .min_inner_size(620.0, 400.0)
            .decorations(false)
            .visible(false)
            .center();
    // Mirror the old Electron `ready-to-show` → `show()`: the window stays
    // hidden until the page finished loading (unless e2e mode, where tests
    // drive the hidden webview over CDP).
    window = window.on_page_load(move |win, payload| {
        #[cfg(debug_assertions)]
        if !e2e_mode && payload.event() == tauri::webview::PageLoadEvent::Finished {
            let _ = win.show();
        }
        #[cfg(not(debug_assertions))]
        if payload.event() == tauri::webview::PageLoadEvent::Finished {
            let _ = win.show();
        }
    });
    #[cfg(debug_assertions)]
    if let Ok(port) = std::env::var("AME_E2E_CDP_PORT") {
        window = window.additional_browser_args(&format!("--remote-debugging-port={port}"));
    }
    #[cfg(debug_assertions)]
    if let Ok(dir) = std::env::var("AME_E2E_USER_DATA") {
        window = window.data_directory(std::path::PathBuf::from(dir));
    }
    window.build()?;
    Ok(())
}

/// Show the main window, recreating it if it was closed (tray reopen path,
/// mirrors the old Electron `createMainWindow()`).
fn show_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    } else if let Err(e) = create_main_window(app) {
        crate::log_info!("window", "failed to recreate main window: {e}");
    }
}

/// Destroy every active session (mirrors the old Electron
/// `Session.getAllInstances().forEach((i) => i.destroy())`).
fn destroy_all_sessions(app: &AppHandle) {
    if let Some(registry) = app.try_state::<crate::session::SessionRegistry>() {
        let mut sessions = registry.lock();
        for (_, mut session) in sessions.drain() {
            session.destroy();
        }
    }
}

/// Quit from the tray menu: clean up sessions, then exit.
fn quit_app(app: &AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    destroy_all_sessions(app);
    // 退出前同步等最后一次落盘完成，避免刚保存的设置丢失。
    if let Some(store) = app.try_state::<crate::store::Store>() {
        store.flush();
    }
    app.exit(0);
}

pub fn run() {
    // Windows 通知（tauri-plugin-notification）要求进程有 AppUserModelID，
    // 否则系统托盘通知不会显示。dev 模式下插件不会自动设置，这里显式设置
    // （打包安装版与开发版行为一致）。
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;
        static APP_ID: std::sync::OnceLock<Vec<u16>> = std::sync::OnceLock::new();
        let app_id_utf16 = APP_ID.get_or_init(|| "nzh63.ame\0".encode_utf16().collect());
        let app_id = windows::core::PCWSTR(app_id_utf16.as_ptr());
        let _ = SetCurrentProcessExplicitAppUserModelID(app_id);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_main" => show_main_window(app),
            "quit" => quit_app(app),
            _ => {}
        })
        .setup(|app| {
            // Diagnostic provider self-test mode (AME_PROVIDER_TEST): runs a
            // provider through the real app and exits; skip normal startup.
            #[cfg(debug_assertions)]
            if crate::providers::selftest::maybe_run(app)? {
                return Ok(());
            }

            // Persistent store + session registry, shared across commands.
            let store = crate::store::Store::load(app.handle().clone())?;
            // First launch: seed defaults (mirrors old electron-store schema
            // defaults) so option pages show real values instead of empties.
            crate::commands::options::seed_store_defaults(&store)?;
            app.manage(store);
            app.manage(crate::session::registry());
            // Packaged apps ship ppocr_ffi.dll under the resources dir
            // (build/static/native/bin → resources/static/native/bin).
            if let Ok(resource_dir) = app.path().resource_dir() {
                crate::providers::ocr::ppocr::init_resource_dir(
                    &resource_dir.join("static/native/bin"),
                );
            }

            // System tray, mirroring the old Electron tray:
            //  - right-click menu: 打开主界面 / 退出
            //  - double-click: open the main window
            //  - tooltip: Ame
            // The tray is managed as state so the icon is not dropped.
            let open_main = MenuItem::with_id(app, "open_main", "打开主界面", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_main, &quit])?;
            let tray = TrayIconBuilder::with_id("main-tray")
                .icon(
                    app.default_window_icon()
                        .ok_or("missing default window icon")?
                        .clone(),
                )
                .tooltip("Ame")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    // Old Electron: `tray.on('double-click', createMainWindow)`.
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            app.manage(tray);

            create_main_window(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            // game
            commands::game::start_game,
            commands::game::get_game_setting,
            commands::game::set_game_select_keys,
            // misc
            commands::misc::watch_original,
            commands::misc::unwatch_original,
            commands::misc::watch_translate,
            commands::misc::unwatch_translate,
            commands::misc::tts_speak,
            commands::misc::segment,
            commands::misc::dict_query,
            commands::misc::show_context_menu,
            commands::misc::get_all_extract_text,
            commands::misc::switch_extractor_type,
            commands::misc::get_screen_capture,
            commands::misc::get_screen_capture_crop_rect,
            commands::misc::set_screen_capture_crop_rect,
            commands::misc::get_screen_capture_preprocess_option,
            commands::misc::set_screen_capture_preprocess_option,
            commands::misc::get_preprocessed_image,
            // options
            commands::options::get_providers_ids,
            commands::options::get_provider_options_meta,
            commands::options::get_provider_options,
            commands::options::set_provider_options,
            commands::options::get_manager_options_meta,
            commands::options::get_manager_options,
            commands::options::set_manager_options,
            commands::options::get_extractor_options_meta,
            commands::options::get_extractor_options,
            commands::options::set_extractor_options,
            // session
            commands::session::start_extract,
            commands::session::get_extractor_type,
            commands::session::get_textractor_post_process_option,
            commands::session::set_textractor_post_process_option,
            commands::session::destroy_session,
            // store
            commands::store::store_get,
            commands::store::store_set,
            commands::store::store_has,
            commands::store::store_delete,
            commands::store::store_reset,
            commands::store::store_clear,
            // win32
            commands::win32::find_window,
            commands::win32::capture_window,
            commands::win32::is_wow64,
            commands::win32::wait_process_for_exit,
            commands::win32::get_pid_from_point,
            // window management
            commands::window_mgmt::create_translator_window,
            commands::window_mgmt::open_ocr_guide_window,
            commands::window_mgmt::start_session_hooks,
            commands::window_mgmt::stop_session_hooks,
            commands::window_mgmt::find_window_by_click,
            // window
            commands::window::resize_window,
            commands::window::minimize_window,
            commands::window::toggle_maximize_window,
            commands::window::close_window,
            commands::window::hide_window,
            commands::window::show_window,
            commands::window::set_window_always_on_top,
            commands::window::show_open_dialog,
            commands::window::read_icon,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Ame application")
        .run(|_app_handle, event| {
            // Closing the last window keeps the app alive in the tray
            // (old Electron: `window-all-closed` → do nothing). The tray
            // "退出" item sets QUITTING and calls app.exit(0), so that is the
            // only path that actually exits.
            if let RunEvent::ExitRequested { api, .. } = event {
                if !QUITTING.load(Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}
