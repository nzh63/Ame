//! Screen capture — replaces `native/addons/ScreenCapturer`.

use windows::core::BOOL;
use windows::Win32::Foundation::{HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetWindowDC,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::UI::Input::KeyboardAndMouse::IsWindowEnabled;
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowThreadProcessId, IsWindowVisible, PW_RENDERFULLCONTENT,
};

/// Find the first visible, enabled window belonging to any of the given PIDs.
pub fn find_window(pids: &[u32]) -> u64 {
    struct Data {
        pids: Vec<u32>,
        result: HWND,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam.0 as *mut Data);
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if data.pids.contains(&pid)
            && IsWindowEnabled(hwnd).as_bool()
            && IsWindowVisible(hwnd).as_bool()
        {
            data.result = hwnd;
            return BOOL(0);
        }
        BOOL(1)
    }

    let mut data = Data {
        pids: pids.to_vec(),
        result: HWND::default(),
    };
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut data as *mut Data as isize));
    }
    data.result.0 as u64
}

/// Check that a window handle still belongs to one of the given PIDs.
///
/// After the game window is destroyed, Windows may reuse the handle value for
/// an unrelated window (desktop, browser, …); `capture()` would then silently
/// succeed on the wrong window and keep triggering OCR. Callers use this to
/// detect that the tracked window is gone.
pub fn window_belongs_to(hwnd_value: u64, pids: &[u32]) -> bool {
    if hwnd_value == 0 {
        return false;
    }
    let hwnd = HWND(hwnd_value as *mut _);
    let mut pid: u32 = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }
    pid != 0 && pids.contains(&pid)
}

/// Captured window image.
#[derive(Clone)]
pub struct CapturedImage {
    pub width: u32,
    pub height: u32,
    pub buffer: Vec<u8>,
}

/// Capture a window's content via PrintWindow + GetDIBits.
pub fn capture(hwnd_value: u64) -> Result<CapturedImage, String> {
    let hwnd = HWND(hwnd_value as *mut _);

    unsafe {
        let mut rect = RECT::default();
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rect as *mut RECT as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
        .map_err(|e| format!("DwmGetWindowAttribute failed: {e}"))?;

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return Err("Invalid window size".into());
        }

        let buffer_size = (width as usize) * (height as usize) * 4;
        let mut buffer = vec![0u8; buffer_size];

        let hwnd_dc = GetWindowDC(Some(hwnd));
        let save_dc = CreateCompatibleDC(Some(hwnd_dc));
        let save_bitmap = CreateCompatibleBitmap(hwnd_dc, width, height);
        let _old = SelectObject(save_dc, save_bitmap.into());
        // 必须带 PW_RENDERFULLCONTENT：D3D/DXGI 硬件加速窗口只有在该标志下
        // 才会把渲染内容画进 PrintWindow 的 DC，否则截出来是白屏。
        let _ = PrintWindow(hwnd, save_dc, PRINT_WINDOW_FLAGS(PW_RENDERFULLCONTENT));

        let bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            ..Default::default()
        };

        GetDIBits(
            hwnd_dc,
            save_bitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut _),
            &bi as *const BITMAPINFO as *mut _,
            DIB_RGB_COLORS,
        );

        let _ = DeleteObject(save_bitmap.into());
        let _ = DeleteDC(save_dc);
        let _ = ReleaseDC(Some(hwnd), hwnd_dc);

        Ok(CapturedImage {
            width: width as u32,
            height: height as u32,
            buffer,
        })
    }
}
