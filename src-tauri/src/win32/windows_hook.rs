//! Global keyboard/mouse hooks — replaces `native/addons/WindowsHook`.
//!
//! Emits Tauri events: `global-keyboard` and `global-mouse`.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread::JoinHandle;

use std::sync::mpsc::channel;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, PeekMessageW, PostMessageW, PostThreadMessageW,
    SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG,
    MSLLHOOKSTRUCT, PM_REMOVE, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_LBUTTONDOWN, WM_LBUTTONUP,
    WM_MOUSEWHEEL, WM_QUIT,
};

/// HHOOK wraps a raw pointer; treat as Send (only touched from hook thread).
struct HookHandle(HHOOK);
unsafe impl Send for HookHandle {}

struct HookState {
    app: AppHandle,
    keyboard_hook: Option<HookHandle>,
    mouse_hook: Option<HookHandle>,
}

/// Handle to the single pump thread, tracked separately from `HookState` so
/// `stop()` can signal and join the thread without racing its own writes.
struct ThreadCtl {
    thread_id: u32,
    running: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

static STATE: OnceLock<Mutex<Option<HookState>>> = OnceLock::new();
static THREAD: OnceLock<Mutex<Option<ThreadCtl>>> = OnceLock::new();

/// 自定义消息（WM_APP + 1）：唤醒 pump 线程处理积压的 hook 事件。
const WM_HOOK_EVENTS: u32 = 0x8001;

/// 待派发的事件。低级 hook 回调运行在系统输入处理的关键路径上（系统
/// 同步等待回调返回才放行输入），所以回调里只做过滤 + 入队 + PostMessageW；
/// 日志和 Tauri emit（同步分发）全部移到 pump 线程处理完输入之后再做。
/// 否则每个鼠标/键盘事件都会阻塞系统输入分发，表现为"鼠标一卡一卡"
/// （旧版 Electron 的回调只做轻量 JS 调用，没有这些问题）。
#[derive(Clone, Copy)]
struct PendingEvent {
    /// "mouse-left-down" / "key-up" ...
    name: &'static str,
    wparam: u32,
    vk_code: u32,
    x: i32,
    y: i32,
}

static EVENTS: OnceLock<Mutex<VecDeque<PendingEvent>>> = OnceLock::new();
/// 队列非空时是否已 post 过唤醒消息（避免每事件都 post 造成消息堆积）。
static EVENTS_PENDING: AtomicBool = AtomicBool::new(false);

fn events() -> &'static Mutex<VecDeque<PendingEvent>> {
    EVENTS.get_or_init(|| Mutex::new(VecDeque::new()))
}

/// 占用计数：会话钩子（`hook::start`）与临时捕获（点击选取窗口）都会
/// `start`/`stop`；计数归零才真正拆钩子，避免临时捕获把会话钩子拆掉。
static REFCOUNT: AtomicUsize = AtomicUsize::new(0);

fn state() -> &'static Mutex<Option<HookState>> {
    STATE.get_or_init(|| Mutex::new(None))
}
fn thread_ctl() -> &'static Mutex<Option<ThreadCtl>> {
    THREAD.get_or_init(|| Mutex::new(None))
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let msg = wparam.0 as u32;
        // 只关心 key-down/key-up（对齐旧版 GlobalKeyboardEventHook），
        // 其他键盘消息不入队、不转发。
        if msg == 0x0100 || msg == 0x0101 {
            let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            enqueue(PendingEvent {
                name: if msg == 0x0100 { "key-down" } else { "key-up" },
                wparam: msg,
                vk_code: kb.vkCode,
                x: 0,
                y: 0,
            });
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let msg = wparam.0 as u32;
        if msg == WM_LBUTTONDOWN || msg == WM_LBUTTONUP || msg == WM_MOUSEWHEEL {
            let ms = &*(lparam.0 as *const MSLLHOOKSTRUCT);
            enqueue(PendingEvent {
                name: if msg == WM_LBUTTONDOWN {
                    "mouse-left-down"
                } else if msg == WM_LBUTTONUP {
                    "mouse-left-up"
                } else {
                    "mouse-wheel"
                },
                wparam: msg,
                vk_code: 0,
                x: ms.pt.x,
                y: ms.pt.y,
            });
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}

/// 入队并唤醒 pump 线程（回调内只做这一件事，必须尽快返回）。
fn enqueue(ev: PendingEvent) {
    {
        let mut q = events().lock();
        // 消费端被重活阻塞时丢弃最旧事件，避免无界积压。
        if q.len() >= 512 {
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

/// 消费积压的 hook 事件：打日志 + emit。运行在 pump 线程、系统输入已经
/// 放行（回调已返回）之后，耗时操作不再卡住鼠标/键盘。
fn drain_and_emit() {
    EVENTS_PENDING.store(false, Ordering::SeqCst);
    let events: Vec<PendingEvent> = events().lock().drain(..).collect();
    if events.is_empty() {
        return;
    }
    // 先取出 app 并立即释放全局锁：emit 是同步分发，可能被慢监听器拖住，
    // 不能让 start()/cleanup() 被一次鼠标事件分发阻塞。
    let app = {
        let guard = state().lock();
        guard.as_ref().map(|st| st.app.clone())
    };
    let Some(app) = app else { return };
    for ev in events {
        if ev.name.starts_with("mouse") {
            crate::log_info!("hook", "GlobalMouse {} at ({}, {})", ev.name, ev.x, ev.y);
            let _ = app.emit(
                "global-mouse",
                serde_json::json!({
                    "wParam": ev.wparam,
                    "pt": { "x": ev.x, "y": ev.y },
                }),
            );
        } else {
            crate::log_info!("hook", "GlobalKeyboard {} vkCode={}", ev.name, ev.vk_code);
            let _ = app.emit(
                "global-keyboard",
                serde_json::json!({ "wParam": ev.wparam, "vkCode": ev.vk_code }),
            );
        }
    }
}

/// Start global keyboard and mouse hooks on a background thread.
///
/// Reference-counted: the first caller spins up the pump thread, later
/// callers just bump the count. Pair with [`stop`].
pub fn start(app: AppHandle) {
    crate::log_info!("hook", "start GlobalKeyboard/GlobalMouse hooks");
    let prev = REFCOUNT.fetch_add(1, Ordering::SeqCst);
    if prev > 0 {
        return;
    }
    // 单实例保证：如果旧线程还在（例如上次 stop 未完成），先停掉再启动，
    // 避免两个 pump 线程同时存在、互相覆盖 thread_ctl。
    stop_inner();

    let running = Arc::new(AtomicBool::new(true));
    let running_thread = running.clone();
    // 同步：等 pump 线程写入 thread_id 并进入消息循环后再返回，
    // 避免 stop() 在 thread_id 还是 0 时 post WM_QUIT 失败导致线程
    // 永远卡在 GetMessageW（join 永久阻塞 → 开/关游戏卡死）。
    let (ready_tx, ready_rx) = channel::<u32>();
    *thread_ctl().lock() = Some(ThreadCtl {
        thread_id: 0,
        running,
        handle: None,
    });

    let handle = std::thread::spawn(move || {
        unsafe {
            // Record the OS thread id so `stop()` can post WM_QUIT and wake
            // the blocking message pump.
            let thread_id = GetCurrentThreadId();
            let _ = ready_tx.send(thread_id);

            let keyboard_hook =
                SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0).ok();
            let mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_proc), None, 0).ok();

            {
                let mut guard = state().lock();
                *guard = Some(HookState {
                    app,
                    keyboard_hook: keyboard_hook.map(HookHandle),
                    mouse_hook: mouse_hook.map(HookHandle),
                });
            }

            // `stop()` may have run while we were installing; bail out instead
            // of pumping forever with hooks nobody wants.
            if !running_thread.load(Ordering::SeqCst) {
                cleanup();
                return;
            }

            // Message pump required for low-level hooks. Poll with a short
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
                        // 输入已放行，处理积压的 hook 事件（日志 + emit）。
                        drain_and_emit();
                    } else {
                        let _ = TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                }
                if quit {
                    break;
                }
                // 兜底：即使唤醒消息丢失（post 失败/被吞）也处理积压事件；
                // 队列为空时只做两次近乎零开销的锁检查。
                drain_and_emit();
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            cleanup();
        }
    });

    if let Some(ctl) = thread_ctl().lock().as_mut() {
        ctl.handle = Some(handle);
    }
    // 等待线程就绪（最多 2s）；失败则说明启动异常，但仍继续。
    let _ = ready_rx.recv_timeout(std::time::Duration::from_secs(2));
}

/// Release one reference and, when the last one is dropped, unhook and join
/// the pump thread (safe to call multiple times).
pub fn stop() {
    let prev = REFCOUNT.fetch_sub(1, Ordering::SeqCst);
    if prev == 0 {
        // 没有占用者还调用 stop（例如会话销毁时钩子本就没启动）——
        // 不真正拆钩子，保持幂等。
        REFCOUNT.store(0, Ordering::SeqCst);
        return;
    }
    if prev > 1 {
        return;
    }
    stop_inner();
}

/// 无条件停止并 join 当前 pump 线程（不调整引用计数）。
/// 供 `start` 在启动新线程前清理可能残留的旧线程。
fn stop_inner() {
    let ctl = thread_ctl().lock().take();
    let Some(ctl) = ctl else { return };
    ctl.running.store(false, Ordering::SeqCst);
    if ctl.thread_id != 0 {
        unsafe {
            let _ = PostThreadMessageW(ctl.thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
        }
    }
    if let Some(handle) = ctl.handle {
        let _ = handle.join();
    }
}

/// Unhook and drop the current hook state (called from the pump thread).
unsafe fn cleanup() {
    if let Some(st) = state().lock().take() {
        if let Some(h) = st.keyboard_hook {
            let _ = UnhookWindowsHookEx(h.0);
        }
        if let Some(h) = st.mouse_hook {
            let _ = UnhookWindowsHookEx(h.0);
        }
    }
}
