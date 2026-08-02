//! Minimal structured logger for the Rust backend.
//!
//! Mirrors the old Electron `debug('ame:main')` logging: every provider call
//! and every RPC handler logs what it received and what it returned. Lines
//! carry a timestamp, the source file + line, and the message. Enable with
//! `AME_LOG=1` (or `AME_LOG=debug`); the app still logs fatal errors without
//! the flag.

use std::io::Write;
use std::sync::OnceLock;

/// Whether detailed logging is enabled (env `AME_LOG=1`).
pub fn enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| {
        std::env::var("AME_LOG")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true") || v.eq_ignore_ascii_case("debug"))
            .unwrap_or(false)
    })
}

/// Write one log line: `[timestamp] [file:line] message`.
///
/// `tag` groups messages (e.g. `rpc`, `provider`, `ocr`); the caller passes
/// `file!()` / `line!()` so the macro can inline them.
pub fn log_line(tag: &str, file: &str, line: u32, args: std::fmt::Arguments<'_>) {
    if !enabled() {
        return;
    }
    let now = chrono::Local::now();
    let file = file.rsplit(['/', '\\']).next().unwrap_or(file);
    let mut stderr = std::io::stderr().lock();
    let _ = writeln!(
        stderr,
        "[{}] [{}:{}] [{}] {}",
        now.format("%Y-%m-%d %H:%M:%S%.3f"),
        file,
        line,
        tag,
        args
    );
}

/// Log at info level (only when `AME_LOG` is set).
#[macro_export]
macro_rules! log_info {
    ($tag:expr, $($arg:tt)*) => {
        $crate::logger::log_line($tag, file!(), line!(), format_args!($($arg)*))
    };
}
