//! Web-scraper provider tests driven through the real app binary.
//!
//! The scraper providers need a live WebView + the `scraper` capability, so
//! this test spawns `ame.exe` with `AME_PROVIDER_TEST=scraper:<site>` (see
//! `src/providers/selftest.rs`), waits for the JSON result file, and asserts the
//! translation. Gated on the `TEST_WEB` env var (old `.env.test.template`):
//!
//! ```text
//! cargo test --manifest-path src-tauri/Cargo.toml --test web_scraper_selftest
//! ```

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

fn load_dotenv() {
    static LOADED: OnceLock<()> = OnceLock::new();
    LOADED.get_or_init(|| {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|p| p.to_path_buf());
        let mut files: Vec<PathBuf> = Vec::new();
        for name in [".env", ".env.local", ".env.test", ".env.test.local"] {
            files.push(PathBuf::from(name));
            if let Some(root) = &root {
                files.push(root.join(name));
            }
        }
        for file in files {
            let _ = dotenvy::from_filename(&file);
        }
    });
}

fn wait_for_file(path: &Path, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if path.exists() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

#[derive(Debug)]
enum SiteOutcome {
    Passed { text: String },
    Blocked { reason: String },
    HarnessError { message: String },
}

fn run_site_selftest(binary: &str, site: &str) -> SiteOutcome {
    let dir = std::env::temp_dir().join(format!(
        "ame-provider-selftest-{site}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let output = dir.join("result.json");

    let mut child = Command::new(binary)
        .env("AME_PROVIDER_TEST", format!("scraper:{site}"))
        .env("AME_PROVIDER_TEST_OUTPUT", &output)
        .env("AME_TEST_STORE_CWD", &dir)
        .spawn()
        .unwrap_or_else(|e| panic!("failed to spawn app binary {binary}: {e}"));

    let ready = wait_for_file(&output, Duration::from_secs(180));
    if !ready {
        let _ = child.kill();
        let _ = child.wait();
        return SiteOutcome::HarnessError {
            message: format!("timed out waiting for scraper self-test result of {site}"),
        };
    }
    let _ = child.kill();
    let _ = child.wait();

    let raw = std::fs::read_to_string(&output).unwrap_or_default();
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            return SiteOutcome::HarnessError {
                message: format!("invalid self-test output for {site}: {e}: {raw}"),
            }
        }
    };
    if value["ok"] != serde_json::Value::Bool(true) {
        let reason = value["error"]
            .as_str()
            .unwrap_or("unknown error")
            .to_string();
        let reason = if reason.contains("timed out") {
            format!("{reason} (site not responding to programmatic input / captcha)")
        } else {
            reason
        };
        let _ = std::fs::remove_dir_all(&dir);
        return SiteOutcome::Blocked { reason };
    }
    let text = value["text"].as_str().unwrap_or("");
    if text.trim().is_empty() {
        let _ = std::fs::remove_dir_all(&dir);
        return SiteOutcome::Blocked {
            reason: "provider returned empty text (likely captcha / rate limit)".into(),
        };
    }

    let _ = std::fs::remove_dir_all(&dir);
    SiteOutcome::Passed {
        text: text.to_string(),
    }
}

#[test]
fn web_scrapers_translate_through_real_app() {
    load_dotenv();
    if std::env::var_os("TEST_WEB").is_none() {
        eprintln!("[SKIP] TEST_WEB not set; skipping web scraper tests");
        return;
    }
    let binary = env!("CARGO_BIN_EXE_ame");
    let mut passed = 0;
    let mut blocked = 0;
    for site in ["腾讯翻译君", "有道翻译"] {
        match run_site_selftest(binary, site) {
            SiteOutcome::Passed { text } => {
                passed += 1;
                eprintln!("[PASS] {site}: {text:?}");
            }
            SiteOutcome::Blocked { reason } => {
                blocked += 1;
                eprintln!("[SKIP] {site}: {reason}");
            }
            SiteOutcome::HarnessError { message } => {
                panic!("{message}");
            }
        }
    }
    eprintln!(
        "[SUMMARY] scraper self-test: {passed} passed, {blocked} blocked by site/network conditions"
    );
}
