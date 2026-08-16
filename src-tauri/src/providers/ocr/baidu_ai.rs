//! Baidu AI OCR provider (百度AI开放平台).
//!
//! 1. Get access token via client credentials.
//! 2. POST base64 image to general_basic OCR endpoint.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::image_util::bgra_to_base64_png;
use super::OcrProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct BaiduOcrOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: BaiduOcrApiConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct BaiduOcrApiConfig {
    #[ame(
        readable = "APP ID",
        desc = "可在 https://console.bce.baidu.com/ai/#/ai/ocr/app/list 获取"
    )]
    #[serde(default)]
    pub api_key: Option<String>,
    #[ame(
        readable = "Secret Key",
        desc = "可在 https://console.bce.baidu.com/ai/#/ai/ocr/app/list 获取"
    )]
    #[serde(default)]
    pub secret_key: Option<String>,
    #[ame(desc = "识别语言类型")]
    #[serde(default = "default_lang")]
    pub language: BaiduOcrLanguage,
}

/// Baidu OCR language codes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum BaiduOcrLanguage {
    #[default]
    #[serde(rename = "JAP")]
    Jap,
    #[serde(rename = "CHN_ENG")]
    ChnEng,
    #[serde(rename = "ENG")]
    Eng,
    #[serde(rename = "KOR")]
    Kor,
    #[serde(rename = "FRE")]
    Fre,
    #[serde(rename = "SPA")]
    Spa,
    #[serde(rename = "POR")]
    Por,
    #[serde(rename = "GER")]
    Ger,
    #[serde(rename = "ITA")]
    Ita,
    #[serde(rename = "RUS")]
    Rus,
}

impl BaiduOcrLanguage {
    pub fn as_str(&self) -> &'static str {
        match self {
            BaiduOcrLanguage::ChnEng => "CHN_ENG",
            BaiduOcrLanguage::Eng => "ENG",
            BaiduOcrLanguage::Jap => "JAP",
            BaiduOcrLanguage::Kor => "KOR",
            BaiduOcrLanguage::Fre => "FRE",
            BaiduOcrLanguage::Spa => "SPA",
            BaiduOcrLanguage::Por => "POR",
            BaiduOcrLanguage::Ger => "GER",
            BaiduOcrLanguage::Ita => "ITA",
            BaiduOcrLanguage::Rus => "RUS",
        }
    }
}

fn default_lang() -> BaiduOcrLanguage {
    BaiduOcrLanguage::default()
}

impl Default for BaiduOcrApiConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            secret_key: None,
            language: default_lang(),
        }
    }
}

impl Default for BaiduOcrOptions {
    fn default() -> Self {
        Self {
            enable: true,
            api_config: BaiduOcrApiConfig {
                api_key: None,
                secret_key: None,
                language: default_lang(),
            },
        }
    }
}

pub struct BaiduOcr {
    pub options: BaiduOcrOptions,
    client: reqwest::Client,
    access_token: Option<String>,
}

impl BaiduOcr {
    pub fn new(options: BaiduOcrOptions) -> Self {
        Self {
            options,
            client: reqwest::Client::new(),
            access_token: None,
        }
    }

    async fn get_access_token(&mut self) -> Result<String, String> {
        if let Some(token) = &self.access_token {
            return Ok(token.clone());
        }
        let cfg = &self.options.api_config;
        let api_key = cfg.api_key.clone().unwrap_or_default();
        let secret_key = cfg.secret_key.clone().unwrap_or_default();
        let url = format!(
            "https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={api_key}&client_secret={secret_key}"
        );
        let resp = self
            .client
            .post(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        let token = json["access_token"]
            .as_str()
            .ok_or("no access_token in response")?
            .to_string();
        self.access_token = Some(token.clone());
        Ok(token)
    }
}

impl OcrProvider for BaiduOcr {
    fn id(&self) -> &str {
        "百度AI开放平台"
    }

    fn options_schema() -> Value {
        <BaiduOcrOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(BaiduOcrOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <BaiduOcrOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
            && self.options.api_config.api_key.is_some()
            && self.options.api_config.secret_key.is_some()
    }

    async fn recognize(
        &mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> Result<String, String> {
        let image_b64 = bgra_to_base64_png(&data, width, height)?;
        // token 缓存曾永不过期：跨过有效期（约 30 天）后会一直失败到重启。
        // 现在 token 失效错误（110/111）会作废缓存并换新 token 重试一次。
        let mut retried = false;
        loop {
            let token = self.get_access_token().await?;
            let url = format!(
                "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token={token}"
            );
            let resp = self
                .client
                .post(&url)
                .form(&[
                    ("image", image_b64.as_str()),
                    ("language_type", self.options.api_config.language.as_str()),
                ])
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let json: Value = resp.json().await.map_err(|e| e.to_string())?;
            if let Some(arr) = json["words_result"].as_array() {
                let lines: Vec<&str> = arr.iter().filter_map(|w| w["words"].as_str()).collect();
                return Ok(lines.join("\n"));
            }
            if is_token_error(&json) && !retried {
                retried = true;
                self.access_token = None;
                continue;
            }
            return Err(json["error_msg"]
                .as_str()
                .unwrap_or("Baidu OCR error")
                .to_string());
        }
    }
}

/// 百度 access token 失效错误码：110 = 过期，111 = 非法。
fn is_token_error(json: &Value) -> bool {
    matches!(json["error_code"].as_i64(), Some(110) | Some(111))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_error_codes_are_recognized() {
        // 回归：token 过期(110)/非法(111) 必须触发缓存作废+重试；
        // 其他错误码（如 17=每日限额）不能误触发。
        assert!(is_token_error(&serde_json::json!({ "error_code": 110 })));
        assert!(is_token_error(&serde_json::json!({ "error_code": 111 })));
        assert!(!is_token_error(&serde_json::json!({ "error_code": 17 })));
        assert!(!is_token_error(
            &serde_json::json!({ "error_code": 282131 })
        ));
        assert!(!is_token_error(&serde_json::json!({ "words_result": [] })));
        assert!(!is_token_error(&serde_json::json!({})));
    }
}
