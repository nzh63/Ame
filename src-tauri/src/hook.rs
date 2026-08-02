//! Hook orchestrator — replaces `src/main/hook/index.ts`.
//!
//! Combines WindowEventHook (move/minimize/restore) with global keyboard/mouse
//! hooks, and watches for game process exit.

use tauri::AppHandle;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex, OnceLock};

use crate::win32;

/// Handle to the single process-exit watcher thread so `stop()` can cancel
/// and join it (the old design leaked one blocking thread per session start).
struct WatcherCtl {
    stopped: Arc<AtomicBool>,
    handle: Option<std::thread::JoinHandle<()>>,
}

static WATCHER: OnceLock<StdMutex<Option<WatcherCtl>>> = OnceLock::new();

fn watcher() -> &'static StdMutex<Option<WatcherCtl>> {
    WATCHER.get_or_init(|| StdMutex::new(None))
}

/// Start all hooks for a game session.
///
/// - WindowEventHook: emits `window-move`, `window-minimize`, `window-restore`
/// - GlobalKeyboardHook: emits `global-keyboard` (key-down/key-up)
/// - GlobalMouseHook: emits `global-mouse` (left-down/left-up/wheel)
/// - Process watcher: emits `game-exit` when all PIDs exit
pub fn start(app: &AppHandle, game_pids: Vec<u32>) {
    crate::log_info!("hook", "start hook for pids {game_pids:?}");
    // Window move/minimize/restore tracking.
    win32::window_event_hook::start(app.clone(), game_pids.clone());

    // Global keyboard/mouse hooks.
    win32::windows_hook::start(app.clone());

    // Watch for game process exit.
    stop_watcher();
    let stopped = Arc::new(AtomicBool::new(false));
    let stopped_thread = stopped.clone();
    let app_exit = app.clone();
    let pids = game_pids.clone();
    let handle = std::thread::spawn(move || {
        while !stopped_thread.load(Ordering::SeqCst) {
            if win32::process::all_processes_exited(&pids) {
                use tauri::Emitter;
                // 关键：Tauri 的 `emit` 是同步分发的，`game-exit` 监听器里的
                // `hook::stop()` → `stop_watcher()` 会 join 当前线程。先把
                // 自己从注册表取出，stop_watcher 就找不到可 join 的句柄，
                // 否则在这里 join 自己 → 死锁（关闭游戏后再开必定卡死）。
                watcher().lock().unwrap().take();
                let _ = app_exit.emit("game-exit", ());
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
    *watcher().lock().unwrap() = Some(WatcherCtl {
        stopped,
        handle: Some(handle),
    });
}

/// Stop all hooks.
pub fn stop() {
    crate::log_info!("hook", "end hook");
    win32::window_event_hook::stop();
    win32::windows_hook::stop();
    stop_watcher();
}

fn stop_watcher() {
    let watcher = watcher().lock().unwrap().take();
    let Some(watcher) = watcher else { return };
    watcher.stopped.store(true, Ordering::SeqCst);
    if let Some(handle) = watcher.handle {
        let _ = handle.join();
    }
}
