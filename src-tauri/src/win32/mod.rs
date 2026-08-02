//! Win32 native functionality, replacing the C++ N-API addons.

pub mod process;
pub mod screen_capturer;
pub mod window_event_hook;
pub mod windows_hook;

/// Hide the console window of a subprocess.
///
/// On Windows this sets `CREATE_NO_WINDOW` (0x08000000) on the child process
/// creation flags. Without it, console-subsystem helpers (PowerShell,
/// TextractorCLI, JBeijingCli, DrEyeCli, mecab) pop up a black console window
/// whenever they are spawned from this GUI-subsystem app.
pub fn hide_console(cmd: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    let _ = cmd;
}

/// Detect Windows tablet/convertible mode (Electron `BrowserWindow.isTabletMode()`:
/// `SM_CONVERTIBLESLATEMODE == 0`).
///
/// Desktop PCs and laptops without a touch digitizer are never in tablet mode,
/// so gate on `SM_MAXIMUMTOUCHES` first — some desktop systems report
/// `SM_CONVERTIBLESLATEMODE == 0` (slate mode) spuriously even though they
/// have no touchscreen.
pub fn is_tablet_mode() -> bool {
    #[cfg(target_os = "windows")]
    unsafe {
        const SM_CONVERTIBLESLATEMODE: i32 = 0x2003;
        const SM_MAXIMUMTOUCHES: i32 = 0x0095;
        use windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics;
        let metric = |idx: i32| {
            GetSystemMetrics(windows::Win32::UI::WindowsAndMessaging::SYSTEM_METRICS_INDEX(idx))
        };
        // 无触控屏的设备不可能是平板模式（平板模式依赖触摸屏）。
        if metric(SM_MAXIMUMTOUCHES) == 0 {
            return false;
        }
        metric(SM_CONVERTIBLESLATEMODE) == 0
    }
    #[cfg(not(target_os = "windows"))]
    false
}
