//! Opt-in provider integration tests, mirroring the old Electron mocha suite
//! (`test/main/providers/*.spec.ts`).
//!
//! Copy `.env.test.template` to `.env.test.local` and fill in credentials;
//! each test prints `[SKIP]` and returns when its env vars are missing. Run:
//!
//! ```text
//! cargo test --manifest-path src-tauri/Cargo.toml --lib providers::test
//! ```
//!
//! Web scrapers need a live Tauri WebView + capabilities, so they are tested
//! separately through the real app binary (see `tests/web_scraper_selftest.rs`,
//! gated on `TEST_WEB`).

use std::path::PathBuf;
use std::sync::OnceLock;

use crate::providers::ocr::OcrProvider;
use crate::providers::translate::TranslateProvider;

/// Load `.env` / `.env.test` / `.env.test.local` from both the manifest dir
/// and the repo root (old dotenv behavior; existing env vars win).
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

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

fn skip(reason: &str) {
    crate::log_info!("test", "[SKIP] {reason}");
}

fn block_on<F: std::future::Future>(fut: F) -> F::Output {
    tauri::async_runtime::block_on(fut)
}

/// Repo-root `build/static` (JBeijing/DrEye CLIs, PP-OCR models).
fn static_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("build/static")
}

/// Loose check that the translation of こんにちは。 came back as Chinese.
fn assert_translated(provider: &str, text: &str) {
    assert!(
        !text.trim().is_empty()
            && (text.contains("好")
                || text.contains("你")
                || text.contains("您")
                || text.contains("再见")),
        "{provider} returned unexpected result: {text:?}"
    );
}

/// Embedded OCR fixture (rendered with MS Gothic):
/// 私はガラスを食べられます それは私を傷つけません.
const OCR_TEST_PNG_B64: &str = concat!(
    "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",
    "nnP/Xutv+z3WQjJWO9uu7LAQCEtKoTa+vXicd10bz+Dr8vU5velwv8Bcmstp67Hme6rp82qLixUAKHrxQPinXGTsCRIVXiQQ",
    "PtZaIDyjupsRNW1XbbshECZPtArrNn9OPcv8PMZ1zKqnAQDgDoYJhFnXsFYoduElbAqEP+9zbgAAvLyxAyEAAMDABEIAAIBB",
    "CYQAAACDEggBAAAGJRACAAAMSiAEAAAYlEAIAAAwKIEQAABgUAIhAADAoARCAACAQQmEAAAAgxIIAQAABiUQAgAADEogBAAA",
    "GJRACAAAMCiBEAAAYFACIQAAwKAEQgAAgEEJhAAAAIMSCAEAAAYlEAIAAAxKIAQAABiUQAgAADAogRAAAGBQAiEAAMCgBEIA",
    "AIBBCYQAAACDEggBAAAGJRACAAAMSiAEAAAYlEAIAAAwKIEQAABgUAIhAADAoARCAACAQQmEAAAAgxIIAQAABiUQAgAADEog",
    "BAAAGJRACAAAMCiBEAAAYFACIQAAwKAEQgAAgEEJhAAAAIMSCAEAAAYlEAIAAAxKIAQAABiUQAgAADAogRAAAGBQAiEAAMCg",
    "BEIAAIBBCYQAAACDEggBAAAGJRACAAAMSiAEAAAYlEAIAAAwKIEQAABgUAIhAADAoARCAACAQQmEAAAAgxIIAQAABiUQAgAA",
    "DEogBAAAGJRACAAAMCiBEAAAYFACIQAAwKAEQgAAgEEJhAAAAIMSCAEAAAYlEAIAAAxKIAQAABiUQAgAADAogRAAAGBQAiEA",
    "AMCgBEIAAIBBCYQAAACDEggBAAAGJRACAAAMSiAEAAAYlEAIAAAwKIEQAABgUAIhAADAoARCAACAQQmEAAAAgxIIAQAABiUQ",
    "AgAADEogBAAAGJRACAAAMCiBEAAAYFACIQAAwKAEQgAAgEEJhAAAAIMSCAEAAAb1P1yjG52tofv/AAAAAElFTkSuQmCC",
);
fn ocr_test_image() -> (Vec<u8>, u32, u32) {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(OCR_TEST_PNG_B64)
        .expect("embedded OCR fixture must be valid base64");
    let rgba = image::load_from_memory(&bytes)
        .expect("embedded OCR fixture must be a valid PNG")
        .to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut bgra = Vec::with_capacity((w as usize) * (h as usize) * 4);
    for p in rgba.pixels() {
        bgra.push(p[2]);
        bgra.push(p[1]);
        bgra.push(p[0]);
        bgra.push(p[3]);
    }
    (bgra, w, h)
}

#[test]
fn openai_compatible_translate() {
    load_dotenv();
    let Some(api_key) = env("TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY") else {
        skip("TEST_PROVIDERS_TRANSLATE_OPENAI_API_KEY not set");
        return;
    };
    use crate::providers::translate::openai::{
        OpenAi, OpenAiApiConfig, OpenAiChatConfig, OpenAiOptions, OpenAiReasoningEffort,
    };
    let options = OpenAiOptions {
        enable: true,
        api_config: OpenAiApiConfig {
            base_url: env("TEST_PROVIDERS_TRANSLATE_OPENAI_BASEURL")
                .unwrap_or_else(|| "https://api.openai.com/v1".into()),
            api_key,
            organization: env("TEST_PROVIDERS_TRANSLATE_OPENAI_ORGANIZATION").unwrap_or_default(),
        },
        chat_config: OpenAiChatConfig {
            model: env("TEST_PROVIDERS_TRANSLATE_OPENAI_MODEL")
                .unwrap_or_else(|| "deepseek-v4-flash".into()),
            max_history: 10,
            system_prompt: "请将用户输入的日文翻译为中文".into(),
            reasoning_effort: OpenAiReasoningEffort::None,
        },
    };
    let provider = OpenAi::new(options);
    let text =
        block_on(provider.translate("こんにちは。".into())).expect("openai translate failed");
    assert_translated("OpenAI", &text);
}

#[test]
fn anthropic_translate() {
    load_dotenv();
    let api_key = env("TEST_PROVIDERS_TRANSLATE_ANTHROPIC_API_KEY");
    let auth_token = env("TEST_PROVIDERS_TRANSLATE_ANTHROPIC_AUTH_TOKEN");
    if api_key.is_none() && auth_token.is_none() {
        skip("TEST_PROVIDERS_TRANSLATE_ANTHROPIC_API_KEY / AUTH_TOKEN not set");
        return;
    }
    use crate::providers::translate::anthropic::{
        Anthropic, AnthropicApiConfig, AnthropicChatConfig, AnthropicOptions,
        AnthropicOutputEffort, AnthropicThinkingType,
    };
    let options = AnthropicOptions {
        enable: true,
        api_config: AnthropicApiConfig {
            base_url: env("TEST_PROVIDERS_TRANSLATE_ANTHROPIC_BASEURL")
                .unwrap_or_else(|| "https://api.anthropic.com".into()),
            api_key: api_key.unwrap_or_default(),
            auth_token: auth_token.unwrap_or_default(),
        },
        chat_config: AnthropicChatConfig {
            model: env("TEST_PROVIDERS_TRANSLATE_ANTHROPIC_MODEL")
                .unwrap_or_else(|| "deepseek-v4-flash".into()),
            max_history: 10,
            max_tokens: 1024,
            system_prompt: "请将用户输入的日文翻译为中文".into(),
            thinking_type: AnthropicThinkingType::Disabled,
            thinking_budget_tokens: 1024,
            output_effort: AnthropicOutputEffort::Low,
            cache_control: false,
        },
    };
    let provider = Anthropic::new(options);
    let text =
        block_on(provider.translate("こんにちは。".into())).expect("anthropic translate failed");
    assert_translated("Anthropic", &text);
}

#[test]
fn baidu_ai_translate() {
    load_dotenv();
    let Some(appid) = env("TEST_PROVIDERS_TRANSLATE_BAIDUAI_APPID") else {
        skip("TEST_PROVIDERS_TRANSLATE_BAIDUAI_APPID not set");
        return;
    };
    let Some(key) = env("TEST_PROVIDERS_TRANSLATE_BAIDUAI_KEY") else {
        skip("TEST_PROVIDERS_TRANSLATE_BAIDUAI_KEY not set");
        return;
    };
    use crate::providers::translate::baidu_ai::{Baidu, BaiduApiConfig, BaiduOptions};
    let options = BaiduOptions {
        enable: true,
        api_config: BaiduApiConfig {
            appid: Some(appid),
            key: Some(key),
            from_language: "jp".into(),
            to_language: "zh".into(),
        },
    };
    let provider = Baidu::new(options);
    let text = block_on(provider.translate("こんにちは。".into())).expect("baidu translate failed");
    assert_translated("BaiduAI", &text);
}

#[test]
fn tencent_cloud_translate() {
    load_dotenv();
    let Some(secret_id) = env("TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID") else {
        skip("TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_ID not set");
        return;
    };
    let Some(secret_key) = env("TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY") else {
        skip("TEST_PROVIDERS_TRANSLATE_TENCENT_CLOUD_SECRET_KEY not set");
        return;
    };
    use crate::providers::translate::tencent::{
        Tencent, TencentApiConfig, TencentCredential, TencentLang, TencentOptions, TencentParams,
    };
    let options = TencentOptions {
        enable: true,
        api_config: TencentApiConfig {
            credential: TencentCredential {
                secret_id: Some(secret_id),
                secret_key: Some(secret_key),
            },
            region: "ap-guangzhou".into(),
            params: TencentParams {
                source: TencentLang::Ja,
                target: TencentLang::Zh,
                project_id: 0,
            },
        },
    };
    let provider = Tencent::new(options);
    let text =
        block_on(provider.translate("こんにちは。".into())).expect("tencent translate failed");
    assert_translated("Tencent", &text);
}

#[test]
fn baidu_ai_ocr_recognize() {
    load_dotenv();
    let Some(api_key) = env("TEST_PROVIDERS_OCR_BAIDUAI_API_KEY") else {
        skip("TEST_PROVIDERS_OCR_BAIDUAI_API_KEY not set");
        return;
    };
    let Some(secret_key) = env("TEST_PROVIDERS_OCR_BAIDUAI_SECRET_KEY") else {
        skip("TEST_PROVIDERS_OCR_BAIDUAI_SECRET_KEY not set");
        return;
    };
    use crate::providers::ocr::baidu_ai::{
        BaiduOcr, BaiduOcrApiConfig, BaiduOcrLanguage, BaiduOcrOptions,
    };
    let options = BaiduOcrOptions {
        enable: true,
        api_config: BaiduOcrApiConfig {
            api_key: Some(api_key),
            secret_key: Some(secret_key),
            language: BaiduOcrLanguage::Jap,
        },
    };
    let mut provider = BaiduOcr::new(options);
    let (image, w, h) = ocr_test_image();
    let text = block_on(provider.recognize(image, w, h)).expect("baidu ocr failed");
    assert!(!text.trim().is_empty(), "Baidu OCR returned empty result");
}

#[test]
fn tencent_cloud_ocr_recognize() {
    load_dotenv();
    let Some(secret_id) = env("TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_ID") else {
        skip("TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_ID not set");
        return;
    };
    let Some(secret_key) = env("TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_KEY") else {
        skip("TEST_PROVIDERS_OCR_TENCENT_CLOUD_SECRET_KEY not set");
        return;
    };
    use crate::providers::ocr::tencent::{
        TencentOcr, TencentOcrApiConfig, TencentOcrCredential, TencentOcrLanguage,
        TencentOcrOptions, TencentOcrParams,
    };
    let options = TencentOcrOptions {
        enable: true,
        api_config: TencentOcrApiConfig {
            credential: TencentOcrCredential {
                secret_id: Some(secret_id),
                secret_key: Some(secret_key),
            },
            region: "ap-guangzhou".into(),
            params: TencentOcrParams {
                language_type: TencentOcrLanguage::Jap,
            },
        },
    };
    let mut provider = TencentOcr::new(options);
    let (image, w, h) = ocr_test_image();
    let text = block_on(provider.recognize(image, w, h)).expect("tencent ocr failed");
    assert!(!text.trim().is_empty(), "Tencent OCR returned empty result");
}

#[test]
fn jbeijing_translate() {
    load_dotenv();
    let Some(dll) = env("TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL") else {
        skip("TEST_PROVIDERS_TRANSLATE_JBEIJING_DLL not set");
        return;
    };
    use crate::providers::translate::jbeijing::{JBeijing, JBeijingOptions, JBeijingPath};
    let options = JBeijingOptions {
        enable: true,
        path: JBeijingPath {
            dll: Some(dll),
            user_dicts: Vec::new(),
        },
    };
    let provider = JBeijing::new(options, static_dir());
    let text =
        block_on(provider.translate("こんにちは。".into())).expect("jbeijing translate failed");
    assert_translated("JBeijing", &text);
}

#[test]
fn dreye_translate() {
    load_dotenv();
    let Some(dll) = env("TEST_PROVIDERS_TRANSLATE_DREYE_DLL_TRANS_COM") else {
        skip("TEST_PROVIDERS_TRANSLATE_DREYE_DLL_TRANS_COM not set");
        return;
    };
    use crate::providers::translate::dreye::{DrEye, DrEyeOptions, DrEyePath, TranslateDirection};
    let options = DrEyeOptions {
        enable: true,
        path: DrEyePath {
            dll_trans_com: Some(dll),
            dll_trans_com_ec: None,
        },
        translate_type: TranslateDirection::JapaneseToChinese,
    };
    let provider = DrEye::new(options, static_dir());
    let text = block_on(provider.translate("こんにちは。".into())).expect("dreye translate failed");
    assert_translated("DrEye", &text);
}

#[test]
fn ppocr_recognize_local() {
    load_dotenv();
    use crate::providers::ocr::ppocr::{
        PpOcr, PpOcrDevice, PpOcrDirection, PpOcrModel, PpOcrOptions,
    };

    let static_dir = static_dir();
    let models_exist = [
        "ppocr/PP-OCRv5_server_det.fp32.ncnn.param",
        "ppocr/PP-OCRv5_server_det.fp32.ncnn.bin",
        "ppocr/PP-OCRv5_server_rec.fp32.ncnn.param",
        "ppocr/PP-OCRv5_server_rec.fp32.ncnn.bin",
    ]
    .iter()
    .all(|f| static_dir.join(f).exists());
    if !models_exist {
        skip("PP-OCR models not found under build/static/ppocr");
        return;
    }

    let options = PpOcrOptions {
        enable: true,
        model: PpOcrModel::Server,
        device: PpOcrDevice::Cpu,
        text_direction: PpOcrDirection::Horizontal,
    };
    let mut provider = PpOcr::new(options, &static_dir);
    let (image, w, h) = ocr_test_image();
    let text = block_on(provider.recognize(image, w, h)).expect("pp-ocr failed");
    assert!(!text.trim().is_empty(), "PP-OCR returned empty result");
}
