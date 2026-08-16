//! Process utilities — replaces `native/addons/Process`.
//!
//! Provides `is_wow64`, `wait_process_for_exit`, and `get_pid_from_point`.

use windows::Win32::Foundation::{CloseHandle, HANDLE, POINT};
use windows::Win32::System::Threading::{
    GetExitCodeProcess, OpenProcess, WaitForMultipleObjects, PROCESS_ACCESS_RIGHTS,
    PROCESS_QUERY_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{GetWindowThreadProcessId, WindowFromPoint};

const PROCESS_WOW64_INFORMATION: u32 = 26;
const SYNCHRONIZE: PROCESS_ACCESS_RIGHTS = PROCESS_ACCESS_RIGHTS(0x00100000);

extern "system" {
    fn NtQueryInformationProcess(
        process_handle: HANDLE,
        process_information_class: u32,
        process_information: *mut std::ffi::c_void,
        process_information_length: u32,
        return_length: *mut u32,
    ) -> i32;
}

/// Check whether a process is 32-bit (WoW64) on 64-bit Windows.
pub fn is_wow64(pid: u32) -> bool {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid);
        let Ok(handle) = handle else {
            return false;
        };
        let mut ret: usize = 0;
        let mut ret_len: u32 = 0;
        NtQueryInformationProcess(
            handle,
            PROCESS_WOW64_INFORMATION,
            &mut ret as *mut usize as *mut _,
            std::mem::size_of::<usize>() as u32,
            &mut ret_len,
        );
        let _ = CloseHandle(handle);
        ret != 0
    }
}

/// Wait for all given processes to exit. Blocks the current thread.
pub fn wait_process_for_exit(pids: &[u32]) {
    let mut handles: Vec<HANDLE> = Vec::new();
    unsafe {
        for &pid in pids {
            if let Ok(handle) = OpenProcess(SYNCHRONIZE, false, pid) {
                handles.push(handle);
            }
        }
        if handles.is_empty() {
            return;
        }
        let _ = WaitForMultipleObjects(&handles, true, u32::MAX);
        for handle in handles {
            let _ = CloseHandle(handle);
        }
    }
}

/// Get the PID of the window at the given screen coordinates.
pub fn get_pid_from_point(x: i32, y: i32) -> u32 {
    unsafe {
        let point = POINT { x, y };
        let hwnd = WindowFromPoint(point);
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid
    }
}

/// Check whether every PID in the list has already exited.
///
/// Used by the cancellable game-exit watcher so its thread can be stopped
/// without relying on a blocking `WaitForMultipleObjects`.
///
/// 打不开进程 ≠ 已退出：受保护/提权进程（游戏以管理员运行）会
/// ACCESS_DENIED，若误判为已退出，watcher 会在 500ms 内发射 `game-exit`
/// 把正在运行的会话杀掉。只有确认 PID 不存在（ERROR_INVALID_PARAMETER）
/// 才视为已退出，其余失败一律视为"仍在运行"。
pub fn all_processes_exited(pids: &[u32]) -> bool {
    const STILL_ACTIVE: u32 = 259;
    const ERROR_INVALID_PARAMETER: i32 = 87;
    unsafe {
        for &pid in pids {
            match OpenProcess(PROCESS_QUERY_INFORMATION, false, pid) {
                Ok(handle) => {
                    let mut code: u32 = 0;
                    let _ = GetExitCodeProcess(handle, &mut code);
                    let _ = CloseHandle(handle);
                    if code == STILL_ACTIVE {
                        return false;
                    }
                }
                Err(err) => {
                    // windows crate 把 Win32 错误包成 0x8007xxxx 的 HRESULT，
                    // 低 16 位就是原始错误码。
                    if (err.code().0 & 0xFFFF) != ERROR_INVALID_PARAMETER {
                        return false;
                    }
                }
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wait_for_empty_pids_returns_immediately() {
        wait_process_for_exit(&[]);
    }

    #[test]
    fn invalid_pid_is_not_wow64() {
        assert!(!is_wow64(u32::MAX));
        assert!(!is_wow64(0));
    }

    #[test]
    fn wait_for_missing_pids_does_not_block_forever() {
        // PIDs that don't exist are skipped by OpenProcess, so this must
        // return without waiting.
        wait_process_for_exit(&[u32::MAX - 1, u32::MAX - 2]);
    }

    #[test]
    fn all_processes_exited_for_empty_or_missing_pids() {
        assert!(all_processes_exited(&[]));
        assert!(all_processes_exited(&[u32::MAX - 1, u32::MAX - 2]));
    }

    #[test]
    fn running_process_is_not_reported_as_exited() {
        // 回归：自身进程必然仍在运行；曾把"OpenProcess 失败"一律当成已
        // 退出，导致提权游戏开局即被判定 game-exit。
        assert!(!all_processes_exited(&[std::process::id()]));
    }

    #[test]
    fn exited_child_process_is_reported_as_exited() {
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "exit 0"])
            .spawn()
            .expect("spawn cmd");
        let pid = child.id();
        let status = child.wait().expect("wait cmd");
        assert!(status.success());
        // 句柄已随 wait 关闭：PID 不再存在 → INVALID_PARAMETER → 已退出。
        assert!(all_processes_exited(&[pid]));
    }

    #[test]
    fn mixed_running_and_dead_pids_not_all_exited() {
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "exit 0"])
            .spawn()
            .expect("spawn cmd");
        let dead = child.id();
        let _ = child.wait();
        assert!(!all_processes_exited(&[dead, std::process::id()]));
    }
}
