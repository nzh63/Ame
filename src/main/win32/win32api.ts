import ffi from 'ffi-napi';
import ref from 'ref-napi';
import { DModel as M, DTypes as W } from 'win32-def';

interface ForeignFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    async: (...args: [...Parameters<T>, (err: any, value: ReturnType<T>) => void]) => void;
}

export const nt: {
    NtQueryInformationProcess: ForeignFunction<(
        ProcessHandle: M.HANDLE,
        ProcessInformationClass: M.DWORD32,
        ProcessInformation: M.PVOID,
        ProcessInformationLength: M.ULONG,
        ReturnLength: M.PULONG | null
    ) => M.NTSTATUS>;
} = ffi.Library('ntdll', {
    NtQueryInformationProcess: [W.NTSTATUS, [W.HANDLE, W.DWORD32, W.PVOID, W.ULONG, W.PULONG]]
});

export const knl32: {
    OpenProcess: ForeignFunction<(dwDesiredAccess: M.DWORD, bInheritHandle: M.BOOL, dwProcessId: M.DWORD) => M.HANDLE>;
    WaitForSingleObject: ForeignFunction<(hHandle: M.HANDLE, dwMilliseconds: M.DWORD) => M.DWORD>;
} = ffi.Library('kernel32', {
    OpenProcess: [W.HANDLE, [W.DWORD, W.BOOL, W.DWORD]],
    WaitForSingleObject: [W.DWORD, [W.HANDLE, W.DWORD]]
});

const _user32: {
    SetWinEventHook: ForeignFunction<(
        eventMin: M.DWORD,
        eventMax: M.DWORD,
        hmodWinEventProc: M.HMODULE,
        pfnWinEventProc: ReturnType<ffi.Callback>,
        idProcess: M.DWORD,
        idThread: M.DWORD,
        dwFlags: M.DWORD,
    ) => M.HANDLE>;
    GetWindowRect: ForeignFunction<(hWnd: M.HANDLE, lpRect: M.RECT) => M.BOOL>;
    UnhookWinEvent: ForeignFunction<(hWinEventHook: M.HANDLE) => M.BOOL>;
    GetWindowThreadProcessId: ForeignFunction<(hWnd: M.HWND, lpdwProcessId: M.LPDWORD) => M.DWORD>;
    EnumWindows: ForeignFunction<(lpEnumFunc: ReturnType<ffi.Callback>, lParam: M.LPARAM) => M.BOOL>;
    EnumChildWindows: ForeignFunction<(hWndParent: M.HWND, lpEnumFunc: ReturnType<ffi.Callback>, lParam: M.LPARAM) => M.BOOL>;
    GetWindowDC: ForeignFunction<(hWnd: M.HWND) => M.HDC>;
    GetDC: ForeignFunction<(hWnd: M.HWND) => M.HDC>;
    ReleaseDC: ForeignFunction<(hWnd: M.HWND, hdc: M.HDC) => M.INT>,
    WindowFromPoint: ForeignFunction<(p: M.UINT64) => M.BOOL>;
    IsWindowVisible: ForeignFunction<(hWnd: M.HWND) => M.BOOL>;
    IsWindowEnabled: ForeignFunction<(hWnd: M.HWND) => M.BOOL>;
    PrintWindow: ForeignFunction<(hWnd: M.HWND, hdcBlt: M.HDC, nFlags: M.UINT) => M.BOOL>;
    SetWindowsHookExA: ForeignFunction<(idHook: M.INT, lpfn: ReturnType<ffi.Callback>, hmod: M.HINSTANCE, dwThreadId: M.DWORD) => M.HHOOK>;
    CallNextHookEx: ForeignFunction<(hhk: M.HHOOK, nCode: M.INT, wParam: M.WPARAM, lParam: Buffer) => M.LRESULT>;
    UnhookWindowsHookEx: ForeignFunction<(hhk: M.HHOOK) => M.BOOL>;
} = ffi.Library('user32', {
    SetWinEventHook: [W.HWINEVENTHOOK, [W.DWORD, W.DWORD, W.HMODULE, W.WINEVENTPROC, W.DWORD, W.DWORD, W.DWORD]],
    GetWindowRect: [W.BOOL, [W.HWND, W.RECT]],
    UnhookWinEvent: [W.BOOL, [W.HWINEVENTHOOK]],
    GetWindowThreadProcessId: [W.DWORD, [W.HWND, W.LPDWORD]],
    EnumWindows: [W.BOOL, [W.WNDENUMPROC, W.LPARAM]],
    EnumChildWindows: [W.BOOL, [W.HWND, W.WNDENUMPROC, W.LPARAM]],
    GetWindowDC: [W.HDC, [W.HWND]],
    GetDC: [W.HDC, [W.HWND]],
    ReleaseDC: [W.HDC, [W.HWND, W.HDC]],
    WindowFromPoint: [W.HWND, [W.UINT64]],
    IsWindowVisible: [W.BOOL, [W.HWND]],
    IsWindowEnabled: [W.BOOL, [W.HWND]],
    PrintWindow: [W.BOOL, [W.HWND, W.HDC, W.UINT]],
    SetWindowsHookExA: [W.HHOOK, [W.INT, 'pointer', W.HINSTANCE, W.DWORD]],
    CallNextHookEx: [W.LRESULT, [W.HHOOK, W.INT, W.WPARAM, 'pointer']],
    UnhookWindowsHookEx: [W.BOOL, [W.HHOOK]]
});

type ReturnTypeWithCallbackEntry<T> = {
    nativeReturnValue: T;
    callbackEntry?: Buffer; // avoid GC
};

export const user32 = {
    ..._user32,
    SetWinEventHook(
        eventMin: M.DWORD,
        eventMax: M.DWORD,
        hmodWinEventProc: M.HMODULE,
        pfnWinEventProc: (
            hWinEventHook: M.HANDLE,
            event: M.DWORD,
            hwnd: M.HANDLE,
            idObject: M.LONG,
            idChild: M.LONG,
            idEventThread: M.DWORD,
            dwmsEventTime: M.DWORD
        ) => void,
        idProcess: M.DWORD,
        idThread: M.DWORD,
        dwFlags: M.DWORD
    ): ReturnTypeWithCallbackEntry<M.HANDLE> {
        const _pfnWinEventProc = ffi.Callback(W.VOID, [W.HWINEVENTHOOK, W.DWORD, W.HWND, W.LONG, W.LONG, W.DWORD, W.DWORD], pfnWinEventProc);
        return {
            nativeReturnValue: _user32.SetWinEventHook(eventMin, eventMax, hmodWinEventProc, _pfnWinEventProc, idProcess, idThread, dwFlags),
            callbackEntry: _pfnWinEventProc
        };
    },
    UnhookWinEvent(hWinEventHook: ReturnTypeWithCallbackEntry<M.HANDLE>) {
        _user32.UnhookWinEvent(hWinEventHook.nativeReturnValue);
        delete hWinEventHook.callbackEntry;
    },
    EnumWindows(lpEnumFunc: (hwnd: M.HWND, lParam: M.LPARAM) => M.BOOL, lParam: M.LPARAM): ReturnTypeWithCallbackEntry<M.BOOL> {
        const _lpEnumFunc = ffi.Callback(W.BOOL, [W.HWND, W.LPARAM], lpEnumFunc);
        return {
            nativeReturnValue: _user32.EnumWindows(_lpEnumFunc, lParam),
            callbackEntry: _lpEnumFunc
        };
    },
    EnumChildWindows(hWndParent: M.HWND, lpEnumFunc: (hwnd: M.HWND, lParam: M.LPARAM) => M.BOOL, lParam: M.LPARAM): ReturnTypeWithCallbackEntry<M.BOOL> {
        const _lpEnumFunc = ffi.Callback(W.BOOL, [W.HWND, W.LPARAM], lpEnumFunc);
        return {
            nativeReturnValue: _user32.EnumChildWindows(hWndParent, _lpEnumFunc, lParam),
            callbackEntry: _lpEnumFunc
        };
    },
    WindowFromPoint(x: number, y: number) {
        const buf = Buffer.alloc(8);
        buf.writeUInt32LE(x, 0);
        buf.writeUInt32LE(y, 4);
        return _user32.WindowFromPoint(ref.readUInt64LE(buf, 0));
    },
    SetWindowsHookExA(idHook: M.INT, lpfn: (nCode: M.INT, wParam: M.WPARAM, lParam: Buffer) => M.LRESULT, hmod: M.HINSTANCE, dwThreadId: M.DWORD): ReturnTypeWithCallbackEntry<M.HHOOK> {
        const _lpfn = ffi.Callback(W.LRESULT, [W.INT, W.WPARAM, ref.refType(ref.types.uint64)], lpfn);
        return {
            nativeReturnValue: _user32.SetWindowsHookExA(idHook, _lpfn, hmod, dwThreadId),
            callbackEntry: _lpfn
        };
    },
    UnhookWindowsHookEx(hhk: ReturnTypeWithCallbackEntry<M.HHOOK>) {
        _user32.UnhookWindowsHookEx(hhk.nativeReturnValue);
        delete hhk.callbackEntry;
    }
};

export const gdi32: {
    CreateCompatibleDC: ForeignFunction<(hdc: M.HDC) => M.HDC>;
    DeleteDC: ForeignFunction<(hdc: M.HDC) => M.BOOL>;
    CreateCompatibleBitmap: ForeignFunction<(hdc: M.HDC, cx: M.INT, cy: M.INT) => M.HBITMAP>;
    SelectObject: ForeignFunction<(hdc: M.HDC, h: M.HGDIOBJ) => M.HGDIOBJ>;
    DeleteObject: ForeignFunction<(ho: M.HGDIOBJ) => M.BOOL>;
    GetBitmapBits: ForeignFunction<(hbit: M.HDC, cb: M.LONG, lpvBits: Buffer) => M.LONG>;
} = ffi.Library('gdi32', {
    CreateCompatibleDC: [W.HDC, [W.HDC]],
    DeleteDC: [W.BOOL, [W.HDC]],
    CreateCompatibleBitmap: [W.HBITMAP, [W.HDC, W.INT, W.INT]],
    SelectObject: [W.HGDIOBJ, [W.HDC, W.HGDIOBJ]],
    DeleteObject: [W.BOOL, [W.HGDIOBJ]],
    GetBitmapBits: [W.LONG, [W.HBITMAP, W.LONG, 'pointer']]
});
