//! Baidu Translate API provider (百度AI开放平台).
//!
//! GET https://fanyi-api.baidu.com/api/trans/vip/translate
//! Signing: MD5(appid + text + salt + key) as lowercase hex.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::TranslateProvider;
use crate::crypto::md5_hex;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct BaiduOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame]
    #[serde(default)]
    pub api_config: BaiduApiConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct BaiduApiConfig {
    #[ame(
        readable = "APP ID",
        desc = "可在 https://fanyi-api.baidu.com/api/trans/product/desktop?req=developer 获取"
    )]
    #[serde(default)]
    pub appid: Option<String>,
    #[ame(
        readable = "Key",
        desc = "可在 https://fanyi-api.baidu.com/api/trans/product/desktop?req=developer 获取"
    )]
    #[serde(default)]
    pub key: Option<String>,
    #[ame(desc = "源语言")]
    #[serde(default = "default_from")]
    pub from_language: String,
    #[ame(desc = "目标语言")]
    #[serde(default = "default_to")]
    pub to_language: String,
}

fn default_from() -> String {
    "jp".into()
}
fn default_to() -> String {
    "zh".into()
}

impl Default for BaiduApiConfig {
    fn default() -> Self {
        Self {
            appid: None,
            key: None,
            from_language: default_from(),
            to_language: default_to(),
        }
    }
}

impl Default for BaiduOptions {
    fn default() -> Self {
        Self {
            enable: true,
            api_config: BaiduApiConfig {
                appid: None,
                key: None,
                from_language: default_from(),
                to_language: default_to(),
            },
        }
    }
}

pub struct Baidu {
    pub options: BaiduOptions,
    client: reqwest::Client,
}

impl Baidu {
    pub fn new(options: BaiduOptions) -> Self {
        Self {
            options,
            client: reqwest::Client::new(),
        }
    }
}

impl TranslateProvider for Baidu {
    fn id(&self) -> &str {
        "百度AI开放平台"
    }

    fn options_schema() -> Value {
        <BaiduOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(BaiduOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <BaiduOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
            && self.options.api_config.appid.is_some()
            && self.options.api_config.key.is_some()
    }

    async fn translate(&self, text: String) -> Result<String, String> {
        let cfg = &self.options.api_config;
        let appid = cfg.appid.clone().unwrap_or_default();
        let key = cfg.key.clone().unwrap_or_default();
        let salt = chrono::Utc::now().timestamp_millis().to_string();
        let sign = md5_hex(&format!("{appid}{text}{salt}{key}"));

        let resp = self
            .client
            .get("https://fanyi-api.baidu.com/api/trans/vip/translate")
            .header("connection", "keep-alive")
            .query(&[
                ("q", text.as_str()),
                ("appid", appid.as_str()),
                ("salt", salt.as_str()),
                ("from", cfg.from_language.as_str()),
                ("to", cfg.to_language.as_str()),
                ("sign", sign.as_str()),
            ])
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let json: Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(arr) = json["trans_result"].as_array() {
            let result: Vec<&str> = arr.iter().filter_map(|i| i["dst"].as_str()).collect();
            if !result.is_empty() {
                return Ok(result.join("\n"));
            }
        }
        Err(json["error_msg"]
            .as_str()
            .unwrap_or("Unknown Baidu error")
            .to_string())
    }
}
