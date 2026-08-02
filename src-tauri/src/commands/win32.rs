//! Win32 commands — screen capture, process utilities, window finding.

use crate::win32;

#[tauri::command]
pub fn find_window(pids: Vec<u32>) -> u64 {
    crate::log_info!("rpc", "find_window <- pids={pids:?}");
    let r = win32::screen_capturer::find_window(&pids);
    crate::log_info!("rpc", "find_window -> {r}");
    r
}

#[tauri::command]
pub async fn capture_window(hwnd: u64) -> Result<(u32, u32, Vec<u8>), String> {
    // Run the blocking capture on a dedicated thread.
    tokio::task::spawn_blocking(move || {
        let img = win32::screen_capturer::capture(hwnd)?;
        Ok((img.width, img.height, img.buffer))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn is_wow64(pid: u32) -> bool {
    win32::process::is_wow64(pid)
}

#[tauri::command]
pub async fn wait_process_for_exit(pids: Vec<u32>) {
    let _ = tokio::task::spawn_blocking(move || {
        win32::process::wait_process_for_exit(&pids);
    })
    .await;
}

#[tauri::command]
pub fn get_pid_from_point(x: i32, y: i32) -> u32 {
    crate::log_info!("rpc", "get_pid_from_point <- ({x},{y})");
    let r = win32::process::get_pid_from_point(x, y);
    crate::log_info!("rpc", "get_pid_from_point -> {r}");
    r
}
