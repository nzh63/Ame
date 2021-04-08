import ffi from 'ffi-napi';
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
    UnhookWinEvent: ForeignFunction<(hWinEventHook: M.HANDLE) => boolean>;
} = ffi.Library('user32', {
    SetWinEventHook: [W.HWINEVENTHOOK, [W.DWORD, W.DWORD, W.HMODULE, W.WINEVENTPROC, W.DWORD, W.DWORD, W.DWORD]],
    GetWindowRect: [W.BOOL, [W.HWND, W.RECT]],
    UnhookWinEvent: [W.BOOL, [W.HWINEVENTHOOK]]
});

type WinEventHookHandle = {
    nativeHandle: M.HANDLE;
    callbachEntry?: Buffer; // avoid GC
};

export const user32 = {
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
    ): WinEventHookHandle {
        const _pfnWinEventProc = ffi.Callback(W.VOID, [W.HWINEVENTHOOK, W.DWORD, W.HWND, W.LONG, W.LONG, W.DWORD, W.DWORD], pfnWinEventProc);
        return {
            nativeHandle: _user32.SetWinEventHook(eventMin, eventMax, hmodWinEventProc, _pfnWinEventProc, idProcess, idThread, dwFlags),
            callbachEntry: _pfnWinEventProc
        };
    },
    GetWindowRect: _user32.GetWindowRect,
    UnhookWinEvent(hWinEventHook: WinEventHookHandle) {
        _user32.UnhookWinEvent(hWinEventHook.nativeHandle);
        delete hWinEventHook.callbachEntry;
    }
};
