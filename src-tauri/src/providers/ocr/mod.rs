//! OCR providers — replaces `src/main/providers/ocr/`.
//!
//! - PP-OCR runs via C++/ncnn FFI (see [`ppocr::ffi`]).
//! - Cloud OCR (Baidu AI, Tencent Cloud) uses reqwest.
//! - Tesseract runs in the frontend Web Worker (WASM).

use serde_json::Value;

/// An OCR provider: turns an image (BGRA) into text.
pub trait OcrProvider: Send + Sync {
    fn id(&self) -> &str;
    fn description(&self) -> &str {
        ""
    }
    fn options_schema() -> Value
    where
        Self: Sized;
    fn default_options() -> Value
    where
        Self: Sized;
    fn options_description() -> Value
    where
        Self: Sized,
    {
        Value::Null
    }
    fn enabled(&self) -> bool {
        true
    }
    /// Recognize text in a BGRA image.
    fn recognize(
        &mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> impl std::future::Future<Output = Result<String, String>> + Send;
}

pub mod baidu_ai;
pub mod image_util;
pub mod ppocr;
pub mod tencent;
