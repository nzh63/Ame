//! Textractor extractor — replaces `src/main/extractor/Textractor/index.ts`.
//!
//! Spawns TextractorCLI.exe as a subprocess, communicates via stdin/stdout
//! in UTF-16LE encoding, and emits extracted text via Tauri events.

use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Emitter};

use crate::win32;

/// Post-processing options for extracted text.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PostProcessOption {
    #[serde(default)]
    pub remove_duplication: bool,
}

/// A running Textractor session.
pub struct Textractor {
    child: Option<Child>,
    #[allow(dead_code)]
    app: AppHandle,
    post_process: Arc<Mutex<PostProcessOption>>,
    hook_code: String,
    /// stdout reader thread; joined on destroy so it never outlives the
    /// extractor (its loop ends on EOF once the child is killed).
    reader_thread: Option<std::thread::JoinHandle<()>>,
}

impl Textractor {
    /// Start a new Textractor session for the given game PIDs.
    pub fn start(
        app: AppHandle,
        game_pids: Vec<u32>,
        hook_code: String,
        static_dir: PathBuf,
    ) -> Result<Self, String> {
        crate::log_info!("extractor", "Textractor start hook for pids {game_pids:?}");
        let is_wow64 = game_pids
            .first()
            .is_some_and(|&pid| win32::process::is_wow64(pid));
        let arch = if is_wow64 { "x86" } else { "x64" };
        let cli_path = static_dir
            .join("textractor")
            .join(arch)
            .join("TextractorCLI.exe");

        let mut cmd = Command::new(&cli_path);
        crate::win32::hide_console(&mut cmd);
        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start TextractorCLI: {e}"))?;

        // Send attach commands for each PID (UTF-16LE).
        if let Some(stdin) = child.stdin.as_mut() {
            for &pid in &game_pids {
                let cmd = format!("attach {hook_code} -P{pid}\r\n");
                crate::log_info!("extractor", "exec TextractorCli command: {cmd:?}");
                let utf16: Vec<u16> = cmd.encode_utf16().collect();
                let bytes: Vec<u8> = utf16.iter().flat_map(|c| c.to_le_bytes()).collect();
                let _ = stdin.write_all(&bytes);
            }
            let _ = stdin.flush();
        }

        let post_process = Arc::new(Mutex::new(PostProcessOption {
            remove_duplication: false,
        }));

        // Spawn a reader thread for stdout.
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let app_clone = app.clone();
        let pp_clone = post_process.clone();
        let reader_thread = std::thread::spawn(move || {
            Self::read_stdout(app_clone, stdout, pp_clone);
        });

        Ok(Self {
            child: Some(child),
            app,
            post_process,
            hook_code,
            reader_thread: Some(reader_thread),
        })
    }

    /// The hook code this extractor was attached with.
    pub fn hook_code(&self) -> String {
        self.hook_code.clone()
    }

    /// Read and parse TextractorCLI stdout (UTF-16LE encoded).
    fn read_stdout(
        app: AppHandle,
        mut stdout: std::process::ChildStdout,
        post_process: Arc<Mutex<PostProcessOption>>,
    ) {
        let mut buffer = String::new();
        let mut byte_buf = Vec::new();
        let mut chunk = [0u8; 4096];

        loop {
            let n = match stdout.read(&mut chunk) {
                Ok(0) => break,
                Ok(n) => n,
                Err(_) => break,
            };
            byte_buf.extend_from_slice(&chunk[..n]);

            // Decode complete UTF-16 code units.
            let complete = byte_buf.len() / 2 * 2;
            if complete == 0 {
                continue;
            }
            let u16s: Vec<u16> = byte_buf[..complete]
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            byte_buf.drain(..complete);

            if let Ok(decoded) = String::from_utf16(&u16s) {
                buffer.push_str(&decoded);
            }

            // Process complete lines.
            while let Some(pos) = buffer.find('\n') {
                let line: String = buffer.drain(..=pos).collect();
                let line = line.trim_end_matches(['\r', '\n']);
                if line.is_empty() {
                    continue;
                }
                if let Some((key, text)) = Self::parse_line(line) {
                    let processed = {
                        let pp = post_process.lock();
                        if pp.remove_duplication {
                            Self::remove_duplication(&text)
                        } else {
                            text
                        }
                    };
                    let _ = app.emit(
                        "original-watch-list-update",
                        serde_json::json!({ "key": key, "text": processed }),
                    );
                }
            }
        }
    }

    /// Parse a TextractorCLI output line.
    /// Format: `[...:addr:name] text`
    /// Returns (key, text) where key is "addr:name".
    fn parse_line(line: &str) -> Option<(String, String)> {
        let close = line.find(']')?;
        let header = line.get(1..close)?; // skip '['
        let text = line[close + 1..].trim().to_string();

        let parts: Vec<&str> = header.split(':').collect();
        if parts.len() < 2 {
            return None;
        }
        let addr = parts[parts.len() - 2];
        let name = parts[parts.len() - 1];
        let key = format!("{addr}:{name}");

        Some((key, text))
    }

    /// Remove character duplication (e.g. "aaaa" → "a").
    fn remove_duplication(text: &str) -> String {
        let mut result = String::new();
        let chars: Vec<char> = text.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            result.push(chars[i]);
            let mut j = i + 1;
            let mut count = 1;
            while j < chars.len() && chars[j] == chars[i] && count < 7 {
                count += 1;
                j += 1;
            }
            if count > 1 && count <= 7 {
                i = j;
            } else {
                i += 1;
            }
        }
        result
    }

    /// Update post-processing options.
    pub fn set_post_process(&self, option: PostProcessOption) {
        *self.post_process.lock() = option;
    }

    /// Get current post-processing options.
    pub fn get_post_process(&self) -> PostProcessOption {
        self.post_process.lock().clone()
    }

    /// Stop the Textractor process.
    pub fn destroy(&mut self) {
        crate::log_info!("extractor", "Textractor destroy, pids already detached");
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.child = None;
        if let Some(reader) = self.reader_thread.take() {
            let _ = reader.join();
        }
    }
}
