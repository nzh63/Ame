//! Tencent Cloud OCR provider (腾讯云) — GeneralBasicOCR.
//!
//! POST https://ocr.tencentcloudapi.com  Action=GeneralBasicOCR
//! Signing: TC3-HMAC-SHA256.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::image_util::bgra_to_base64_png;
use super::OcrProvider;
use crate::crypto::tencent_tc3_authorization;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentOcrOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: TencentOcrApiConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentOcrApiConfig {
    #[ame]
    #[serde(default)]
    pub credential: TencentOcrCredential,
    #[ame(desc = "地域")]
    #[serde(default = "default_region")]
    pub region: String,
    #[ame]
    #[serde(default)]
    pub params: TencentOcrParams,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TencentOcrCredential {
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
pub struct TencentOcrParams {
    #[ame(desc = "语言")]
    #[serde(rename = "LanguageType")]
    #[serde(default = "default_lang")]
    pub language_type: TencentOcrLanguage,
}

fn default_region() -> String {
    "ap-guangzhou".into()
}
/// Tencent OCR `LanguageType` codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum TencentOcrLanguage {
    #[default]
    #[serde(rename = "jap")]
    Jap,
    #[serde(rename = "auto")]
    Auto,
    #[serde(rename = "zh")]
    Zh,
    #[serde(rename = "kor")]
    Kor,
    #[serde(rename = "spa")]
    Spa,
    #[serde(rename = "fre")]
    Fre,
    #[serde(rename = "ger")]
    Ger,
    #[serde(rename = "por")]
    Por,
    #[serde(rename = "vie")]
    Vie,
    #[serde(rename = "may")]
    May,
    #[serde(rename = "rus")]
    Rus,
    #[serde(rename = "ita")]
    Ita,
    #[serde(rename = "hol")]
    Hol,
    #[serde(rename = "swe")]
    Swe,
    #[serde(rename = "fin")]
    Fin,
    #[serde(rename = "dan")]
    Dan,
}

fn default_lang() -> TencentOcrLanguage {
    TencentOcrLanguage::default()
}

impl Default for TencentOcrOptions {
    fn default() -> Self {
        Self {
            enable: true,
            api_config: TencentOcrApiConfig {
                credential: TencentOcrCredential::default(),
                region: default_region(),
                params: TencentOcrParams {
                    language_type: default_lang(),
                },
            },
        }
    }
}

impl Default for TencentOcrApiConfig {
    fn default() -> Self {
        Self {
            credential: TencentOcrCredential::default(),
            region: default_region(),
            params: TencentOcrParams {
                language_type: default_lang(),
            },
        }
    }
}

impl Default for TencentOcrParams {
    fn default() -> Self {
        Self {
            language_type: default_lang(),
        }
    }
}

pub struct TencentOcr {
    pub options: TencentOcrOptions,
    client: reqwest::Client,
}

impl TencentOcr {
    pub fn new(options: TencentOcrOptions) -> Self {
        Self {
            options,
            client: reqwest::Client::new(),
        }
    }
}

impl OcrProvider for TencentOcr {
    fn id(&self) -> &str {
        "腾讯云"
    }

    fn options_schema() -> Value {
        <TencentOcrOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(TencentOcrOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <TencentOcrOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
            && self.options.api_config.credential.secret_id.is_some()
            && self.options.api_config.credential.secret_key.is_some()
    }

    async fn recognize(
        &mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> Result<String, String> {
        let cred = &self.options.api_config.credential;
        let secret_id = cred.secret_id.clone().unwrap_or_default();
        let secret_key = cred.secret_key.clone().unwrap_or_default();
        let region = &self.options.api_config.region;

        let service = "ocr";
        let host = "ocr.tencentcloudapi.com";
        let action = "GeneralBasicOCR";
        let version = "2018-11-19";
        let timestamp = chrono::Utc::now().timestamp();

        let image_b64 = bgra_to_base64_png(&data, width, height)?;
        let payload = json!({
            "ImageBase64": image_b64,
            "LanguageType": self.options.api_config.params.language_type,
        })
        .to_string();

        let authorization = tencent_tc3_authorization(
            &secret_id,
            &secret_key,
            service,
            action,
            region,
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

        if let Some(arr) = json["Response"]["TextDetections"].as_array() {
            let lines: Vec<&str> = arr
                .iter()
                .filter_map(|d| d["DetectedText"].as_str())
                .collect();
            return Ok(lines.join(""));
        }
        Err(json["Response"]["Error"]["Message"]
            .as_str()
            .unwrap_or("Tencent OCR error")
            .to_string())
    }
}
