//! Tencent Cloud Translate provider (腾讯云).
//!
//! POST https://tmt.tencentcloudapi.com  Action=TextTranslate
//! Signing: TC3-HMAC-SHA256 (Tencent Cloud API v3).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::TranslateProvider;
use crate::crypto::tencent_tc3_authorization;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: TencentApiConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentApiConfig {
    #[ame]
    #[serde(default)]
    pub credential: TencentCredential,
    #[ame(desc = "地域")]
    #[serde(default = "default_region")]
    pub region: String,
    #[ame]
    #[serde(default)]
    pub params: TencentParams,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentCredential {
    #[ame(
        readable = "密钥ID",
        desc = "可在 https://console.cloud.tencent.com/cam/capi 获取"
    )]
    #[serde(default)]
    pub secret_id: Option<String>,
    #[ame(
        readable = "密钥KEY",
        desc = "可在 https://console.cloud.tencent.com/cam/capi 获取"
    )]
    #[serde(default)]
    pub secret_key: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentParams {
    #[ame(desc = "源语言")]
    #[serde(default = "default_source")]
    pub source: TencentLang,
    #[ame(desc = "目标语言")]
    #[serde(default = "default_target")]
    pub target: TencentLang,
    // ProjectId has no label; omitted from the description.
    #[serde(rename = "ProjectId")]
    #[serde(default)]
    pub project_id: u64,
}

/// Tencent Machine Translation language codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum TencentLang {
    #[default]
    #[serde(rename = "ja")]
    Ja,
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "zh")]
    Zh,
    #[serde(rename = "zh-TW")]
    ZhTw,
    #[serde(rename = "en")]
    En,
    #[serde(rename = "ko")]
    Ko,
    #[serde(rename = "fr")]
    Fr,
    #[serde(rename = "es")]
    Es,
    #[serde(rename = "it")]
    It,
    #[serde(rename = "de")]
    De,
    #[serde(rename = "tr")]
    Tr,
    #[serde(rename = "ru")]
    Ru,
    #[serde(rename = "pt")]
    Pt,
    #[serde(rename = "vi")]
    Vi,
    #[serde(rename = "id")]
    Id,
    #[serde(rename = "th")]
    Th,
    #[serde(rename = "ms")]
    Ms,
    #[serde(rename = "ar")]
    Ar,
    #[serde(rename = "hi")]
    Hi,
}

fn default_region() -> String {
    "ap-guangzhou".into()
}
fn default_source() -> TencentLang {
    TencentLang::default()
}
fn default_target() -> TencentLang {
    TencentLang::Zh
}

impl Default for TencentOptions {
    fn default() -> Self {
        Self {
            enable: true,
            api_config: TencentApiConfig {
                credential: TencentCredential::default(),
                region: default_region(),
                params: TencentParams {
                    source: default_source(),
                    target: default_target(),
                    project_id: 0,
                },
            },
        }
    }
}

impl Default for TencentApiConfig {
    fn default() -> Self {
        Self {
            credential: TencentCredential::default(),
            region: default_region(),
            params: TencentParams {
                source: default_source(),
                target: default_target(),
                project_id: 0,
            },
        }
    }
}

impl Default for TencentParams {
    fn default() -> Self {
        Self {
            source: default_source(),
            target: default_target(),
            project_id: 0,
        }
    }
}

pub struct Tencent {
    pub options: TencentOptions,
    client: reqwest::Client,
}

impl Tencent {
    pub fn new(options: TencentOptions) -> Self {
        Self {
            options,
            client: reqwest::Client::new(),
        }
    }
}

impl TranslateProvider for Tencent {
    fn id(&self) -> &str {
        "腾讯云"
    }

    fn options_schema() -> Value {
        <TencentOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(TencentOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <TencentOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
            && self.options.api_config.credential.secret_id.is_some()
            && self.options.api_config.credential.secret_key.is_some()
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        let cred = &self.options.api_config.credential;
        let secret_id = cred.secret_id.clone().unwrap_or_default();
        let secret_key = cred.secret_key.clone().unwrap_or_default();
        let region = &self.options.api_config.region;
        let params = &self.options.api_config.params;

        let service = "tmt";
        let host = "tmt.tencentcloudapi.com";
        let action = "TextTranslate";
        let version = "2018-03-21";
        let timestamp = chrono::Utc::now().timestamp();

        let payload = json!({
            "SourceText": text,
            "Source": params.source,
            "Target": params.target,
            "ProjectId": params.project_id,
        })
        .to_string();

        let authorization = tencent_tc3_authorization(
            &secret_id,
            &secret_key,
            service,
            action,
            timestamp,
            &payload,
        );

        let resp = self
            .client
            .post(format!("https://{host}"))
            .header("Authorization", authorization)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Host", host)
            .header("X-TC-Action", action)
            .header("X-TC-Timestamp", timestamp.to_string())
            .header("X-TC-Version", version)
            .header("X-TC-Region", region)
            .body(payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let json: Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(target_text) = json["Response"]["TargetText"].as_str() {
            return Ok(target_text.to_string());
        }
        Err(json["Response"]["Error"]["Message"]
            .as_str()
            .unwrap_or("Unknown Tencent error")
            .to_string())
    }
}
