//! Diagnostic provider self-test mode, driven by the `AME_PROVIDER_TEST` env
//! var.
//!
//! The web-scraper providers need a live Tauri WebView + the `scraper`
//! capability, so they cannot run inside an in-process unit test. Instead
//! `tests/web_scraper_selftest.rs` spawns the real app binary with
//! `AME_PROVIDER_TEST=scraper:<site>`; this module runs the provider, writes
//! a JSON result to `AME_PROVIDER_TEST_OUTPUT`, and exits the process.

use serde_json::json;
use tauri::{App, AppHandle};

use crate::providers::translate::web_scraper::{ScraperSite, WebScraper, WebScraperOptions};
use crate::providers::translate::TranslateProvider;

/// If `AME_PROVIDER_TEST` is set, run one provider self-test in the background
/// and exit once the result is written. Returns `true` when self-test mode was
/// activated (the caller should skip normal startup).
pub fn maybe_run(app: &App) -> tauri::Result<bool> {
    let Ok(spec) = std::env::var("AME_PROVIDER_TEST") else {
        return Ok(false);
    };
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        let result = run_selftest(&app_handle, &spec).await;
        if let Ok(output) = std::env::var("AME_PROVIDER_TEST_OUTPUT") {
            let _ = std::fs::write(&output, result);
        }
        std::process::exit(0);
    });
    Ok(true)
}

async fn run_selftest(app: &AppHandle, spec: &str) -> String {
    match spec.split_once(':') {
        Some(("scraper", site)) => scraper_selftest(app, site).await,
        _ => json!({
            "ok": false,
            "error": format!("unknown AME_PROVIDER_TEST spec: {spec}")
        })
        .to_string(),
    }
}

async fn scraper_selftest(app: &AppHandle, site_id: &str) -> String {
    let (site, from, to) = match site_id {
        "腾讯翻译君" => (ScraperSite::QqFanyi, "日语", "简体中文"),
        "有道翻译" => (ScraperSite::YoudaoFanyi, "日语", "中文"),
        other => {
            return json!({
                "ok": false,
                "error": format!("unknown scraper site: {other}")
            })
            .to_string()
        }
    };
    let options = WebScraperOptions {
        enable: true,
        from_language: from.into(),
        to_language: to.into(),
    };
    let provider = WebScraper::new(site, options, app.clone());
    match provider.translate("こんにちは。".into()).await {
        Ok(text) => json!({ "ok": true, "text": text }).to_string(),
        Err(err) => json!({ "ok": false, "error": err }).to_string(),
    }
}
