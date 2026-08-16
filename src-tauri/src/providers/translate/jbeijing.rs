//! JBeijing offline translator (JP→ZH) via CLI subprocess.
//!
//! Protocol: length-prefixed UTF-16LE over stdin/stdout.
//! Write: 2-byte UInt16LE length + UTF-16LE text.
//! Read: 2-byte UInt16LE length prefix, then that many bytes of UTF-16LE.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::TranslateProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct JBeijingOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub path: JBeijingPath,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct JBeijingPath {
    #[ame(desc = "JBJCT.dll 的路径")]
    #[serde(default)]
    pub dll: Option<String>,
    #[ame(items = ["用户辞书1的路径", "用户辞书2的路径", "用户辞书3的路径"])]
    #[serde(default)]
    pub user_dicts: Vec<String>,
}

impl Default for JBeijingOptions {
    fn default() -> Self {
        Self {
            enable: true,
            path: JBeijingPath::default(),
        }
    }
}

pub struct JBeijing {
    pub options: JBeijingOptions,
    child: Arc<Mutex<Option<Child>>>,
    static_dir: PathBuf,
}

impl JBeijing {
    pub fn new(options: JBeijingOptions, static_dir: PathBuf) -> Self {
        let child = Self::spawn_process(&options, &static_dir);
        Self {
            options,
            child: Arc::new(Mutex::new(child)),
            static_dir,
        }
    }

    fn spawn_process(options: &JBeijingOptions, static_dir: &Path) -> Option<Child> {
        let dll = options.path.dll.as_ref()?;
        let cli = static_dir.join("native/bin/JBeijingCli.exe");
        let mut args: Vec<String> = vec![dll.clone()];
        for dict in &options.path.user_dicts {
            let trimmed = dict.trim();
            if !trimmed.is_empty() {
                args.push(trimmed.to_string());
            }
        }
        // Three trailing empty args per the original protocol.
        args.push(String::new());
        args.push(String::new());
        args.push(String::new());

        let mut cmd = Command::new(&cli);
        crate::win32::hide_console(&mut cmd);
        cmd.args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()
    }
}

/// Send text and read the translated response using the binary protocol,
/// with a deadline so a wedged CLI can't block the pipeline forever
/// (mirrors the Electron provider's 1000ms guard).
///
/// 超时/EOF 后子进程的 stdout 里还残留着这次请求的响应字节；若放任进程
/// 存活，下一次调用会把这些陈旧字节当作新的长度前缀读入，协议永久错位
/// （之后每次调用都返回乱码或立刻超时）。因此任何失败后都直接杀掉进程，
/// 下一次调用时用保存的参数重新拉起。
fn transact_child(
    child: &Arc<Mutex<Option<Child>>>,
    text: &str,
    deadline: std::time::Instant,
    respawn: impl FnOnce() -> Option<Child>,
) -> Result<String, String> {
    {
        let mut guard = child.lock();
        if guard.is_none() {
            *guard = respawn();
        }
    }
    let result = transact_child_inner(child, text, deadline);
    if result.is_err() {
        if let Some(mut dead) = child.lock().take() {
            let _ = dead.kill();
            let _ = dead.wait();
        }
    }
    result
}

fn transact_child_inner(
    child: &Arc<Mutex<Option<Child>>>,
    text: &str,
    deadline: std::time::Instant,
) -> Result<String, String> {
    let mut guard = child.lock();
    let child = guard.as_mut().ok_or("JBeijing process not running")?;

    let stdin = child.stdin.as_mut().ok_or("stdin unavailable")?;
    let stdout = child.stdout.as_mut().ok_or("stdout unavailable")?;

    // Encode as UTF-16LE.
    let input: Vec<u8> = text.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();

    // Write 2-byte length prefix + data.
    let len = input.len() as u16;
    stdin
        .write_all(&len.to_le_bytes())
        .map_err(|e| e.to_string())?;
    stdin.write_all(&input).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;

    // Read 2-byte length prefix (bounded by deadline).
    let mut len_buf = [0u8; 2];
    read_exact_bounded(stdout, &mut len_buf, deadline)
        .map_err(|e| format!("JBeijing read length: {e}"))?;
    let out_len = u16::from_le_bytes(len_buf) as usize;

    // Read that many bytes (bounded by deadline).
    let mut out_buf = vec![0u8; out_len];
    read_exact_bounded(stdout, &mut out_buf, deadline)
        .map_err(|e| format!("JBeijing read body: {e}"))?;

    // Decode UTF-16LE.
    let u16s: Vec<u16> = out_buf
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16(&u16s).map_err(|e| e.to_string())
}

/// `read_exact` that aborts with an error once `deadline` passes.
fn read_exact_bounded(
    stdout: &mut impl Read,
    buf: &mut [u8],
    deadline: std::time::Instant,
) -> Result<(), String> {
    let mut filled = 0;
    while filled < buf.len() {
        if std::time::Instant::now() >= deadline {
            return Err("timeout".into());
        }
        match stdout.read(&mut buf[filled..]) {
            Ok(0) => return Err("EOF".into()),
            Ok(n) => filled += n,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

impl TranslateProvider for JBeijing {
    fn id(&self) -> &str {
        "JBeijing"
    }

    fn options_schema() -> Value {
        <JBeijingOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(JBeijingOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <JBeijingOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable && self.options.path.dll.is_some()
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        // transact 是同步阻塞 I/O（read_exact），必须移到 blocking 线程池，
        // 否则会占住 Tauri async runtime 的 worker（Electron 用异步回调，
        // 不阻塞；且带 1000ms 超时保护，CLI 卡住时翻译管线不会挂死）。
        let child = self.child.clone();
        let options = self.options.clone();
        let static_dir = self.static_dir.clone();
        tokio::task::spawn_blocking(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1000);
            transact_child(&child, &text, deadline, || {
                JBeijing::spawn_process(&options, &static_dir)
            })
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

impl Drop for JBeijing {
    fn drop(&mut self) {
        // `Child` does not terminate the process when dropped; kill the CLI
        // explicitly so every session teardown releases the subprocess
        // (mirrors the old Electron `destroy()` which called process.kill()).
        if let Some(mut child) = self.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 一个可被 kill 的长驻子进程（stdin/stdout 均为管道，模拟 CLI 协议）。
    fn spawn_sleeper() -> Child {
        let mut cmd = Command::new("cmd");
        crate::win32::hide_console(&mut cmd);
        cmd.args(["/C", "ping -n 10 127.0.0.1 > nul"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn sleeper process")
    }

    #[test]
    fn failed_transact_kills_child_and_next_call_respawns() {
        let child = Arc::new(Mutex::new(Some(spawn_sleeper())));
        // 已过期的 deadline：读长度前缀时立刻超时（不依赖子进程行为）。
        let deadline = std::time::Instant::now() - std::time::Duration::from_millis(1);

        let err = transact_child(&child, "テスト", deadline, || Some(spawn_sleeper()))
            .expect_err("expired deadline must fail");
        assert!(err.contains("timeout"), "unexpected error: {err}");
        // 回归点 1：失败后必须杀掉并移除子进程。旧实现让进程带残留字节
        // 存活，下一次调用会把这次响应错读成新的长度前缀（协议永久错位）。
        assert!(
            child.lock().is_none(),
            "failed transact must kill and remove the child"
        );

        // 回归点 2：下一次调用通过 respawn 重新拉起进程，而不是拿着
        // None 直接报 "process not running"（旧实现进程死后永久失效）。
        let respawns = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter = respawns.clone();
        let result = transact_child(&child, "テスト", deadline, move || {
            counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            Some(spawn_sleeper())
        });
        assert!(result.is_err());
        assert_eq!(
            respawns.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "respawn must be invoked exactly once"
        );
        assert!(child.lock().is_none());
    }
}
