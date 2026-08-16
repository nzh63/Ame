//! 启动时检查更新。移植自旧 Electron 版 `src/main/index.ts` 的
//! CHECK_UPDATES 逻辑：查询 update.electronjs.org，发现新版本时弹窗，
//! 确认后在系统浏览器打开下载页。仅 release 构建启用（旧版
//! build-preset.mts 中 production 才置 CHECK_UPDATES: true，dev/e2e 均为
//! false，与 `#[cfg(not(debug_assertions))]` 对应）。
//!
//! 注意：update.electronjs.org 通过 release 资产文件名识别架构，要求
//! 产物名匹配 `*-win32-(ia32|x64|arm64)*`（详见其 asset-platform.ts），
//! CI 发布工作流会把 NSIS 产物重命名为 `Ame-win32-<arch>-<version>.exe`。

use serde::Deserialize;
use tauri::AppHandle;

/// update.electronjs.org 使用 Electron 风格的架构名（x86 → ia32）。
pub(crate) fn electron_arch() -> &'static str {
    if cfg!(target_arch = "x86") {
        "ia32"
    } else {
        "x64"
    }
}

pub(crate) fn update_check_url(arch: &str, version: &str) -> String {
    format!("https://update.electronjs.org/nzh63/Ame/win32-{arch}/{version}")
}

#[derive(Debug, Deserialize, PartialEq)]
pub(crate) struct UpdateInfo {
    pub name: String,
    pub notes: String,
    pub url: String,
}

/// 解析服务响应。name / notes / url 三者都非空才算有效更新
/// （对应旧版 `json.name && json.notes && json.url` 检查）。
pub(crate) fn parse_update(body: &[u8]) -> Option<UpdateInfo> {
    let info: UpdateInfo = serde_json::from_slice(body).ok()?;
    if info.name.trim().is_empty() || info.notes.trim().is_empty() || info.url.trim().is_empty() {
        return None;
    }
    Some(UpdateInfo {
        name: info.name.trim().to_string(),
        notes: format_update_notes(&info.notes),
        url: info.url,
    })
}

/// 旧版把更新说明中的 markdown 链接降级为纯文本并统一换行
/// （`\[(.*?)\]\(.*?\)` → `$1`，`[\n\r]+` → `\n`）。
fn format_update_notes(notes: &str) -> String {
    normalize_newlines(&strip_markdown_links(notes.trim()))
}

/// 无 regex 依赖的 `[text](url)` → `text` 替换；`[` 后没有匹配的
/// `](..)` 时原样保留（如普通的方括号文本）。
fn strip_markdown_links(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        let rest = s.get(i..).unwrap();
        if let Some(after_bracket) = rest.strip_prefix('[') {
            if let Some(close) = after_bracket.find("](") {
                if let Some(end) = after_bracket[close + 2..].find(')') {
                    out.push_str(&after_bracket[..close]);
                    i += 1 + close + 2 + end + 1;
                    continue;
                }
            }
        }
        let ch = rest.chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// `\r\n` / `\r` / 连续换行统一折叠为单个 `\n`。
fn normalize_newlines(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut last_was_newline = false;
    for c in s.chars() {
        if c == '\n' || c == '\r' {
            if !last_was_newline {
                out.push('\n');
            }
            last_was_newline = true;
        } else {
            out.push(c);
            last_was_newline = false;
        }
    }
    out
}

/// 启动 3 秒后后台检查一次更新；失败静默（与旧版一致，仅记日志）。
pub fn spawn_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        if let Err(e) = check_and_prompt(&app).await {
            crate::log_info!("update", "check for updates failed: {e}");
        }
    });
}

async fn check_and_prompt(app: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let version = app.package_info().version.to_string();
    let url = update_check_url(electron_arch(), &version);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;
    let resp = client.get(&url).send().await?;
    // 204 = 无更新；其余非成功状态同样按无更新处理。
    if !resp.status().is_success() {
        return Ok(());
    }
    let body = resp.bytes().await?;
    let Some(info) = parse_update(&body) else {
        return Ok(());
    };
    prompt_download(app, info);
    Ok(())
}

fn prompt_download(app: &AppHandle, info: UpdateInfo) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    let app = app.clone();
    let url = info.url;
    app.dialog()
        .message(format!("{}\n\n{}", info.name, info.notes))
        .title("发现新版本")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "下载".into(),
            "取消".into(),
        ))
        .show(move |download| {
            if download {
                #[allow(deprecated)]
                {
                    use tauri_plugin_shell::ShellExt;
                    let _ = app.shell().open(&url, None);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_check_url_format() {
        assert_eq!(
            update_check_url("x64", "0.5.12"),
            "https://update.electronjs.org/nzh63/Ame/win32-x64/0.5.12"
        );
        assert_eq!(
            update_check_url("ia32", "1.2.3"),
            "https://update.electronjs.org/nzh63/Ame/win32-ia32/1.2.3"
        );
    }

    #[test]
    fn electron_arch_maps_x86_to_ia32() {
        let arch = electron_arch();
        if cfg!(target_arch = "x86") {
            assert_eq!(arch, "ia32");
        } else if cfg!(target_arch = "x86_64") {
            assert_eq!(arch, "x64");
        }
    }

    #[test]
    fn parse_update_requires_all_fields() {
        let info = parse_update(
            r#"{"name":"v0.6.0","notes":"修复若干问题","url":"https://example.com/a.exe"}"#
                .as_bytes(),
        )
        .expect("all fields present should parse");
        assert_eq!(info.name, "v0.6.0");
        assert_eq!(info.url, "https://example.com/a.exe");

        // 缺任意一个字段、或字段为空 → 无更新
        assert!(parse_update(br#"{"name":"v0.6.0","notes":"x"}"#).is_none());
        assert!(parse_update(br#"{"name":"","notes":"x","url":"u"}"#).is_none());
        assert!(parse_update(br#"{"name":"v","notes":"  ","url":"u"}"#).is_none());
        assert!(parse_update(br#"{"name":"v","notes":"x","url":""}"#).is_none());
        assert!(parse_update(b"not json").is_none());
        assert!(parse_update(b"").is_none());
    }

    #[test]
    fn parse_update_formats_notes_like_the_electron_version() {
        let info = parse_update(
            br#"{"name":"v0.6.0","notes":"\r\nsee [the changelog](https://example.com) and [notes](x)\r\n\r\n- item","url":"u"}"#,
        )
        .unwrap();
        assert_eq!(info.notes, "see the changelog and notes\n- item");
    }

    #[test]
    fn markdown_link_stripping_keeps_plain_brackets() {
        assert_eq!(strip_markdown_links("[text](url)"), "text");
        assert_eq!(strip_markdown_links("a [b](u) c"), "a b c");
        assert_eq!(strip_markdown_links("[not a link"), "[not a link");
        assert_eq!(
            strip_markdown_links("[broken](unclosed"),
            "[broken](unclosed"
        );
        assert_eq!(strip_markdown_links("[]()"), "");
        assert_eq!(strip_markdown_links("中文[链接](u)测试"), "中文链接测试");
    }

    #[test]
    fn newline_normalization_collapses_runs() {
        assert_eq!(normalize_newlines("a\r\nb"), "a\nb");
        assert_eq!(normalize_newlines("a\r\rb"), "a\nb");
        assert_eq!(normalize_newlines("a\n\n\nb"), "a\nb");
        assert_eq!(normalize_newlines("a\r\n\r\nb"), "a\nb");
        assert_eq!(normalize_newlines("no newlines"), "no newlines");
    }
}
