//! Game / session commands — replaces `src/remote/startGame.ts`, `setting.ts`, `extract.ts`.

use serde_json::Value;
use tauri::State;

use crate::store::Store;

/// Start a game by launching its executable and detecting the new PID.
#[tauri::command]
pub async fn start_game(arg: Value) -> Result<Value, String> {
    crate::log_info!("rpc", "start_game <- path={:?}", arg["path"]);
    let path = arg["path"].as_str().ok_or("missing path")?.to_string();
    let exec_shell = arg["execShell"].as_str().unwrap_or("").to_string();

    // Record PIDs before launch so we can detect the new one.
    // PowerShell 子进程是秒级阻塞调用，必须放 blocking 线程池——直接在
    // async 命令里跑会占住 Tauri runtime 的 worker，拖累事件分发/翻译流。
    let old_pids = find_process_pids(path.clone()).await;

    // Launch via shell (PowerShell Start-Process style).
    launch_game(exec_shell, path.clone()).await?;

    // Poll for a new PID up to 10 times.
    for i in 0..10 {
        crate::log_info!("game", "wait for game to start, retry: {i}");
        let new_pids: Vec<u32> = find_process_pids(path.clone())
            .await
            .into_iter()
            .filter(|p| !old_pids.contains(p))
            .collect();
        if !new_pids.is_empty() {
            crate::log_info!("game", "find game pid: {new_pids:?}");
            return Ok(serde_json::json!({ "pids": new_pids }));
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
    Err("无法找到游戏进程".into())
}

/// Get the game setting for the current session by uuid.
#[tauri::command]
pub fn get_game_setting<R: tauri::Runtime>(
    store: State<'_, Store>,
    registry: State<'_, crate::session::SessionRegistry>,
    window: tauri::Webview<R>,
) -> Value {
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry));
    let Some(uuid) = uuid else {
        return Value::Null;
    };
    let games = store.get("games", Some(serde_json::json!([])));
    games
        .as_array()
        .and_then(|arr| arr.iter().find(|g| g["uuid"] == uuid).cloned())
        .unwrap_or(Value::Null)
}

/// Save the selected hook keys for a game.
#[tauri::command]
pub fn set_game_select_keys<R: tauri::Runtime>(
    store: State<'_, Store>,
    registry: State<'_, crate::session::SessionRegistry>,
    window: tauri::Webview<R>,
    keys: Vec<String>,
) -> Result<(), String> {
    let uuid = crate::session::uuid_from_window(window.label())
        .or_else(|| crate::session::single_session_uuid(&registry))
        .ok_or("no active session")?;
    let mut games = store.get("games", Some(serde_json::json!([])));
    if let Some(arr) = games.as_array_mut() {
        if let Some(game) = arr.iter_mut().find(|g| g["uuid"] == uuid) {
            game["selectKeys"] = serde_json::json!(keys);
        }
    }
    store.set("games", games).map_err(|e| e.to_string())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Find PIDs of running processes whose executable matches the given path.
///
/// PowerShell is a multi-second blocking call, so this is a `spawn_blocking`
/// wrapper; the actual script lives in [`find_process_pids_blocking`].
async fn find_process_pids(path: String) -> Vec<u32> {
    tokio::task::spawn_blocking(move || find_process_pids_blocking(&path))
        .await
        .unwrap_or_default()
}

/// Find PIDs of running processes whose executable matches the given path.
fn find_process_pids_blocking(path: &str) -> Vec<u32> {
    // Use PowerShell Get-Process to match by path. This mirrors the original
    // `findProcess` implementation in src/main/win32.
    let name = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let escaped_name = name.replace('\'', "''");
    let escaped_path = path.replace('\'', "''");
    let script = format!(
        "Get-Process -ErrorAction SilentlyContinue | where ProcessName -eq '{}' | where Path -eq '{}' | Select-Object -ExpandProperty Id",
        escaped_name, escaped_path
    );
    let mut cmd = std::process::Command::new("powershell");
    crate::win32::hide_console(&mut cmd);
    match cmd.args(["-NoProfile", "-Command", &script]).output() {
        Ok(out) => String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter_map(|l| l.trim().parse::<u32>().ok())
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// Launch the game using the configured shell command (blocking; see
/// [`find_process_pids`]).
async fn launch_game(exec_shell: String, path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || launch_game_blocking(&exec_shell, &path))
        .await
        .map_err(|e| e.to_string())?
}

fn launch_game_blocking(exec_shell: &str, path: &str) -> Result<(), String> {
    let dir = std::path::Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let cmd = if exec_shell.is_empty() {
        format!("Start-Process -FilePath '{}'", path.replace('\'', "''"))
    } else {
        exec_shell.to_string()
    };

    let mut ps = std::process::Command::new("powershell");
    crate::win32::hide_console(&mut ps);
    let status = ps
        .args(["-NoProfile", "-Command", &cmd])
        .current_dir(&dir)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("Failed to launch game".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_process_pids_matches_running_process_by_path() {
        // 回归：按"进程名 + 完整路径"匹配必须能找到自身（Start-Game 靠它
        // 识别新启动的游戏进程）。
        let exe = std::env::current_exe().unwrap();
        let pids = find_process_pids_blocking(exe.to_str().unwrap());
        assert!(
            pids.contains(&std::process::id()),
            "own pid {} not found in {pids:?}",
            std::process::id()
        );
    }

    #[test]
    fn find_process_pids_unknown_path_returns_empty() {
        assert!(find_process_pids_blocking("C:\\nonexistent\\no-such-game.exe").is_empty());
    }
}
