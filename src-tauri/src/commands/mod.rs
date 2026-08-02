//! Tauri command handlers (IPC surface), replacing `src/remote/*.ts`.

pub mod game;
pub mod misc;
pub mod options;
pub mod session;
pub mod store;
pub mod win32;
pub mod window;
pub mod window_mgmt;

#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}
