//! Options commands — replaces `src/remote/options.ts`.
//!
//! Serves provider/manager/extractor metadata (JSON Schema) and reads/writes
//! their options in the store.

use serde_json::Value;
use tauri::State;

use crate::schema::{AmeOptions, JsonSchema};
use crate::store::Store;
use serde::Deserialize;

/// Metadata for a single provider, matching the frontend's expected shape.
#[derive(serde::Serialize)]
pub struct ProviderMeta {
    id: String,
    description: String,
    #[serde(rename = "jsonSchema")]
    json_schema: Value,
    #[serde(rename = "optionsDescription")]
    options_description: Value,
    /// Default options, used only to seed the store on first launch.
    #[serde(skip_serializing)]
    default_options: Value,
}

/// Return the list of provider ids for a given category.
#[tauri::command]
pub fn get_providers_ids(r#type: String) -> Vec<String> {
    crate::log_info!("rpc", "get_providers_ids <- {}", r#type);
    provider_registry(&r#type)
        .iter()
        .map(|m| m.id.clone())
        .collect()
}

/// Return metadata (schema + description) for a single provider.
#[tauri::command]
pub fn get_provider_options_meta(r#type: String, provider_id: String) -> Option<ProviderMeta> {
    crate::log_info!(
        "rpc",
        "get_provider_options_meta <- {}/{}",
        r#type,
        provider_id
    );
    provider_registry(&r#type)
        .into_iter()
        .find(|m| m.id == provider_id)
}

/// Read a provider's stored options.
#[tauri::command]
pub fn get_provider_options(store: State<'_, Store>, r#type: String, provider_id: String) -> Value {
    crate::log_info!("rpc", "get_provider_options <- {}/{}", r#type, provider_id);
    store.get(&format!("{}Providers.{provider_id}", r#type), None)
}

/// Write a provider's stored options.
#[tauri::command]
pub fn set_provider_options(
    store: State<'_, Store>,
    r#type: String,
    provider_id: String,
    value: Value,
) -> Result<(), String> {
    crate::log_info!(
        "rpc",
        "set_provider_options <- {}/{} = {}",
        r#type,
        provider_id,
        value
    );
    store
        .set(&format!("{}Providers.{provider_id}", r#type), value)
        .map_err(|e| e.to_string())
}

/// Manager options metadata.
#[tauri::command]
pub fn get_manager_options_meta(r#type: String) -> Value {
    manager_meta(&r#type)
}

#[tauri::command]
pub fn get_manager_options(store: State<'_, Store>, r#type: String) -> Value {
    crate::log_info!("rpc", "get_manager_options <- {}", r#type);
    store.get(&format!("{}Manager", r#type), None)
}

#[tauri::command]
pub fn set_manager_options(
    store: State<'_, Store>,
    r#type: String,
    value: Value,
) -> Result<(), String> {
    crate::log_info!("rpc", "set_manager_options <- {} = {}", r#type, value);
    store
        .set(&format!("{}Manager", r#type), value)
        .map_err(|e| e.to_string())
}

/// Extractor options metadata.
#[tauri::command]
pub fn get_extractor_options_meta(r#type: String) -> Value {
    extractor_meta(&r#type)
}

#[tauri::command]
pub fn get_extractor_options(store: State<'_, Store>, r#type: String) -> Value {
    store.get(&format!("{}Extractor", r#type), None)
}

#[tauri::command]
pub fn set_extractor_options(
    store: State<'_, Store>,
    r#type: String,
    value: Value,
) -> Result<(), String> {
    store
        .set(&format!("{}Extractor", r#type), value)
        .map_err(|e| e.to_string())
}

// ─── Registry helpers ────────────────────────────────────────────────────────

fn provider_registry(r#type: &str) -> Vec<ProviderMeta> {
    match r#type {
        "translate" => vec![
            #[cfg(debug_assertions)]
            echo_meta(),
            openai_meta(),
            anthropic_meta(),
            baidu_meta(),
            tencent_meta(),
            jbeijing_meta(),
            dreye_meta(),
            scraper_meta(crate::providers::translate::web_scraper::ScraperSite::QqFanyi),
            scraper_meta(crate::providers::translate::web_scraper::ScraperSite::YoudaoFanyi),
        ],
        "tts" => vec![tts_meta()],
        "ocr" => vec![ppocr_meta(), baidu_ocr_meta(), tencent_ocr_meta()],
        "segment" => vec![intl_segmenter_meta(), mecab_meta()],
        "dict" => vec![youdao_dict_meta(), hujiang_dict_meta()],
        _ => Vec::new(),
    }
}

#[cfg(debug_assertions)]
fn echo_meta() -> ProviderMeta {
    use crate::providers::translate::echo::Echo;
    use crate::providers::translate::TranslateProvider;
    ProviderMeta {
        id: "echo".into(),
        description: String::new(),
        json_schema: Echo::options_schema(),
        options_description: Echo::options_description(),
        default_options: Echo::default_options(),
    }
}

fn openai_meta() -> ProviderMeta {
    use crate::providers::translate::openai::{OpenAi, OpenAiOptions};
    use crate::providers::translate::TranslateProvider;
    let p = OpenAi::new(OpenAiOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: OpenAi::options_schema(),
        options_description: OpenAi::options_description(),
        default_options: OpenAi::default_options(),
    }
}

fn anthropic_meta() -> ProviderMeta {
    use crate::providers::translate::anthropic::{Anthropic, AnthropicOptions};
    use crate::providers::translate::TranslateProvider;
    let p = Anthropic::new(AnthropicOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: Anthropic::options_schema(),
        options_description: Anthropic::options_description(),
        default_options: Anthropic::default_options(),
    }
}

fn baidu_meta() -> ProviderMeta {
    use crate::providers::translate::baidu_ai::{Baidu, BaiduOptions};
    use crate::providers::translate::TranslateProvider;
    let p = Baidu::new(BaiduOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: Baidu::options_schema(),
        options_description: Baidu::options_description(),
        default_options: Baidu::default_options(),
    }
}

fn tencent_meta() -> ProviderMeta {
    use crate::providers::translate::tencent::{Tencent, TencentOptions};
    use crate::providers::translate::TranslateProvider;
    let p = Tencent::new(TencentOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: Tencent::options_schema(),
        options_description: Tencent::options_description(),
        default_options: Tencent::default_options(),
    }
}

fn jbeijing_meta() -> ProviderMeta {
    use crate::providers::translate::jbeijing::{JBeijing, JBeijingOptions};
    use crate::providers::translate::TranslateProvider;
    let p = JBeijing::new(JBeijingOptions::default(), std::path::PathBuf::new());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: JBeijing::options_schema(),
        options_description: JBeijing::options_description(),
        default_options: JBeijing::default_options(),
    }
}

fn dreye_meta() -> ProviderMeta {
    use crate::providers::translate::dreye::{DrEye, DrEyeOptions};
    use crate::providers::translate::TranslateProvider;
    let p = DrEye::new(DrEyeOptions::default(), std::path::PathBuf::new());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: DrEye::options_schema(),
        options_description: DrEye::options_description(),
        default_options: DrEye::default_options(),
    }
}

fn scraper_meta(site: crate::providers::translate::web_scraper::ScraperSite) -> ProviderMeta {
    use crate::providers::translate::web_scraper::WebScraper;
    use crate::providers::translate::TranslateProvider;
    // A dummy AppHandle is not available here; use a placeholder via id/schema only.
    ProviderMeta {
        id: scraper_id(site).into(),
        description: String::new(),
        json_schema: WebScraper::options_schema(),
        options_description: WebScraper::options_description(),
        default_options: WebScraper::default_options(),
    }
}

fn scraper_id(site: crate::providers::translate::web_scraper::ScraperSite) -> &'static str {
    use crate::providers::translate::web_scraper::ScraperSite::*;
    match site {
        QqFanyi => "腾讯翻译君",
        YoudaoFanyi => "有道翻译",
    }
}

fn tts_meta() -> ProviderMeta {
    use crate::providers::tts::{TtsProvider, WebSpeechSynthesisApi};
    ProviderMeta {
        id: "WebSpeechSynthesisApi".into(),
        description: "浏览器语音合成 (Web Speech Synthesis API)".into(),
        json_schema: WebSpeechSynthesisApi::options_schema(),
        options_description: WebSpeechSynthesisApi::options_description(),
        default_options: WebSpeechSynthesisApi::default_options(),
    }
}

fn ppocr_meta() -> ProviderMeta {
    use crate::providers::ocr::ppocr::PpOcr;
    use crate::providers::ocr::OcrProvider;
    ProviderMeta {
        id: "PP-OCR".into(),
        description: "使用 PP-OCRv5 进行本地光学字符识别".into(),
        json_schema: PpOcr::options_schema(),
        options_description: PpOcr::options_description(),
        default_options: PpOcr::default_options(),
    }
}

fn baidu_ocr_meta() -> ProviderMeta {
    use crate::providers::ocr::baidu_ai::{BaiduOcr, BaiduOcrOptions};
    use crate::providers::ocr::OcrProvider;
    let p = BaiduOcr::new(BaiduOcrOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: BaiduOcr::options_schema(),
        options_description: BaiduOcr::options_description(),
        default_options: BaiduOcr::default_options(),
    }
}

fn tencent_ocr_meta() -> ProviderMeta {
    use crate::providers::ocr::tencent::{TencentOcr, TencentOcrOptions};
    use crate::providers::ocr::OcrProvider;
    let p = TencentOcr::new(TencentOcrOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: TencentOcr::options_schema(),
        options_description: TencentOcr::options_description(),
        default_options: TencentOcr::default_options(),
    }
}

fn intl_segmenter_meta() -> ProviderMeta {
    use crate::providers::segment::{IntlSegmenter, SegmentProvider};
    ProviderMeta {
        id: "intl-segmenter".into(),
        description: "浏览器内置分词 (Intl.Segmenter)".into(),
        json_schema: IntlSegmenter::options_schema(),
        options_description: IntlSegmenter::options_description(),
        default_options: IntlSegmenter::default_options(),
    }
}

fn mecab_meta() -> ProviderMeta {
    use crate::providers::segment::mecab::{Mecab, MecabOptions};
    use crate::providers::segment::SegmentProvider;
    let p = Mecab::new(MecabOptions::default());
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: Mecab::options_schema(),
        options_description: Mecab::options_description(),
        default_options: Mecab::default_options(),
    }
}

fn youdao_dict_meta() -> ProviderMeta {
    use crate::providers::dict::youdao::YoudaoDict;
    use crate::providers::dict::DictProvider;
    let p = YoudaoDict;
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: YoudaoDict::options_schema(),
        options_description: Value::Null,
        default_options: YoudaoDict::default_options(),
    }
}

fn hujiang_dict_meta() -> ProviderMeta {
    use crate::providers::dict::hujiang::HujiangDict;
    use crate::providers::dict::DictProvider;
    let p = HujiangDict;
    ProviderMeta {
        id: p.id().into(),
        description: p.description().into(),
        json_schema: HujiangDict::options_schema(),
        options_description: Value::Null,
        default_options: HujiangDict::default_options(),
    }
}

/// Manager options metadata, mirroring the original per-manager schemas
/// (`src/main/manager/*/options.ts`). Only tts/segment/dict managers have
/// options in the original app.
fn manager_meta(r#type: &str) -> Value {
    let (schema, description): (Value, Value) = match r#type {
        "dict" => (
            <DictManagerOptions as AmeOptions>::schema(),
            <DictManagerOptions as AmeOptions>::description(),
        ),
        "tts" => (
            <TtsManagerOptions as AmeOptions>::schema(),
            <TtsManagerOptions as AmeOptions>::description(),
        ),
        "segment" => (
            <SegmentManagerOptions as AmeOptions>::schema(),
            <SegmentManagerOptions as AmeOptions>::description(),
        ),
        _ => {
            return serde_json::json!({
                "id": null,
                "description": null,
                "jsonSchema": { "type": "object", "properties": {} },
                "optionsDescription": {}
            });
        }
    };
    serde_json::json!({
        "id": null,
        "description": null,
        "jsonSchema": schema,
        "optionsDescription": description
    })
}

/// Extractor options metadata, mirroring `src/main/extractor/OcrExtractor/options.ts`.
fn extractor_meta(r#type: &str) -> Value {
    if r#type != "ocr" {
        return serde_json::json!({
            "id": null,
            "description": null,
            "jsonSchema": { "type": "object", "properties": {} },
            "optionsDescription": {}
        });
    }
    serde_json::json!({
        "id": null,
        "description": null,
        "jsonSchema": <crate::extractor::ocr::OcrExtractorOptions as AmeOptions>::schema(),
        "optionsDescription": <crate::extractor::ocr::OcrExtractorOptions as AmeOptions>::description()
    })
}

/// Seed missing store keys with their defaults, mirroring the old
/// electron-store schema `default` behavior: on first launch the store file is
/// written with default options so pages show real values (e.g. bool selects
/// display their default instead of an empty dropdown). Existing values are
/// never overwritten.
pub fn seed_store_defaults(store: &Store) -> Result<(), String> {
    let static_defaults: &[(&str, serde_json::Value)] = &[
        ("games", serde_json::json!([])),
        ("localeChangers", serde_json::json!([])),
        ("ui", serde_json::json!({ "fontSize": 16 })),
        (
            "ttsManager",
            serde_json::to_value(TtsManagerOptions::default()).unwrap(),
        ),
        (
            "segmentManager",
            serde_json::to_value(SegmentManagerOptions::default()).unwrap(),
        ),
        (
            "dictManager",
            serde_json::to_value(DictManagerOptions::default()).unwrap(),
        ),
        (
            "ocrExtractor",
            serde_json::to_value(crate::extractor::ocr::OcrExtractorOptions::default()).unwrap(),
        ),
    ];
    for (key, value) in static_defaults {
        if !store.has(key) {
            store.set(key, value.clone()).map_err(|e| e.to_string())?;
        }
    }
    for r#type in ["translate", "tts", "ocr", "segment", "dict"] {
        for meta in provider_registry(r#type) {
            let key = format!("{type}Providers.{id}", type = r#type, id = meta.id);
            if meta.default_options.is_object() && !store.has(&key) {
                store
                    .set(&key, meta.default_options)
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

// ─── Manager options (schema + description auto-generated) ──────────────────

#[derive(Debug, Clone, Deserialize, serde::Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
struct DictManagerOptions {
    #[ame(desc = "默认提供程序")]
    #[serde(default)]
    default_provider: DictProviderId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
enum DictProviderId {
    #[default]
    #[serde(rename = "有道词典")]
    Youdao,
    #[serde(rename = "沪江小D")]
    Hujiang,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
struct TtsManagerOptions {
    #[ame(desc = "默认提供程序")]
    #[serde(default)]
    default_provider: TtsProviderId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
enum TtsProviderId {
    #[default]
    #[serde(rename = "WebSpeechSynthesisApi")]
    WebSpeechSynthesisApi,
}

#[derive(Debug, Clone, Deserialize, serde::Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
struct SegmentManagerOptions {
    #[ame(desc = "默认提供程序")]
    #[serde(default)]
    default_provider: SegmentProviderId,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, serde::Serialize, JsonSchema)]
enum SegmentProviderId {
    #[default]
    #[serde(rename = "intl-segmenter")]
    IntlSegmenter,
    #[serde(rename = "mecab")]
    Mecab,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::Store;

    #[test]
    fn seed_store_defaults_writes_missing_keys_and_preserves_existing() {
        let dir = std::env::temp_dir().join(format!("ame-seed-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let store = Store::load_from_dir(dir.clone()).unwrap();

        seed_store_defaults(&store).unwrap();

        // Provider options: OpenAI default has enable=false, model gpt-4.
        let openai = store.get("translateProviders.OpenAI-Compatible API", None);
        assert!(openai.is_object());
        assert_eq!(openai["enable"], serde_json::json!(false));
        assert_eq!(openai["chatConfig"]["model"], serde_json::json!("gpt-4"));
        // Anthropic defaults keep the original layout (nested apiConfig/chatConfig).
        let anthropic = store.get("translateProviders.Anthropic Message API", None);
        assert_eq!(
            anthropic["apiConfig"]["baseURL"],
            serde_json::json!("https://api.anthropic.com")
        );
        assert_eq!(
            anthropic["chatConfig"]["model"],
            serde_json::json!("claude-opus-4-7")
        );
        assert_eq!(
            anthropic["chatConfig"]["maxTokens"],
            serde_json::json!(4096)
        );
        assert_eq!(
            anthropic["chatConfig"]["thinkingType"],
            serde_json::json!("disabled")
        );
        // Tesseract was removed from the OCR registry, so it must not be seeded.
        assert_eq!(
            store.get("ocrProviders.tesseract", None),
            serde_json::Value::Null
        );
        // Managers/extractor/ui/games/localeChangers.
        assert_eq!(
            store.get("ttsManager", None)["defaultProvider"],
            serde_json::json!("WebSpeechSynthesisApi")
        );
        assert_eq!(
            store.get("dictManager", None)["defaultProvider"],
            serde_json::json!("有道词典")
        );
        assert_eq!(
            store.get("ocrExtractor", None)["delay"],
            serde_json::json!(500)
        );
        assert_eq!(store.get("ui", None)["fontSize"], serde_json::json!(16));
        assert_eq!(store.get("games", None), serde_json::json!([]));
        assert_eq!(store.get("localeChangers", None), serde_json::json!([]));
        // Providers without options (echo/dict) are not seeded.
        assert_eq!(
            store.get("translateProviders.echo", None),
            serde_json::Value::Null
        );
        assert_eq!(
            store.get("dictProviders.有道词典", None),
            serde_json::Value::Null
        );

        // Existing values must not be overwritten.
        store
            .set("ui", serde_json::json!({ "fontSize": 20 }))
            .unwrap();
        store
            .set(
                "translateProviders.OpenAI-Compatible API",
                serde_json::json!({ "enable": true }),
            )
            .unwrap();
        seed_store_defaults(&store).unwrap();
        assert_eq!(store.get("ui", None)["fontSize"], serde_json::json!(20));
        assert_eq!(
            store.get("translateProviders.OpenAI-Compatible API", None)["enable"],
            serde_json::json!(true)
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ocr_provider_registry_no_longer_contains_tesseract() {
        let ids: Vec<String> = provider_registry("ocr")
            .iter()
            .map(|m| m.id.clone())
            .collect();
        assert!(ids.iter().any(|id| id == "PP-OCR"));
        assert!(ids.iter().any(|id| id == "百度AI开放平台"));
        assert!(ids.iter().any(|id| id == "腾讯云"));
        assert!(!ids.iter().any(|id| id == "tesseract"));
    }
}
