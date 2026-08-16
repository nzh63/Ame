//! Window operation commands — replaces `src/remote/windowOperation.ts`, `dialog.ts`, `icon.ts`.

use serde_json::Value;
use tauri::{AppHandle, Manager, Webview, WebviewWindow};

/// Resolve the webview window that issued the command.
fn caller_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("window '{label}' not found"))
}

/// Resize a window's content area.
#[tauri::command]
pub fn resize_window<R: tauri::Runtime>(
    app: AppHandle,
    webview: Webview<R>,
    arg: Value,
) -> Result<(), String> {
    crate::log_info!("rpc", "resize_window <- {arg}");
    let window = caller_window(&app, webview.label())?;
    // The frontend reports logical (CSS) pixel sizes, so read the inner size
    // in logical pixels and set a logical size. Mixing physical reads with
    // logical writes made the overlay grow on every resize under high DPI.
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    let logical = inner.to_logical::<f64>(scale);
    let width = arg["width"].as_f64().unwrap_or(logical.width);
    let height = arg["height"].as_f64().unwrap_or(logical.height);
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn minimize_window<R: tauri::Runtime>(
    app: AppHandle,
    webview: Webview<R>,
) -> Result<(), String> {
    crate::log_info!("rpc", "minimize_window <- {}", webview.label());
    caller_window(&app, webview.label())?
        .minimize()
        .map_err(|e| e.to_string())
}

/// Toggle maximize/unmaximize on the calling window.
///
/// Returns the new maximized state so the frontend can swap its
/// maximize/restore icon.
#[tauri::command]
pub fn toggle_maximize_window<R: tauri::Runtime>(
    app: AppHandle,
    webview: Webview<R>,
) -> Result<bool, String> {
    let window = caller_window(&app, webview.label())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    Ok(!maximized)
}

/// Close the calling window.
#[tauri::command]
pub fn close_window<R: tauri::Runtime>(app: AppHandle, webview: Webview<R>) -> Result<(), String> {
    crate::log_info!("rpc", "close_window <- {}", webview.label());
    caller_window(&app, webview.label())?
        .close()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_window<R: tauri::Runtime>(app: AppHandle, webview: Webview<R>) -> Result<(), String> {
    caller_window(&app, webview.label())?
        .hide()
        .map_err(|e| e.to_string())
}

/// Show the calling window once its content is ready (mirrors the old
/// Electron `ready-to-show` → `show()`). No-op in e2e mode so parallel tests
/// keep their windows hidden.
#[tauri::command]
pub fn show_window<R: tauri::Runtime>(app: AppHandle, webview: Webview<R>) -> Result<(), String> {
    crate::log_info!("rpc", "show_window <- {}", webview.label());
    #[cfg(debug_assertions)]
    if std::env::var("AME_E2E_CDP_PORT").is_ok() {
        return Ok(());
    }
    caller_window(&app, webview.label())?
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_window_always_on_top<R: tauri::Runtime>(
    app: AppHandle,
    webview: Webview<R>,
    flag: bool,
) -> Result<(), String> {
    caller_window(&app, webview.label())?
        .set_always_on_top(flag)
        .map_err(|e| e.to_string())
}

/// Open a native file-open dialog and return the first selected path.
/// Returns `null` if the dialog was canceled (matching the original Electron
/// behavior where `showOpenDialog` returns `filePaths[0]` or `undefined`).
#[tauri::command]
pub async fn show_open_dialog(app: AppHandle, options: Value) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app.dialog().file();
    if let Some(filters) = options["filters"].as_array() {
        for f in filters {
            let name = f["name"].as_str().unwrap_or("files");
            if let Some(exts) = f["extensions"].as_array() {
                let exts: Vec<&str> = exts.iter().filter_map(|e| e.as_str()).collect();
                builder = builder.add_filter(name, &exts);
            }
        }
    }
    builder.pick_files(move |paths| {
        let _ = tx.send(paths);
    });
    let paths = rx.await.map_err(|e| e.to_string())?;
    // Return the first path, or null if canceled/empty.
    let first = paths
        .unwrap_or_default()
        .first()
        .map(|p| serde_json::json!(p.to_string()))
        .unwrap_or(Value::Null);
    Ok(first)
}

/// Read a file's icon and return it as a base64 data URL.
#[tauri::command]
pub fn read_icon(path: String) -> Result<String, String> {
    read_icon_impl(&path)
}

#[cfg(windows)]
fn read_icon_impl(path: &str) -> Result<String, String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, SelectObject, BITMAP,
        BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_FLAGS, SHGFI_ICON};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = std::ffi::OsStr::new(path)
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        let mut shfi = SHFILEINFOW::default();
        // SHGFI_LARGEICON = 0, so the flag set is just SHGFI_ICON.
        let result = SHGetFileInfoW(
            windows::core::PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut shfi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_FLAGS(SHGFI_ICON.0),
        );
        // SHFILEINFOW 是 packed 结构：i686 布局下 hIcon 字段不对齐，直接
        // 对字段调用方法（隐式取引用）是未定义行为（x64 布局碰巧合法）。
        // 先按值拷出再使用。
        let icon = { shfi.hIcon };
        if result == 0 || icon.is_invalid() {
            // No icon available; the frontend falls back to a default icon.
            return Ok(String::new());
        }

        let mut info = ICONINFO::default();
        if GetIconInfo(icon, &mut info).is_err() {
            let _ = DestroyIcon(icon);
            return Ok(String::new());
        }

        // Prefer the 32-bit color bitmap; fall back to the mask bitmap.
        let hbm = if !info.hbmColor.is_invalid() {
            info.hbmColor
        } else {
            info.hbmMask
        };

        let mut result = String::new();
        if !hbm.is_invalid() {
            let mut bmp = BITMAP::default();
            if GetObjectW(
                hbm.into(),
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut bmp as *mut _ as *mut _),
            ) > 0
                && bmp.bmWidth > 0
                && bmp.bmHeight > 0
            {
                let width = bmp.bmWidth as u32;
                let height = bmp.bmHeight as u32;
                let dc = CreateCompatibleDC(None);
                if !dc.is_invalid() {
                    let _old = SelectObject(dc, hbm.into());
                    let mut bmi = BITMAPINFO {
                        bmiHeader: BITMAPINFOHEADER {
                            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                            biWidth: width as i32,
                            biHeight: -(height as i32), // top-down
                            biPlanes: 1,
                            biBitCount: 32,
                            biCompression: BI_RGB.0,
                            ..Default::default()
                        },
                        bmiColors: [Default::default()],
                    };
                    let mut buf = vec![0u8; (width as usize) * (height as usize) * 4];
                    let got = GetDIBits(
                        dc,
                        hbm,
                        0,
                        height,
                        Some(buf.as_mut_ptr() as *mut _),
                        &mut bmi,
                        DIB_RGB_COLORS,
                    );
                    if got > 0 {
                        // GDI gives BGRA; convert to RGBA for PNG encoding.
                        for px in buf.chunks_exact_mut(4) {
                            px.swap(0, 2);
                        }
                        if let Some(img) = image::RgbaImage::from_raw(width, height, buf) {
                            let mut png = Vec::new();
                            if img
                                .write_to(
                                    &mut std::io::Cursor::new(&mut png),
                                    image::ImageFormat::Png,
                                )
                                .is_ok()
                            {
                                use base64::Engine;
                                result = format!(
                                    "data:image/png;base64,{}",
                                    base64::engine::general_purpose::STANDARD.encode(png)
                                );
                            }
                        }
                    }
                    let _ = DeleteDC(dc);
                }
            }
        }

        let _ = DeleteObject(info.hbmColor.into());
        let _ = DeleteObject(info.hbmMask.into());
        let _ = DestroyIcon(icon);
        Ok(result)
    }
}

#[cfg(not(windows))]
fn read_icon_impl(_path: &str) -> Result<String, String> {
    Ok(String::new())
}
