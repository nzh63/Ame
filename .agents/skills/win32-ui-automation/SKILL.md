---
name: win32-ui-automation
description: "Use when automating or testing a Windows desktop GUI (especially Tauri / WebView2 / Electron apps) by simulating clicks, capturing screenshots, and reading on-screen text via OCR. Provides DPI-aware window discovery, PrintWindow screenshots that work on hardware-accelerated webviews, real OS-level mouse input via SendInput, and PP-OCR text recognition with pixel coordinates. Use for: clicking buttons/menus that accessibility trees can't reach, verifying rendered UI content, automated page-by-page UI testing."
---

# Win32 UI Automation

Automate and test Windows desktop GUIs — including Tauri / WebView2 / Electron
windows whose web content is invisible to accessibility trees and ignores
synthetic window messages. All primitives live in [`scripts/win32_ui.py`](./scripts/win32_ui.py)
and depend only on the Python standard library (+ `PIL` for PNG saving).

## When to use this

- The app renders web content (WebView2/D3D) so `PostMessage` clicks and
  accessibility-tree element indexes do **not** work.
- You need to **read what is actually rendered** (not the DOM) to verify a page.
- You need to click a menu/button located by its on-screen text.

## Setup (one time)

1. **Python deps** — only Pillow is needed (PNG output + image loading):
   ```powershell
   pip install pillow
   ```
2. **Build the app once** so the OCR backend + models are in place:
   ```powershell
   yarn build        # or: cargo build --manifest-path src-tauri/Cargo.toml
   ```
   - OCR DLL: `build/static/native/bin/ppocr_ffi.dll` (copied there by `build.rs`)
   - Models: `build/static/ppocr/` (`PP-OCRv5_server_det/rec.fp32.ncnn.{param,bin}`)

   `ocr()` loads `ppocr_ffi.dll` in-process via ctypes (no external process).
   The first call pays model initialization (~seconds); later calls reuse the
   loaded handles. If `build/` is missing, run `yarn build` and re-check paths.

## Core workflow

```python
import sys
sys.path.insert(0, ".agents/skills/win32-ui-automation/scripts")
import win32_ui as ui

# 1. Find + focus the window
hwnd = ui.find_window("Ame - Visual Novel Translator")[0][0]
ui.focus_window(hwnd)

# 2. Click a menu item by its visible text (screenshots + OCR + click)
ui.click_text(hwnd, "区域转换器设置")

# 3. Read what the page now shows
items, text = ui.read_page(hwnd)
print(text)
assert "LEProc" in text   # verify expected content rendered
```

## Available primitives

| Function | Purpose |
|----------|---------|
| `find_window(sub)` / `list_windows(sub)` | DPI-aware window discovery by title substring |
| `get_window_rect(hwnd)` | Physical-pixel `(left, top, right, bottom)` |
| `focus_window(hwnd)` | Restore + bring to foreground |
| `screenshot_window(hwnd, out.png)` | **PrintWindow** capture (forces webview redraw) |
| `click_screen(sx, sy)` | Real OS left-click at screen coords (**SendInput**) |
| `scroll_at(sx, sy, clicks)` | Mouse wheel; negative = down |
| `click_window_client(hwnd, x, y)` | Click at client-area coords |
| `type_text(hwnd, text)` | Type literal Unicode text (CJK ok) via SendInput; target must be focused first |
| `press_key(hwnd, name)` | Press named key: ENTER/ESC/TAB/BACKSPACE/DELETE/HOME/END/arrows |
| `ocr(image, dll_path?, model_dir?)` | PP-OCR via `ppocr_ffi.dll` → list of `(x, y, text)` pixel centers |
| `click_text(hwnd, text)` | High-level: screenshot+OCR+click (auto-scrolls) |
| `read_page(hwnd)` | High-level: screenshot+OCR → `(items, joined_text)` |

## Critical gotchas (learned the hard way)

1. **Use `PrintWindow`, not `BitBlt`.** `BitBlt` + `GetWindowDC` returns a
   **stale cached frame** for hardware-accelerated WebView2 content. Always use
   `PrintWindow(hwnd, dc, PW_RENDERFULLCONTENT=0x2)` to force a real redraw.

2. **Use `SendInput`, not `PostMessage`.** WebView2 **ignores**
   `WM_LBUTTONDOWN/UP` posted via `PostMessage`. Only real injected input
   (`SendInput`) clicks inside the webview.

3. **Set DPI awareness first.** With Windows scaling (e.g. 150%), a
   non-DPI-aware process gets *logical* pixels from `GetWindowRect` while
   `SendInput` uses *physical* pixels → clicks land in the wrong place. The
   module calls `SetProcessDpiAwareness(2)` on import so everything is physical.

4. **Screenshot space includes the title bar.** `screenshot_window` captures the
   whole window rect (title bar + borders). So an OCR hit at image pixel `(x, y)`
   maps to **screen** `(window_left + x, window_top + y)`. Do **not** subtract
   the title bar when clicking in screen space. `click_text` handles this.

5. **OCR can double letters** (e.g. "LocaleEmulator" → "LocaaleeEmullatorr").
   When asserting page content, match on stable fragments (`"LEProc"`, `"PID"`)
   rather than full words.
6. **OCR backend is the app's own `ppocr_ffi.dll`** (`build/static/native/bin`),
   not the pre-migration `pp-ocr-example.exe` (removed with `native/addons`).
   The DLL must sit next to its MSVC runtime; if it fails to load, rebuild with
   `yarn build` and verify `build/static/native/bin/ppocr_ffi.dll` exists.
7. **`type_text` may not update framework models in `type="number"` inputs.**
   In WebView2, SendInput `KEYEVENTF_UNICODE` typing visibly fills a number
   input (TDesign/Vue) but the `v-model` can stay unchanged — the click handler
   then reads the old value. Text inputs are fine; for number inputs use CDP
   `fill()`/`keyboard.type()` (real key events) or set the value in the DOM
   directly.
8. **Prefer CDP when the WebView2 is reachable.** Tauri apps can be launched
   with `--remote-debugging-port` (env `AME_E2E_CDP_PORT`) so all webview pages
   appear as Playwright targets; DOM driving is far more reliable than
   OCR-coordinate clicks for forms. Win32 primitives remain the fallback for
   native windows, transparency, and real input simulation.

## CLI usage

A thin CLI wrapper is provided for ad-hoc use:

```powershell
$S = .agents/skills/win32-ui-automation/scripts/win32_ui_cli.py
python $S list ame                                   # list matching windows
python $S shot "Ame - Visual Novel Translator" out.png
python $S ocr out.png                                # print "x y text" lines
python $S click "Ame - Visual Novel Translator" 600 350   # screen coords
python $S clicktext "Ame - Visual Novel Translator" "区域转换器设置"
```


