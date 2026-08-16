//! DrEye offline translator via CLI subprocess.
//!
//! Protocol: length-prefixed over stdin/stdout with configurable encodings.
//! Supports JP↔ZH (Shift_JIS/GBK) and EN↔ZH (UTF-8/GBK).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use encoding_rs::{Encoding, GBK, SHIFT_JIS, UTF_8};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::TranslateProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct DrEyeOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub path: DrEyePath,
    #[ame(desc = "翻译选项")]
    #[serde(default = "default_type")]
    pub translate_type: TranslateDirection,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct DrEyePath {
    #[ame(readable = "TransCOM.dll 的路径", desc = "安装目录/DreyeMT/SDK/bin")]
    #[serde(rename = "dllTransCOM")]
    #[serde(default)]
    pub dll_trans_com: Option<String>,
    #[ame(readable = "TransCOMEC.dll 的路径", desc = "安装目录/DreyeMT/SDK/bin")]
    #[serde(rename = "dllTransCOMEC")]
    #[serde(default)]
    pub dll_trans_com_ec: Option<String>,
}

/// Translation direction (which DLL/encoding pair to use).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum TranslateDirection {
    #[default]
    #[serde(rename = "日->中")]
    JapaneseToChinese,
    #[serde(rename = "中->日")]
    ChineseToJapanese,
    #[serde(rename = "英->中")]
    EnglishToChinese,
    #[serde(rename = "中->英")]
    ChineseToEnglish,
}

fn default_type() -> TranslateDirection {
    TranslateDirection::default()
}

impl Default for DrEyeOptions {
    fn default() -> Self {
        Self {
            enable: true,
            path: DrEyePath::default(),
            translate_type: default_type(),
        }
    }
}

/// Per-direction configuration.
struct DirectionConfig {
    dll: Option<String>,
    suffix: &'static str,
    dat: u32,
    src_enc: &'static Encoding,
    dest_enc: &'static Encoding,
}

impl DrEyeOptions {
    fn direction(&self) -> Option<DirectionConfig> {
        match self.translate_type {
            TranslateDirection::JapaneseToChinese => Some(DirectionConfig {
                dll: self.path.dll_trans_com.clone(),
                suffix: "CJ",
                dat: 10,
                src_enc: SHIFT_JIS,
                dest_enc: GBK,
            }),
            TranslateDirection::ChineseToJapanese => Some(DirectionConfig {
                dll: self.path.dll_trans_com.clone(),
                suffix: "CJ",
                dat: 10,
                src_enc: GBK,
                dest_enc: SHIFT_JIS,
            }),
            TranslateDirection::EnglishToChinese => Some(DirectionConfig {
                dll: self.path.dll_trans_com_ec.clone(),
                suffix: "EC",
                dat: 1,
                src_enc: UTF_8,
                dest_enc: GBK,
            }),
            TranslateDirection::ChineseToEnglish => Some(DirectionConfig {
                dll: self.path.dll_trans_com_ec.clone(),
                suffix: "EC",
                dat: 1,
                src_enc: GBK,
                dest_enc: UTF_8,
            }),
        }
    }
}

pub struct DrEye {
    pub options: DrEyeOptions,
    child: Arc<Mutex<Option<Child>>>,
    src_enc: &'static Encoding,
    dest_enc: &'static Encoding,
    static_dir: PathBuf,
}

impl DrEye {
    pub fn new(options: DrEyeOptions, static_dir: PathBuf) -> Self {
        let dir = options.direction();
        let (src_enc, dest_enc) = dir
            .as_ref()
            .map(|d| (d.src_enc, d.dest_enc))
            .unwrap_or((UTF_8, UTF_8));
        let child = dir
            .as_ref()
            .and_then(|d| Self::spawn_process(d, &static_dir));
        Self {
            options,
            child: Arc::new(Mutex::new(child)),
            src_enc,
            dest_enc,
            static_dir,
        }
    }

    fn spawn_process(dir: &DirectionConfig, static_dir: &Path) -> Option<Child> {
        let dll = dir.dll.as_ref()?;
        let cwd = PathBuf::from(dll).parent()?.to_path_buf();
        let cli = static_dir.join("native/bin/DrEyeCli.exe");
        let args = [
            dll.clone(),
            format!("MTInit{}", dir.suffix),
            format!("MTEnd{}", dir.suffix),
            format!("TranTextFlow{}", dir.suffix),
            dir.dat.to_string(),
        ];
        let mut cmd = Command::new(&cli);
        crate::win32::hide_console(&mut cmd);
        cmd.args(&args)
            .current_dir(&cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()
    }

    fn transact(&self, text: &str) -> Result<String, String> {
        let mut guard = self.child.lock();
        let child = guard.as_mut().ok_or("DrEye process not running")?;
        let stdin = child.stdin.as_mut().ok_or("stdin unavailable")?;
        let stdout = child.stdout.as_mut().ok_or("stdout unavailable")?;
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1000);
        transact_inner(stdin, stdout, text, self.src_enc, self.dest_enc, deadline)
    }
}

/// Free-function variant used from the blocking thread (Arc-cloned child).
///
/// 超时/EOF 后子进程 stdout 里残留的响应字节会让后续调用的长度前缀读错
/// 位（协议永久错位，之后每次都乱码/立刻超时）。因此任何失败后都杀掉
/// 进程，下一次调用时用保存的参数重新拉起（与 JBeijing 相同）。
fn transact_child(
    child: &Arc<Mutex<Option<Child>>>,
    text: &str,
    src_enc: &'static Encoding,
    dest_enc: &'static Encoding,
    deadline: std::time::Instant,
    respawn: impl FnOnce() -> Option<Child>,
) -> Result<String, String> {
    {
        let mut guard = child.lock();
        if guard.is_none() {
            *guard = respawn();
        }
    }
    let result = transact_child_inner(child, text, src_enc, dest_enc, deadline);
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
    src_enc: &'static Encoding,
    dest_enc: &'static Encoding,
    deadline: std::time::Instant,
) -> Result<String, String> {
    let mut guard = child.lock();
    let child = guard.as_mut().ok_or("DrEye process not running")?;
    let stdin = child.stdin.as_mut().ok_or("stdin unavailable")?;
    let stdout = child.stdout.as_mut().ok_or("stdout unavailable")?;
    transact_inner(stdin, stdout, text, src_enc, dest_enc, deadline)
}

fn transact_inner(
    stdin: &mut impl Write,
    stdout: &mut impl Read,
    text: &str,
    src_enc: &'static Encoding,
    dest_enc: &'static Encoding,
    deadline: std::time::Instant,
) -> Result<String, String> {
    // Encode with source encoding.
    let (input, _, _) = src_enc.encode(text);

    let len = input.len() as u16;
    stdin
        .write_all(&len.to_le_bytes())
        .map_err(|e| e.to_string())?;
    stdin.write_all(&input).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())?;

    let mut len_buf = [0u8; 2];
    read_exact_bounded(stdout, &mut len_buf, deadline)
        .map_err(|e| format!("DrEye read length: {e}"))?;
    let out_len = u16::from_le_bytes(len_buf) as usize;

    let mut out_buf = vec![0u8; out_len];
    read_exact_bounded(stdout, &mut out_buf, deadline)
        .map_err(|e| format!("DrEye read body: {e}"))?;

    let (decoded, _, _) = dest_enc.decode(&out_buf);
    Ok(decoded.into_owned())
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

impl TranslateProvider for DrEye {
    fn id(&self) -> &str {
        "DrEye"
    }

    fn options_schema() -> Value {
        <DrEyeOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(DrEyeOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <DrEyeOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable && self.options.direction().and_then(|d| d.dll).is_some()
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        // transact 是同步阻塞 I/O（read_exact），移到 blocking 线程池避免
        // 占住 async worker；带 1000ms 超时保护（Electron 同款）。
        let child = self.child.clone();
        let src_enc = self.src_enc;
        let dest_enc = self.dest_enc;
        let options = self.options.clone();
        let static_dir = self.static_dir.clone();
        tokio::task::spawn_blocking(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_millis(1000);
            transact_child(&child, &text, src_enc, dest_enc, deadline, || {
                options
                    .direction()
                    .and_then(|d| DrEye::spawn_process(&d, &static_dir))
            })
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

impl Drop for DrEye {
    fn drop(&mut self) {
        // `Child` does not terminate the process when dropped; kill the CLI
        // explicitly so every session teardown releases the subprocess.
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
        // 与 JBeijing 相同的回归点：失败（超时/EOF）后残留字节会让下一次
        // 调用协议错位，必须杀掉进程；下次调用要能重拉起。
        let child = Arc::new(Mutex::new(Some(spawn_sleeper())));
        let deadline = std::time::Instant::now() - std::time::Duration::from_millis(1);

        let err = transact_child(&child, "テスト", UTF_8, UTF_8, deadline, || {
            Some(spawn_sleeper())
        })
        .expect_err("expired deadline must fail");
        assert!(err.contains("timeout"), "unexpected error: {err}");
        assert!(
            child.lock().is_none(),
            "failed transact must kill and remove the child"
        );

        let respawns = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counter = respawns.clone();
        let result = transact_child(&child, "テスト", UTF_8, UTF_8, deadline, move || {
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
