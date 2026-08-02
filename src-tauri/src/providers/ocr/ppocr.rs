//! PP-OCR provider — wraps the C++/ncnn FFI engine.
//!
//! The FFI bindings ([`ffi`]) load `ppocr_ffi.dll` (compiled by
//! `src-tauri/build.rs`, bundling ncnn + opencv) at runtime. The DLL is
//! resolved from the packaged resources, next to the app/test binaries, or
//! from `<cwd>/build/static/native/bin`; if it cannot be found the process
//! panics — PP-OCR is a hard dependency, never a silent feature gap.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::OcrProvider;
use crate::schema::{AmeOptions, JsonSchema};

use ffi::{Detector, Recognizer};

/// First directory searched when loading `ppocr_ffi.dll` (packaged resources).
pub use ffi::init_resource_dir;

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct PpOcrOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame(desc = "模型")]
    #[serde(default = "default_model")]
    pub model: PpOcrModel,
    #[ame(desc = "设备")]
    #[serde(default = "default_device")]
    pub device: PpOcrDevice,
    #[ame(desc = "文本方向")]
    #[serde(default = "default_direction")]
    pub text_direction: PpOcrDirection,
}

/// PP-OCR model preset (maps to bundled ncnn files).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum PpOcrModel {
    #[default]
    #[serde(rename = "server.fp32")]
    Server,
    #[serde(rename = "mobile.fp16")]
    Mobile,
}

/// Inference device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum PpOcrDevice {
    #[default]
    #[serde(rename = "CPU")]
    Cpu,
    #[serde(rename = "GPU (自动)")]
    Gpu,
}

/// Text layout direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum PpOcrDirection {
    #[default]
    #[serde(rename = "横排文本 从左到右")]
    Horizontal,
    #[serde(rename = "竖排文本 从右到左")]
    Vertical,
}

fn default_model() -> PpOcrModel {
    PpOcrModel::default()
}
fn default_device() -> PpOcrDevice {
    PpOcrDevice::default()
}
fn default_direction() -> PpOcrDirection {
    PpOcrDirection::default()
}

impl Default for PpOcrOptions {
    fn default() -> Self {
        Self {
            enable: true,
            model: default_model(),
            device: default_device(),
            text_direction: default_direction(),
        }
    }
}

pub struct PpOcr {
    pub options: PpOcrOptions,
    detector: Option<Detector>,
    recognizer: Option<Recognizer>,
    /// 模型文件路径（det param, det model, rec param, rec model），
    /// 用于模型丢失（如 timeout 丢弃 future）后重建。
    model_paths: Option<(String, String, String, String)>,
}

impl PpOcr {
    pub fn new(options: PpOcrOptions, static_dir: &Path) -> Self {
        // GPU (自动) → first Vulkan device; CPU → software inference.
        let gpu = (options.device == PpOcrDevice::Gpu).then_some(0);
        let paths = model_paths(options.model, static_dir);
        let (det_param, det_model, rec_param, rec_model) = paths.clone();
        let detector = Detector::create(&det_param, &det_model, gpu);
        let recognizer = Recognizer::create(&rec_param, &rec_model, gpu);
        Self {
            options,
            detector,
            recognizer,
            model_paths: Some(paths),
        }
    }
}

/// Resolve the bundled ncnn model files for the selected model preset.
fn model_paths(model: PpOcrModel, static_dir: &Path) -> (String, String, String, String) {
    let (prefix, flavor) = match model {
        PpOcrModel::Mobile => ("PP-OCRv5_mobile", "fp16"),
        PpOcrModel::Server => ("PP-OCRv5_server", "fp32"),
    };
    let base = static_dir.join("ppocr");
    (
        base.join(format!("{prefix}_det.{flavor}.ncnn.param"))
            .to_string_lossy()
            .into_owned(),
        base.join(format!("{prefix}_det.{flavor}.ncnn.bin"))
            .to_string_lossy()
            .into_owned(),
        base.join(format!("{prefix}_rec.{flavor}.ncnn.param"))
            .to_string_lossy()
            .into_owned(),
        base.join(format!("{prefix}_rec.{flavor}.ncnn.bin"))
            .to_string_lossy()
            .into_owned(),
    )
}

impl OcrProvider for PpOcr {
    fn id(&self) -> &str {
        "PP-OCR"
    }

    fn description(&self) -> &str {
        "PaddleOCR (ncnn) 本地离线识别"
    }

    fn options_schema() -> Value {
        <PpOcrOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(PpOcrOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <PpOcrOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable
    }

    async fn recognize(
        &mut self,
        data: Vec<u8>,
        width: u32,
        height: u32,
    ) -> Result<String, String> {
        // 模型可能因 timeout 丢弃 future 而丢失，先确保可用再识别。
        self.ensure_models();
        // PP-OCR 推理是同步 CPU 密集操作（ncnn）。若直接在主 async 线程执行，
        // 会占满 Tauri async runtime 的 worker（事件、翻译、UI 全部卡顿）。
        // 必须放到 blocking 线程池，async 侧只做等待。
        // 用 Option::take 把模型移进 blocking 线程，识别完无条件放回。
        // 注意：调用方（run_ocr_cycle）可能用 timeout 包裹本 future——
        // 一旦 timeout 触发，future 被 drop，spawn_blocking 闭包里的模型
        // 无法回到 self，后续识别会永久失败。因此这里不依赖放回，而是
        // 让 spawn_blocking 在 join 超时后自动重建模型（见下方）。
        let detector = self.detector.take();
        let recognizer = self.recognizer.take();
        let result = tokio::task::spawn_blocking(move || {
            let (mut detector, mut recognizer) = match (detector, recognizer) {
                (Some(d), Some(r)) => (d, r),
                _ => return Err("PP-OCR models not initialized".to_string()),
            };
            let boxes = detector.detect(&data, width, height);
            if boxes.is_empty() {
                return Ok((detector, recognizer, String::new()));
            }
            let texts = recognizer.recognize(&data, width, height, &boxes);
            Ok((detector, recognizer, texts.join("\n")))
        })
        .await
        .map_err(|e| format!("PP-OCR worker failed: {e}"))??;
        // 正常完成：放回模型。若 future 被 timeout 丢弃，这里不会执行，
        // 但下一条路径会重建。
        self.detector = Some(result.0);
        self.recognizer = Some(result.1);
        Ok(result.2)
    }
}

impl PpOcr {
    /// 重建 ncnn 模型（timeout 丢弃 future 导致模型丢失后，下次识别时重建）。
    fn ensure_models(&mut self) {
        if self.detector.is_some() && self.recognizer.is_some() {
            return;
        }
        let Some((det_param, det_model, rec_param, rec_model)) = self.model_paths.clone() else {
            return;
        };
        let gpu = (self.options.device == PpOcrDevice::Gpu).then_some(0);
        self.detector = Detector::create(&det_param, &det_model, gpu);
        self.recognizer = Recognizer::create(&rec_param, &rec_model, gpu);
    }
}

/// FFI bindings to the C++ PP-OCR (ncnn) library.
mod ffi {
    #![allow(non_camel_case_types)]
    #![allow(dead_code)]

    use std::ffi::{c_char, c_int, CStr, CString};
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Path, PathBuf};
    use std::sync::OnceLock;

    use windows::core::{PCSTR, PCWSTR};
    use windows::Win32::Foundation::HMODULE;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct PpOcrBox {
        pub center_x: f32,
        pub center_y: f32,
        pub width: f32,
        pub height: f32,
        pub angle: f32,
    }

    pub enum PpOcrDetector {}
    pub enum PpOcrRecognizer {}

    type DetectorCreate =
        unsafe extern "C" fn(*const c_char, *const c_char, c_int) -> *mut PpOcrDetector;
    type DetectorDetect = unsafe extern "C" fn(
        *mut PpOcrDetector,
        *const u8,
        c_int,
        c_int,
        *mut *mut PpOcrBox,
    ) -> c_int;
    type FreeBoxes = unsafe extern "C" fn(*mut PpOcrBox);
    type DetectorDestroy = unsafe extern "C" fn(*mut PpOcrDetector);
    type RecognizerCreate =
        unsafe extern "C" fn(*const c_char, *const c_char, c_int) -> *mut PpOcrRecognizer;
    type RecognizerRecognize = unsafe extern "C" fn(
        *mut PpOcrRecognizer,
        *const u8,
        c_int,
        c_int,
        *const PpOcrBox,
        c_int,
        *mut *mut *mut c_char,
    ) -> c_int;
    type FreeTexts = unsafe extern "C" fn(*mut *mut c_char, c_int);
    type RecognizerDestroy = unsafe extern "C" fn(*mut PpOcrRecognizer);

    #[derive(Clone, Copy)]
    struct PpOcrFfi {
        detector_create: DetectorCreate,
        detector_detect: DetectorDetect,
        free_boxes: FreeBoxes,
        detector_destroy: DetectorDestroy,
        recognizer_create: RecognizerCreate,
        recognizer_recognize: RecognizerRecognize,
        free_texts: FreeTexts,
        recognizer_destroy: RecognizerDestroy,
    }

    /// First directory searched when loading the DLL (packaged resources).
    pub fn init_resource_dir(dir: &Path) {
        let _ = DLL_DIR.set(dir.to_path_buf());
    }

    static DLL_DIR: OnceLock<PathBuf> = OnceLock::new();
    static FFI: OnceLock<PpOcrFfi> = OnceLock::new();

    fn ffi() -> &'static PpOcrFfi {
        FFI.get_or_init(load)
    }

    fn load() -> PpOcrFfi {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));

        let mut candidates: Vec<PathBuf> = Vec::new();
        for dir in [DLL_DIR.get().cloned(), exe_dir].into_iter().flatten() {
            candidates.push(dir.join("ppocr_ffi.dll"));
            candidates.push(dir.join("static/native/bin/ppocr_ffi.dll"));
        }
        candidates.push(PathBuf::from("build/static/native/bin/ppocr_ffi.dll"));

        let path = candidates.iter().find(|p| p.exists()).unwrap_or_else(|| {
            panic!(
                "ppocr_ffi.dll not found; searched: {}",
                candidates
                    .iter()
                    .map(|p| p.display().to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        });

        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let module: HMODULE = unsafe { LoadLibraryW(PCWSTR(wide.as_ptr())) }
            .unwrap_or_else(|e| panic!("failed to load {}: {e}", path.display()));

        macro_rules! sym {
            ($name:literal, $ty:ty) => {{
                const NAME: &[u8] = concat!($name, "\0").as_bytes();
                let f = unsafe { GetProcAddress(module, PCSTR(NAME.as_ptr())) }
                    .unwrap_or_else(|| panic!("missing symbol {} in ppocr_ffi.dll", $name));
                unsafe { std::mem::transmute::<unsafe extern "system" fn() -> isize, $ty>(f) }
            }};
        }

        PpOcrFfi {
            detector_create: sym!("ppocr_detector_create", DetectorCreate),
            detector_detect: sym!("ppocr_detector_detect", DetectorDetect),
            free_boxes: sym!("ppocr_free_boxes", FreeBoxes),
            detector_destroy: sym!("ppocr_detector_destroy", DetectorDestroy),
            recognizer_create: sym!("ppocr_recognizer_create", RecognizerCreate),
            recognizer_recognize: sym!("ppocr_recognizer_recognize", RecognizerRecognize),
            free_texts: sym!("ppocr_free_texts", FreeTexts),
            recognizer_destroy: sym!("ppocr_recognizer_destroy", RecognizerDestroy),
        }
    }

    /// Safe wrapper around the PP-OCR Detector.
    pub struct Detector {
        ptr: *mut PpOcrDetector,
    }

    // The underlying ncnn::Net is used from a single thread at a time via &mut.
    unsafe impl Send for Detector {}
    unsafe impl Sync for Detector {}

    impl Detector {
        pub fn create(param: &str, model: &str, gpu: Option<i32>) -> Option<Self> {
            let param = CString::new(param).ok()?;
            let model = CString::new(model).ok()?;
            let ptr = unsafe {
                (ffi().detector_create)(param.as_ptr(), model.as_ptr(), gpu.unwrap_or(-1) as c_int)
            };
            if ptr.is_null() {
                None
            } else {
                Some(Self { ptr })
            }
        }

        /// Detect text regions in a BGRA image. Returns rotated rectangles.
        pub fn detect(&mut self, data: &[u8], width: u32, height: u32) -> Vec<PpOcrBox> {
            let mut out: *mut PpOcrBox = std::ptr::null_mut();
            let n = unsafe {
                (ffi().detector_detect)(
                    self.ptr,
                    data.as_ptr(),
                    width as c_int,
                    height as c_int,
                    &mut out,
                )
            };
            if n <= 0 || out.is_null() {
                return Vec::new();
            }
            let boxes = unsafe { std::slice::from_raw_parts(out, n as usize) }.to_vec();
            unsafe { (ffi().free_boxes)(out) };
            boxes
        }
    }

    impl Drop for Detector {
        fn drop(&mut self) {
            unsafe { (ffi().detector_destroy)(self.ptr) };
        }
    }

    /// Safe wrapper around the PP-OCR Recognizer.
    pub struct Recognizer {
        ptr: *mut PpOcrRecognizer,
    }

    unsafe impl Send for Recognizer {}
    unsafe impl Sync for Recognizer {}

    impl Recognizer {
        pub fn create(param: &str, model: &str, gpu: Option<i32>) -> Option<Self> {
            let param = CString::new(param).ok()?;
            let model = CString::new(model).ok()?;
            let ptr = unsafe {
                (ffi().recognizer_create)(
                    param.as_ptr(),
                    model.as_ptr(),
                    gpu.unwrap_or(-1) as c_int,
                )
            };
            if ptr.is_null() {
                None
            } else {
                Some(Self { ptr })
            }
        }

        /// Recognize text in the given boxes of a BGRA image.
        pub fn recognize(
            &mut self,
            data: &[u8],
            width: u32,
            height: u32,
            boxes: &[PpOcrBox],
        ) -> Vec<String> {
            let mut out: *mut *mut c_char = std::ptr::null_mut();
            let n = unsafe {
                (ffi().recognizer_recognize)(
                    self.ptr,
                    data.as_ptr(),
                    width as c_int,
                    height as c_int,
                    boxes.as_ptr(),
                    boxes.len() as c_int,
                    &mut out,
                )
            };
            if n <= 0 || out.is_null() {
                return Vec::new();
            }
            let ptrs = unsafe { std::slice::from_raw_parts(out, n as usize) };
            let texts = ptrs
                .iter()
                .map(|&p| unsafe { CStr::from_ptr(p) }.to_string_lossy().into_owned())
                .collect();
            unsafe { (ffi().free_texts)(out, n) };
            texts
        }
    }

    impl Drop for Recognizer {
        fn drop(&mut self) {
            unsafe { (ffi().recognizer_destroy)(self.ptr) };
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// Loading the DLL must succeed and bad model paths must be handled
        /// gracefully (the C++ wrapper returns nullptr → None). This verifies
        /// the runtime DLL resolution works from the test binary.
        #[test]
        fn dll_loads_and_bad_model_paths_yield_none() {
            let det = Detector::create("/nonexistent.param", "/nonexistent.bin", None);
            assert!(det.is_none());
            let rec = Recognizer::create("/nonexistent.param", "/nonexistent.bin", None);
            assert!(rec.is_none());
        }
    }
}
