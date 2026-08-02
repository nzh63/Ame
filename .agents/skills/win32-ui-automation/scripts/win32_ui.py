"""Reusable Win32 desktop UI automation primitives (no external deps except PIL for save).

Core capabilities:
  - DPI-aware window discovery (find_window / list_windows)
  - PrintWindow screenshot that forces WebView2/D3D redraw (screenshot_window)
  - Real OS-level mouse via SendInput: click_screen, scroll_at (works on WebView2)
  - PP-OCR text recognition with coordinates (ocr)

Why these choices (learned the hard way):
  - BitBlt + GetWindowDC returns a STALE cached frame for WebView2 (hardware D3D).
    Use PrintWindow with PW_RENDERFULLCONTENT (0x2) to force a real redraw.
  - PostMessage(WM_LBUTTONDOWN) is IGNORED by WebView2 content. Only SendInput
    (real injected input) reliably clicks inside a Tauri/WebView2 window.
  - Windows DPI scaling (e.g. 150%) makes GetWindowRect report logical pixels for
    non-DPI-aware processes, while SendInput uses physical pixels -> mismatch.
    Call SetProcessDpiAwareness(2) FIRST so all coords are physical pixels.
  - GetWindowDC screenshot INCLUDES the title bar + window borders. So a text item
    at screenshot pixel (x, y) maps to screen (window_left + x, window_top + y),
    NOT to client coords. Don't subtract the title bar when using screen-space clicks.
"""
import ctypes
import ctypes.wintypes as wt
import os
import struct
import subprocess
import time

# --- DPI awareness MUST be set before any coordinate work -------------------
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# --- Constants ---------------------------------------------------------------
SW_RESTORE = 9
PW_RENDERFULLCONTENT = 0x2

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_ABSOLUTE = 0x8000
WHEEL_DELTA = 120
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_KEYUP = 0x0002

# Virtual-key codes for press_key()
_VK = {
    "ENTER": 0x0D,
    "RETURN": 0x0D,
    "ESC": 0x1B,
    "ESCAPE": 0x1B,
    "TAB": 0x09,
    "BACKSPACE": 0x08,
    "DELETE": 0x2E,
    "HOME": 0x24,
    "END": 0x23,
    "UP": 0x26,
    "DOWN": 0x28,
    "LEFT": 0x25,
    "RIGHT": 0x27,
}


# --- SendInput structures ----------------------------------------------------
class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", ctypes.c_long),
        ("dy", ctypes.c_long),
        ("mouseData", ctypes.c_ulong),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", ctypes.c_ushort),
        ("wScan", ctypes.c_ushort),
        ("dwFlags", ctypes.c_ulong),
        ("time", ctypes.c_ulong),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class _INPUT(ctypes.Structure):
    class _U(ctypes.Union):
        _fields_ = [("mi", _MOUSEINPUT), ("ki", _KEYBDINPUT), ("pad", ctypes.c_ubyte * 24)]

    _fields_ = [("type", ctypes.c_ulong), ("u", _U)]


# --- Window discovery --------------------------------------------------------
def find_window(title_substring):
    """Return list of (hwnd, title) for visible windows whose title contains the substring."""
    result = []

    @ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
    def _cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            n = user32.GetWindowTextLengthW(hwnd)
            if n > 0:
                buf = ctypes.create_unicode_buffer(n + 1)
                user32.GetWindowTextW(hwnd, buf, n + 1)
                if title_substring.lower() in buf.value.lower():
                    result.append((hwnd, buf.value))
        return True

    user32.EnumWindows(_cb, 0)
    return result


def list_windows(substring=""):
    """Print and return visible windows, optionally filtered by title substring."""
    wins = find_window(substring) if substring else []
    if not substring:
        wins = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)
        def _cb(hwnd, _):
            if user32.IsWindowVisible(hwnd):
                n = user32.GetWindowTextLengthW(hwnd)
                if n > 0:
                    buf = ctypes.create_unicode_buffer(n + 1)
                    user32.GetWindowTextW(hwnd, buf, n + 1)
                    wins.append((hwnd, buf.value))
            return True

        user32.EnumWindows(_cb, 0)

    for hwnd, title in wins:
        l, t, r, b = get_window_rect(hwnd)
        print(f"  hwnd={hwnd} title='{title}' rect=({l},{t},{r},{b}) size={r-l}x{b-t}")
    return wins


def get_window_rect(hwnd):
    """Return (left, top, right, bottom) in physical screen pixels."""
    rect = wt.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    return rect.left, rect.top, rect.right, rect.bottom


def focus_window(hwnd):
    """Restore and bring a window to the foreground."""
    user32.ShowWindow(hwnd, SW_RESTORE)
    time.sleep(0.2)
    user32.SetForegroundWindow(hwnd)
    time.sleep(0.3)


# --- Screenshot (PrintWindow, forces WebView2 redraw) ------------------------
def screenshot_window(hwnd, out_path):
    """Capture the full window (incl. title bar) to a PNG via PrintWindow.

    The output image coordinate space == window rect pixel space, so a pixel at
    image (x, y) corresponds to screen (window_left + x, window_top + y).
    """
    l, t, r, b = get_window_rect(hwnd)
    w, h = r - l, b - t

    screen_dc = user32.GetDC(None)
    mem_dc = gdi32.CreateCompatibleDC(screen_dc)
    bmp = gdi32.CreateCompatibleBitmap(screen_dc, w, h)
    gdi32.SelectObject(mem_dc, bmp)
    user32.ReleaseDC(None, screen_dc)

    user32.PrintWindow(hwnd, mem_dc, PW_RENDERFULLCONTENT)

    class _BMIH(ctypes.Structure):
        _fields_ = [
            ("biSize", ctypes.c_uint), ("biWidth", ctypes.c_long),
            ("biHeight", ctypes.c_long), ("biPlanes", ctypes.c_ushort),
            ("biBitCount", ctypes.c_ushort), ("biCompression", ctypes.c_uint),
            ("biSizeImage", ctypes.c_uint), ("biXPelsPerMeter", ctypes.c_long),
            ("biYPelsPerMeter", ctypes.c_long), ("biClrUsed", ctypes.c_uint),
            ("biClrImportant", ctypes.c_uint),
        ]

    buf_size = w * h * 4
    buf = ctypes.create_string_buffer(buf_size)
    gdi32.GetDIBits(mem_dc, bmp, 0, h, buf,
                    ctypes.byref(_BMIH(40, w, -h, 1, 32, 0, buf_size, 0, 0, 0, 0)), 0)

    bmp_path = out_path if out_path.endswith(".bmp") else out_path + ".bmp"
    with open(bmp_path, "wb") as f:
        f.write(b"BM")
        f.write(struct.pack("<I", 54 + buf_size))
        f.write(struct.pack("<HH", 0, 0))
        f.write(struct.pack("<I", 54))
        f.write(struct.pack("<IiiHHIIiiII", 40, w, -h, 1, 32, 0, buf_size, 0, 0, 0, 0))
        f.write(buf.raw)

    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mem_dc)

    if out_path.endswith(".png"):
        from PIL import Image
        Image.open(bmp_path).save(out_path)
        os.remove(bmp_path)
    return out_path


# --- Mouse input (SendInput, real OS-level) ----------------------------------
def _to_abs(sx, sy):
    cx = user32.GetSystemMetrics(0)
    cy = user32.GetSystemMetrics(1)
    return int(sx * 65535 / cx), int(sy * 65535 / cy)


def click_screen(sx, sy):
    """Send a real left click at absolute screen coordinates (works on WebView2)."""
    ax, ay = _to_abs(sx, sy)

    down = _INPUT(); down.type = INPUT_MOUSE
    down.u.mi.dx = ax; down.u.mi.dy = ay
    down.u.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_LEFTDOWN

    up = _INPUT(); up.type = INPUT_MOUSE
    up.u.mi.dx = ax; up.u.mi.dy = ay
    up.u.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_LEFTUP

    arr = (_INPUT * 2)(down, up)
    user32.SendInput(2, ctypes.byref(arr), ctypes.sizeof(_INPUT))


def scroll_at(sx, sy, clicks):
    """Scroll the mouse wheel at screen coords. Negative clicks = scroll down."""
    ax, ay = _to_abs(sx, sy)
    inp = _INPUT(); inp.type = INPUT_MOUSE
    inp.u.mi.dx = ax; inp.u.mi.dy = ay
    inp.u.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_WHEEL
    inp.u.mi.mouseData = ctypes.c_ulong(clicks * WHEEL_DELTA).value
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(_INPUT))


def click_window_client(hwnd, client_x, client_y):
    """Focus the window and click at client-area coordinates."""
    focus_window(hwnd)
    point = wt.POINT(client_x, client_y)
    user32.ClientToScreen(hwnd, ctypes.byref(point))
    click_screen(point.x, point.y)


def type_text(hwnd, text):
    """Type literal text via SendInput KEYEVENTF_UNICODE (works on WebView2).

    Focuses the window first; the target control must already be focused (click
    it first). Handles CJK and any Unicode input. Does not send Enter.
    """
    focus_window(hwnd)
    time.sleep(0.3)
    for ch in text:
        down = _INPUT()
        down.type = INPUT_KEYBOARD
        down.u.ki.wScan = ord(ch)
        down.u.ki.dwFlags = KEYEVENTF_UNICODE
        up = _INPUT()
        up.type = INPUT_KEYBOARD
        up.u.ki.wScan = ord(ch)
        up.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP
        arr = (_INPUT * 2)(down, up)
        user32.SendInput(2, ctypes.byref(arr), ctypes.sizeof(_INPUT))
        time.sleep(0.01)


def press_key(hwnd, name):
    """Press a named key or chord, e.g. "ENTER", "BACKSPACE", "CTRL+A".

    Modifiers: CTRL, SHIFT, ALT (e.g. "CTRL+A", "CTRL+SHIFT+Z").
    """
    parts = str(name).upper().split("+")
    key = parts[-1]
    vk = _VK.get(key)
    if vk is None:
        # Single printable character (e.g. "A", "1") maps to its VK code.
        if len(key) == 1:
            vk = ord(key)
        else:
            raise ValueError(f"unknown key name: {name}")
    mod_map = {"CTRL": 0x11, "CONTROL": 0x11, "SHIFT": 0x10, "ALT": 0x12}
    mods = [mod_map[m] for m in parts[:-1] if m in mod_map]
    focus_window(hwnd)
    events = []
    for m in mods:
        d = _INPUT(); d.type = INPUT_KEYBOARD; d.u.ki.wVk = m
        events.append(d)
    d = _INPUT(); d.type = INPUT_KEYBOARD; d.u.ki.wVk = vk
    events.append(d)
    u = _INPUT(); u.type = INPUT_KEYBOARD; u.u.ki.wVk = vk; u.u.ki.dwFlags = KEYEVENTF_KEYUP
    events.append(u)
    for m in reversed(mods):
        u = _INPUT(); u.type = INPUT_KEYBOARD; u.u.ki.wVk = m; u.u.ki.dwFlags = KEYEVENTF_KEYUP
        events.append(u)
    arr = (_INPUT * len(events))(*events)
    user32.SendInput(len(events), ctypes.byref(arr), ctypes.sizeof(_INPUT))


# --- PP-OCR text recognition (via the app's ppocr_ffi.dll, C ABI) -----------
# After the JS->Rust migration, the old `native/addons` pp-ocr-example.exe is
# gone. The OCR backend now ships as ppocr_ffi.dll (built by `cargo build` and
# copied to build/static/native/bin), with the ncnn models under
# build/static/ppocr. Defaults are for this workspace; override via args if
# reused elsewhere.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DEFAULT_OCR_DLL = os.path.join(_REPO_ROOT, "build", "static", "native", "bin", "ppocr_ffi.dll")
DEFAULT_OCR_MODEL_DIR = os.path.join(_REPO_ROOT, "build", "static", "ppocr")
SERVER_DET = "PP-OCRv5_server_det.fp32.ncnn"
SERVER_REC = "PP-OCRv5_server_rec.fp32.ncnn"


class _PpOcrBox(ctypes.Structure):
    _fields_ = [
        ("center_x", ctypes.c_float),
        ("center_y", ctypes.c_float),
        ("width", ctypes.c_float),
        ("height", ctypes.c_float),
        ("angle", ctypes.c_float),
    ]


class PpOcr:
    """PP-OCR via the app's ppocr_ffi.dll (ncnn, CPU by default).

    Loads the detector/recognizer on construction; first OCR call is slow
    (model init + inference) but subsequent calls reuse the handles.
    """

    def __init__(self, dll_path=None, model_dir=None, det=None, rec=None, gpu=-1):
        self.dll_path = os.path.abspath(dll_path or DEFAULT_OCR_DLL)
        self.model_dir = os.path.abspath(model_dir or DEFAULT_OCR_MODEL_DIR)
        if not os.path.exists(self.dll_path):
            raise FileNotFoundError(
                f"ppocr_ffi.dll not found: {self.dll_path}\n"
                "Run `yarn build` (or `cargo build --manifest-path src-tauri/Cargo.toml`) first."
            )
        for name in (det or SERVER_DET, rec or SERVER_REC):
            for ext in (".param", ".bin"):
                p = os.path.join(self.model_dir, name + ext)
                if not os.path.exists(p):
                    raise FileNotFoundError(f"OCR model missing: {p}")

        if os.name == "nt":
            os.add_dll_directory(os.path.dirname(self.dll_path))
        self._lib = ctypes.CDLL(self.dll_path)
        self._setup_prototypes()

        self._det = self._lib.ppocr_detector_create(
            (os.path.join(self.model_dir, (det or SERVER_DET) + ".param")).encode(),
            (os.path.join(self.model_dir, (det or SERVER_DET) + ".bin")).encode(),
            gpu,
        )
        self._rec = self._lib.ppocr_recognizer_create(
            (os.path.join(self.model_dir, (rec or SERVER_REC) + ".param")).encode(),
            (os.path.join(self.model_dir, (rec or SERVER_REC) + ".bin")).encode(),
            gpu,
        )
        if not self._det or not self._rec:
            raise RuntimeError("ppocr_ffi: failed to create detector/recognizer")

    def _setup_prototypes(self):
        lib = self._lib
        lib.ppocr_detector_create.restype = ctypes.c_void_p
        lib.ppocr_detector_create.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
        lib.ppocr_recognizer_create.restype = ctypes.c_void_p
        lib.ppocr_recognizer_create.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
        lib.ppocr_detector_detect.restype = ctypes.c_int32
        lib.ppocr_detector_detect.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(ctypes.c_void_p),
        ]
        lib.ppocr_free_boxes.argtypes = [ctypes.c_void_p]
        lib.ppocr_recognizer_recognize.restype = ctypes.c_int32
        lib.ppocr_recognizer_recognize.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_int32,
            ctypes.c_int32,
            ctypes.POINTER(_PpOcrBox),
            ctypes.c_int32,
            ctypes.POINTER(ctypes.c_void_p),
        ]
        lib.ppocr_free_texts.argtypes = [ctypes.POINTER(ctypes.c_char_p), ctypes.c_int32]
        lib.ppocr_detector_destroy.argtypes = [ctypes.c_void_p]
        lib.ppocr_recognizer_destroy.argtypes = [ctypes.c_void_p]

    def _image_to_bgra(self, image_path):
        from PIL import Image

        im = Image.open(image_path).convert("RGBA")
        b, g, r, a = im.split()
        # Merge in B,G,R,A order so the in-memory layout is BGRA.
        return Image.merge("RGBA", (b, g, r, a)).tobytes(), im.size

    def recognize(self, image_path):
        """OCR an image file; return list of (x, y, text) pixel centers."""
        data, (w, h) = self._image_to_bgra(image_path)
        data_buf = ctypes.create_string_buffer(data, len(data))

        boxes_out = ctypes.c_void_p()
        n_boxes = self._lib.ppocr_detector_detect(
            self._det, data_buf, w, h, ctypes.byref(boxes_out)
        )
        if n_boxes <= 0:
            return []
        try:
            boxes = ctypes.cast(boxes_out, ctypes.POINTER(_PpOcrBox))
            texts_out = ctypes.c_void_p()
            n_texts = self._lib.ppocr_recognizer_recognize(
                self._rec, data_buf, w, h, boxes, n_boxes, ctypes.byref(texts_out)
            )
            if n_texts <= 0:
                return []
            char_arr = ctypes.cast(texts_out, ctypes.POINTER(ctypes.c_char_p))
            texts = [char_arr[i].decode("utf-8", "replace") for i in range(n_texts)]
            self._lib.ppocr_free_texts(char_arr, n_texts)
            return [
                (int(boxes[i].center_x), int(boxes[i].center_y), texts[i])
                for i in range(min(n_boxes, n_texts))
            ]
        finally:
            self._lib.ppocr_free_boxes(ctypes.cast(boxes_out, ctypes.c_void_p))

    def close(self):
        self._lib.ppocr_detector_destroy(self._det)
        self._lib.ppocr_recognizer_destroy(self._rec)


# Lazily-initialized shared instance; first `ocr()` call pays model init.
_PPOCR = None


def ocr(image_path, dll_path=None, model_dir=None):
    """Run PP-OCR on an image. Returns list of (x, y, text) with pixel centers."""
    global _PPOCR
    if _PPOCR is None:
        _PPOCR = PpOcr(dll_path=dll_path, model_dir=model_dir)
    return _PPOCR.recognize(image_path)


# --- High-level helpers ------------------------------------------------------
def click_text(hwnd, target_text, shot_path=None, scroll=True, dll_path=None, model_dir=None):
    """Screenshot + OCR + click the first item containing target_text.

    Scrolls the window down up to 3 times if not found and scroll=True.
    Returns True on success.
    """
    shot_path = shot_path or os.path.join(os.environ.get("TEMP", "."), "win32ui_shot.png")
    l, t, _, _ = get_window_rect(hwnd)
    items = []
    for attempt in range(3 if scroll else 1):
        screenshot_window(hwnd, shot_path)
        items = ocr(shot_path, dll_path, model_dir)
        for x, y, text in items:
            if target_text in text:
                click_screen(l + x, t + y)
                time.sleep(0.8)
                return True
        if scroll and attempt < 2:
            scroll_at(l + 150, t + 500, -3)
            time.sleep(0.5)
    print(f"  click_text: '{target_text}' not found. Available: {[x[2] for x in items]}")
    return False


def read_page(hwnd, shot_path=None, dll_path=None, model_dir=None):
    """Screenshot + OCR the window; return (items, joined_text)."""
    shot_path = shot_path or os.path.join(os.environ.get("TEMP", "."), "win32ui_shot.png")
    screenshot_window(hwnd, shot_path)
    items = ocr(shot_path, dll_path, model_dir)
    return items, " ".join(t for _, _, t in items)
