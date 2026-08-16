//! Window event hooks — replaces `native/addons/WindowEventHook`.
//!
//! Tracks minimize and move events for windows belonging to given PIDs,
//! emitting Tauri events: `window-minimize`, `window-restore`, `window-move`.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread::JoinHandle;

use std::sync::mpsc::channel;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{HWND, LPARAM, RECT, WPARAM};

use crate::win32::windows_hook::HookRefCount;
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetWindowRect, GetWindowThreadProcessId, PeekMessageW, PostMessageW,
    PostThreadMessageW, TranslateMessage, EVENT_SYSTEM_MINIMIZEEND, EVENT_SYSTEM_MINIMIZESTART,
    EVENT_SYSTEM_MOVESIZEEND, EVENT_SYSTEM_MOVESIZESTART, MSG, PM_REMOVE, WM_QUIT,
};

/// HWINEVENTHOOK wraps a raw pointer; we only ever touch it from the hook thread
/// (for unhooking), so treat it as Send.
struct HookHandle(HWINEVENTHOOK);
unsafe impl Send for HookHandle {}

struct HookState {
    app: AppHandle,
    pids: Vec<u32>,
    minimize_hook: Option<HookHandle>,
    move_hook: Option<HookHandle>,
}

/// Handle to the single pump thread (see `windows_hook` for rationale).
struct ThreadCtl {
    thread_id: u32,
    running: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

static STATE: OnceLock<Mutex<Option<HookState>>> = OnceLock::new();
static THREAD: OnceLock<Mutex<Option<ThreadCtl>>> = OnceLock::new();

/// 占用计数：多个并发会话各自 start/stop；计数归零才真正拆钩。
/// 旧实现是无条件单实例——会话 B 启动会顶掉 A 的 pids，A 销毁时又把
/// B 正在用的钩子整个拆掉（B 的窗口跟随/最小化镜像全部失效）。
static REFCOUNT: HookRefCount = HookRefCount::new();
/// 泵线程尚未就绪时暂存后续会话的 pids（就绪后并入过滤集合）。
static PENDING_PIDS: OnceLock<Mutex<Vec<u32>>> = OnceLock::new();

fn pending_pids() -> &'static Mutex<Vec<u32>> {
    PENDING_PIDS.get_or_init(|| Mutex::new(Vec::new()))
}

/// 合并两组 pid（去重、排序）——并入过滤集合时使用。
fn merged_pids(existing: Vec<u32>, extra: Vec<u32>) -> Vec<u32> {
    let mut v = existing;
    v.extend(extra);
    v.sort_unstable();
    v.dedup();
    v
}

/// 自定义消息（WM_APP + 1）：唤醒 pump 线程处理积压的窗口事件。
const WM_HOOK_EVENTS: u32 = 0x8001;

/// WinEvent 回调不在输入关键路径，但 `app.emit` 是同步分发，可能在慢监听器
/// （窗口跟随等）上耗时。与 `windows_hook` 一致：回调只做过滤 + 入队 +
/// PostMessageW，日志和 emit 移到 pump 线程处理完事件之后。
enum WinEventKind {
    Minimize,
    Restore,
    MoveStart,
    MoveEnd,
}

struct PendingWinEvent {
    kind: WinEventKind,
    hwnd: u64,
}

static EVENTS: OnceLock<Mutex<VecDeque<PendingWinEvent>>> = OnceLock::new();
static EVENTS_PENDING: AtomicBool = AtomicBool::new(false);
/// 拖动开始时的窗口位置（只在 pump 线程的 drain 中使用）。
static LAST_RECT: OnceLock<Mutex<Option<RECT>>> = OnceLock::new();

fn events() -> &'static Mutex<VecDeque<PendingWinEvent>> {
    EVENTS.get_or_init(|| Mutex::new(VecDeque::new()))
}

fn state() -> &'static Mutex<Option<HookState>> {
    STATE.get_or_init(|| Mutex::new(None))
}
fn thread_ctl() -> &'static Mutex<Option<ThreadCtl>> {
    THREAD.get_or_init(|| Mutex::new(None))
}

unsafe extern "system" fn minimize_callback(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if event != EVENT_SYSTEM_MINIMIZESTART && event != EVENT_SYSTEM_MINIMIZEEND {
        return;
    }
    if !owned_by_game(hwnd) {
        return;
    }
    enqueue(PendingWinEvent {
        kind: if event == EVENT_SYSTEM_MINIMIZESTART {
            WinEventKind::Minimize
        } else {
            WinEventKind::Restore
        },
        hwnd: hwnd.0 as u64,
    });
}

unsafe extern "system" fn move_callback(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if event != EVENT_SYSTEM_MOVESIZESTART && event != EVENT_SYSTEM_MOVESIZEEND {
        return;
    }
    if !owned_by_game(hwnd) {
        return;
    }
    enqueue(PendingWinEvent {
        kind: if event == EVENT_SYSTEM_MOVESIZESTART {
            WinEventKind::MoveStart
        } else {
            WinEventKind::MoveEnd
        },
        hwnd: hwnd.0 as u64,
    });
}

/// 回调内只做进程过滤 + 入队（快速返回）；不在此处 emit。
fn owned_by_game(hwnd: HWND) -> bool {
    let guard = state().lock();
    let Some(st) = guard.as_ref() else {
        return false;
    };
    let mut pid: u32 = 0;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }
    st.pids.contains(&pid)
}

fn enqueue(ev: PendingWinEvent) {
    {
        let mut q = events().lock();
        if q.len() >= 64 {
            q.pop_front();
        }
        q.push_back(ev);
    }
    if !EVENTS_PENDING.swap(true, Ordering::SeqCst) {
        unsafe {
            let _ = PostMessageW(None, WM_HOOK_EVENTS, WPARAM(0), LPARAM(0));
        }
    }
}

/// 消费积压的窗口事件：读窗口矩形 + emit（运行在 pump 线程，事件回调已返回）。
fn drain_and_emit() {
    EVENTS_PENDING.store(false, Ordering::SeqCst);
    let events: Vec<PendingWinEvent> = events().lock().drain(..).collect();
    if events.is_empty() {
        return;
    }
    let app = {
        let guard = state().lock();
        guard.as_ref().map(|st| st.app.clone())
    };
    let Some(app) = app else { return };
    let mut last_rect = LAST_RECT.get_or_init(|| Mutex::new(None)).lock();
    for ev in events {
        let hwnd = HWND(ev.hwnd as *mut _);
        match ev.kind {
            WinEventKind::Minimize => {
                let _ = app.emit("window-minimize", ());
            }
            WinEventKind::Restore => {
                let _ = app.emit("window-restore", ());
            }
            WinEventKind::MoveStart => {
                let mut rect = RECT::default();
                unsafe {
                    let _ = GetWindowRect(hwnd, &mut rect);
                }
                *last_rect = Some(rect);
            }
            WinEventKind::MoveEnd => {
                if let Some(prev) = last_rect.take() {
                    let mut rect = RECT::default();
                    unsafe {
                        let _ = GetWindowRect(hwnd, &mut rect);
                    }
                    let diff_left = rect.left - prev.left;
                    let diff_top = rect.top - prev.top;
                    let _ = app.emit(
                        "window-move",
                        serde_json::json!({ "diffLeft": diff_left, "diffTop": diff_top }),
                    );
                }
            }
        }
    }
}

/// Start watching minimize/move events for the given PIDs on a background thread.
///
/// Reference-counted: the first caller spins up the pump thread, later
/// callers just merge their PIDs into the filter set. Pair with [`stop`].
pub fn start(app: AppHandle, pids: Vec<u32>) {
    crate::log_info!("hook", "WindowEvent hook for pids {pids:?}");
    if !REFCOUNT.acquire() {
        // 已有泵线程在跟踪：并入本会话的 pids 即可。泵线程尚未装好钩子
        // 的极小窗口内先暂存，线程就绪后自行并入（见下方启动段）。
        let mut guard = state().lock();
        if let Some(st) = guard.as_mut() {
            st.pids = merged_pids(std::mem::take(&mut st.pids), pids);
        } else {
            drop(guard);
            pending_pids().lock().extend(pids);
        }
        return;
    }

    // 单实例保证：如果旧线程还在（例如上次 stop 未完成），先停掉再启动，
    // 避免两个泵线程同时存在、互相覆盖 thread_ctl。
    stop_inner();

    let running = Arc::new(AtomicBool::new(true));
    let running_thread = running.clone();
    // 同 windows_hook：等线程写入 thread_id 再返回，stop() 的
    // PostThreadMessageW 才不会因 thread_id 为 0 而丢失。
    let (ready_tx, ready_rx) = channel::<u32>();
    *thread_ctl().lock() = Some(ThreadCtl {
        thread_id: 0,
        running,
        handle: None,
    });

    let handle = std::thread::spawn(move || {
        unsafe {
            let thread_id = GetCurrentThreadId();
            let _ = ready_tx.send(thread_id);

            let minimize_hook = SetWinEventHook(
                EVENT_SYSTEM_MINIMIZESTART,
                EVENT_SYSTEM_MINIMIZEEND,
                None,
                Some(minimize_callback),
                0,
                0,
                0,
            );
            let move_hook = SetWinEventHook(
                EVENT_SYSTEM_MOVESIZESTART,
                EVENT_SYSTEM_MOVESIZEEND,
                None,
                Some(move_callback),
                0,
                0,
                0,
            );

            {
                let mut guard = state().lock();
                // 并入在钩子装好之前提交的后续会话 pids（见 start 的暂存）。
                let pending = std::mem::take(&mut *pending_pids().lock());
                let pids = merged_pids(pids, pending);
                *guard = Some(HookState {
                    app,
                    pids,
                    minimize_hook: Some(HookHandle(minimize_hook)),
                    move_hook: Some(HookHandle(move_hook)),
                });
            }

            if !running_thread.load(Ordering::SeqCst) {
                cleanup();
                return;
            }

            // Message pump to receive WinEvent callbacks. Poll with a short
            // timeout and check `running` so the thread exits even if the
            // WM_QUIT posted by `stop()` is lost (fast start/stop cycles).
            loop {
                if !running_thread.load(Ordering::SeqCst) {
                    break;
                }
                let mut msg = MSG::default();
                let mut quit = false;
                while PeekMessageW(&mut msg, None, 0, 0, PM_REMOVE).into() {
                    if msg.message == WM_QUIT {
                        quit = true;
                        break;
                    }
                    if msg.message == WM_HOOK_EVENTS {
                        drain_and_emit();
                    } else {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                }
                if quit {
                    break;
                }
                // 兜底：唤醒消息丢失时也处理积压事件（空队列时开销极小）。
                drain_and_emit();
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            cleanup();
        }
    });

    if let Some(ctl) = thread_ctl().lock().as_mut() {
        ctl.handle = Some(handle);
    }
    let _ = ready_rx.recv_timeout(std::time::Duration::from_secs(2));
}

/// Release one reference and, when the last one is dropped, unhook and join
/// the pump thread (safe to call multiple times).
pub fn stop() {
    if !REFCOUNT.release() {
        return;
    }
    stop_inner();
}

/// 无条件停止并 join 当前泵线程（不调整引用计数）。
/// 供 `start` 在启动新线程前清理可能残留的旧线程。
fn stop_inner() {
    let ctl = thread_ctl().lock().take();
    let Some(ctl) = ctl else { return };
    ctl.running.store(false, Ordering::SeqCst);
    if ctl.thread_id != 0 {
        unsafe {
            let _ = PostThreadMessageW(
                ctl.thread_id,
                WM_QUIT,
                Default::default(),
                Default::default(),
            );
        }
    }
    if let Some(handle) = ctl.handle {
        let _ = handle.join();
    }
}

/// Unhook and drop the current hook state (called from the pump thread).
unsafe fn cleanup() {
    if let Some(st) = state().lock().take() {
        if let Some(h) = st.minimize_hook {
            let _ = UnhookWinEvent(h.0);
        }
        if let Some(h) = st.move_hook {
            let _ = UnhookWinEvent(h.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merged_pids_dedups_and_sorts() {
        // 回归：多会话并入过滤集合时不能丢 pid、不能留重复。
        assert_eq!(merged_pids(vec![3, 1], vec![1, 2]), vec![1, 2, 3]);
        assert_eq!(merged_pids(vec![], vec![7, 7]), vec![7]);
        assert!(merged_pids(vec![], vec![]).is_empty());
        // 原有 pid 顺序无关紧要，但结果必须稳定（排序 + 去重）。
        assert_eq!(merged_pids(vec![9, 5, 9], vec![5, 1]), vec![1, 5, 9]);
    }
}
