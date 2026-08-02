//! OCR extractor — replaces `src/main/extractor/OcrExtractor/`.
//!
//! Captures the game window, optionally crops/preprocesses the image, runs OCR
//! providers, and emits the recognized text. Includes a frame-diff movement
//! detector for automatic capture triggers.

#![allow(dead_code)]

use std::sync::Arc;

use image::{GrayImage, RgbaImage};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::schema::{AmeOptions, JsonSchema};
use crate::win32::screen_capturer;

/// OCR extractor options (stored under `ocrExtractor`).
#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct OcrExtractorOptions {
    #[ame(readable = "截图延时", desc = "单位：ms")]
    #[serde(default = "default_delay")]
    pub delay: u64,
    #[ame]
    #[serde(default)]
    pub trigger: TriggerOptions,
}

fn default_delay() -> u64 {
    500
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct TriggerOptions {
    #[ame]
    #[serde(default)]
    pub mouse: MouseTrigger,
    #[ame]
    #[serde(default)]
    pub keyboard: KeyboardTrigger,
    #[ame]
    #[serde(default)]
    pub movement: MovementTrigger,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct MouseTrigger {
    #[ame(desc = "鼠标左键触发")]
    #[serde(default = "default_true")]
    pub left: bool,
    #[ame(desc = "鼠标滚轮触发")]
    #[serde(default = "default_true")]
    pub wheel: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardTrigger {
    #[ame(desc = "回车键触发")]
    #[serde(default = "default_true")]
    pub enter: bool,
    #[ame(desc = "空格键触发")]
    #[serde(default = "default_true")]
    pub space: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct MovementTrigger {
    #[ame(readable = "移动检测间隔", desc = "单位：ms")]
    #[serde(default = "default_interval")]
    pub interval: u64,
    #[ame(readable = "移动检测阈值", desc = "取值范围: [0, 1]")]
    #[serde(default = "default_threshold")]
    pub threshold: f64,
}

fn default_true() -> bool {
    true
}
fn default_interval() -> u64 {
    // 与旧版 Electron 默认值保持一致（100ms）。
    // 卡顿问题由 movement_detect_loop 的忙跳（上一帧检测未完成时丢弃本次
    // tick）和复用已截帧解决，而不是靠拉长间隔。
    100
}
fn default_threshold() -> f64 {
    0.005
}

impl Default for OcrExtractorOptions {
    fn default() -> Self {
        Self {
            delay: default_delay(),
            trigger: TriggerOptions {
                mouse: MouseTrigger {
                    left: true,
                    wheel: true,
                },
                keyboard: KeyboardTrigger {
                    enter: true,
                    space: true,
                },
                movement: MovementTrigger {
                    interval: default_interval(),
                    threshold: 0.005,
                },
            },
        }
    }
}

impl Default for MouseTrigger {
    fn default() -> Self {
        Self {
            left: true,
            wheel: true,
        }
    }
}
impl Default for KeyboardTrigger {
    fn default() -> Self {
        Self {
            enter: true,
            space: true,
        }
    }
}
impl Default for MovementTrigger {
    fn default() -> Self {
        Self {
            interval: default_interval(),
            threshold: 0.005,
        }
    }
}

/// Image preprocessing options.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreprocessOption {
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default)]
    pub threshold: Option<u8>,
}

fn default_color() -> String {
    "colorful".into()
}

impl Default for PreprocessOption {
    fn default() -> Self {
        Self {
            color: default_color(),
            threshold: None,
        }
    }
}

/// Crop rectangle.
#[derive(Debug, Clone, Copy, Deserialize, Serialize, Default)]
pub struct CropRect {
    pub left: u32,
    pub top: u32,
    pub width: u32,
    pub height: u32,
}

/// Frame-diff movement detector.
pub struct MovementDetector {
    last_image: Arc<Mutex<Option<GrayImage>>>,
    threshold: f64,
}

impl MovementDetector {
    pub fn new(threshold: f64) -> Self {
        Self {
            last_image: Arc::new(Mutex::new(None)),
            threshold,
        }
    }

    /// Compare a new greyscale image against the last; returns true if movement
    /// exceeds the threshold. Stores the *input* image as the new baseline
    /// without cloning it (the caller already owns it).
    pub fn detect(&self, current: GrayImage) -> bool {
        let mut last_guard = self.last_image.lock();
        let moved = match last_guard.as_ref() {
            None => false,
            Some(last) => {
                if last.dimensions() != current.dimensions() {
                    false
                } else {
                    let (w, h) = current.dimensions();
                    let sum: u64 = last
                        .as_raw()
                        .iter()
                        .zip(current.as_raw().iter())
                        .map(|(&a, &b)| (a as i32 - b as i32).unsigned_abs() as u64)
                        .sum();
                    let v = sum as f64 / ((w as f64) * (h as f64) * 255.0);
                    v > self.threshold
                }
            }
        };
        if moved {
            crate::log_info!("ocr", "movement detected");
        }
        // 无论是否移动都把当前帧作为新基线（移动时也更新，与旧版一致）。
        *last_guard = Some(current);
        moved
    }
}

/// Convert a captured BGRA buffer to an RGBA image (swap R/B, vertical flip).
pub fn bgra_to_rgba_flipped(data: &[u8], width: u32, height: u32) -> Option<RgbaImage> {
    let expected = (width as usize)
        .checked_mul(height as usize)?
        .checked_mul(4)?;
    if data.len() < expected {
        return None;
    }
    let mut rgba = vec![0u8; data.len()];
    for row in 0..height as usize {
        // Vertical flip: source row `row` maps to dest row `height-1-row`.
        let dest_row = (height as usize - 1 - row) * width as usize * 4;
        let src_row = row * width as usize * 4;
        for col in 0..width as usize {
            let s = src_row + col * 4;
            let d = dest_row + col * 4;
            rgba[d] = data[s + 2]; // R <- B
            rgba[d + 1] = data[s + 1]; // G
            rgba[d + 2] = data[s]; // B <- R
            rgba[d + 3] = data[s + 3]; // A
        }
    }
    RgbaImage::from_raw(width, height, rgba)
}

/// Crop an image (flip-aware: top is recomputed because captured images are
/// vertically flipped relative to screen coordinates).
pub fn crop_image(img: &RgbaImage, rect: &CropRect) -> RgbaImage {
    let (_, h) = img.dimensions();
    let top = h.saturating_sub(rect.top).saturating_sub(rect.height);
    image::imageops::crop_imm(img, rect.left, top, rect.width, rect.height).to_image()
}

/// Apply preprocessing (color mode + threshold) to an image.
pub fn preprocess(img: &RgbaImage, option: &PreprocessOption) -> GrayImage {
    let gray = match option.color.as_str() {
        "red" => extract_channel(img, 0),
        "green" => extract_channel(img, 1),
        "blue" => extract_channel(img, 2),
        _ => image::imageops::grayscale(img),
    };
    if let Some(threshold) = option.threshold {
        apply_threshold(&gray, threshold)
    } else {
        gray
    }
}

fn extract_channel(img: &RgbaImage, channel: u8) -> GrayImage {
    let (w, h) = img.dimensions();
    let mut out = GrayImage::new(w, h);
    for (x, y, pixel) in img.enumerate_pixels() {
        out.put_pixel(x, y, image::Luma([pixel[channel as usize]]));
    }
    out
}

fn apply_threshold(img: &GrayImage, threshold: u8) -> GrayImage {
    let mut out = img.clone();
    for p in out.pixels_mut() {
        p[0] = if p[0] >= threshold { 255 } else { 0 };
    }
    out
}

/// Decode a PNG buffer, apply preprocessing, and re-encode as PNG.
///
/// Used by the OCR guide's live preview (`get_preprocessed_image`).
pub fn preprocess_png(png_in: &[u8], option: &PreprocessOption) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory(png_in).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let gray = preprocess(&rgba, option);
    let mut out = Vec::new();
    gray.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(out)
}

/// The OCR extractor state.
pub struct OcrExtractor {
    pub hwnd: u64,
    /// 游戏进程 PIDs（用于验证 hwnd 未在窗口销毁后被系统复用）。
    pub game_pids: Vec<u32>,
    pub rect: Option<CropRect>,
    pub preprocess_option: PreprocessOption,
    pub options: OcrExtractorOptions,
    pub movement_detector: Option<Arc<MovementDetector>>,
    /// Per-key last text (Electron `extractor.text[key]`): each OCR provider
    /// deduplicates against its own previous result, not a shared string.
    pub last_text: Arc<Mutex<std::collections::HashMap<String, String>>>,
    /// OCR 向导打开时暂停提取（Electron `extractor.pause()`），避免向导
    /// 调整区域/预处理期间后台还在持续截图识别。
    pub paused: std::sync::atomic::AtomicBool,
    /// 最近一次截图（Electron `lastImage`）：`getLastCapture(force=false)`
    /// 直接复用，避免打开向导时重复截屏。
    pub last_capture: Arc<Mutex<Option<crate::win32::screen_capturer::CapturedImage>>>,
}

impl OcrExtractor {
    pub fn new(game_pids: &[u32], options: OcrExtractorOptions) -> Self {
        let hwnd = screen_capturer::find_window(game_pids);
        let movement_detector = if options.trigger.movement.interval > 0 {
            Some(Arc::new(MovementDetector::new(
                options.trigger.movement.threshold,
            )))
        } else {
            None
        };
        Self {
            hwnd,
            game_pids: game_pids.to_vec(),
            rect: None,
            preprocess_option: PreprocessOption::default(),
            options,
            movement_detector,
            last_text: Arc::new(Mutex::new(std::collections::HashMap::new())),
            paused: std::sync::atomic::AtomicBool::new(false),
            last_capture: Arc::new(Mutex::new(None)),
        }
    }

    /// Electron `getLastCapture(force)`: force=true 重新截图并缓存，
    /// force=false 返回上一次截图（首次调用会截一张）。
    pub fn get_last_capture(
        &self,
        force: bool,
    ) -> Result<crate::win32::screen_capturer::CapturedImage, String> {
        let mut cache = self.last_capture.lock();
        if !force {
            if let Some(img) = cache.as_ref() {
                return Ok(img.clone());
            }
        }
        let img = screen_capturer::capture(self.hwnd)?;
        *cache = Some(img.clone());
        Ok(img)
    }

    /// Capture, crop, preprocess, and return the processed greyscale image.
    pub fn capture_and_process(&self) -> Result<(GrayImage, u32, u32), String> {
        Self::capture_and_process_from(self.hwnd, self.rect, &self.preprocess_option)
    }

    /// Capture, crop, and preprocess using an explicit snapshot of the window
    /// handle / crop rect / preprocess options.
    ///
    /// This is lock-free so the caller can capture without holding the
    /// `OcrExtractor` mutex for the whole screenshot (screenshots of large or
    /// stalled windows can take hundreds of milliseconds; holding the lock
    /// that long blocks the global-mouse/keyboard hook listeners).
    pub fn capture_and_process_from(
        hwnd: u64,
        rect: Option<CropRect>,
        preprocess_option: &PreprocessOption,
    ) -> Result<(GrayImage, u32, u32), String> {
        let img = screen_capturer::capture(hwnd)?;
        let rgba = bgra_to_rgba_flipped(&img.buffer, img.width, img.height)
            .ok_or("failed to build image")?;
        let cropped = match &rect {
            Some(rect) => crop_image(&rgba, rect),
            None => rgba,
        };
        let gray = preprocess(&cropped, preprocess_option);
        let (w, h) = gray.dimensions();
        Ok((gray, w, h))
    }

    /// Run one extraction cycle and emit the result.
    pub fn extract(&self, app: &AppHandle, ocr_text: String) {
        let mut last = self.last_text.lock();
        let key = "ocr".to_string();
        let changed = last.get(&key).map(|l| ocr_text != *l).unwrap_or(true);
        if changed && !ocr_text.trim().is_empty() {
            last.insert(key.clone(), ocr_text.clone());
            let _ = app.emit(
                "original-watch-list-update",
                json!({ "key": "ocr", "text": ocr_text }),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{GrayImage, RgbaImage};

    #[test]
    fn default_options_match_original_defaults() {
        let opts = OcrExtractorOptions::default();
        assert_eq!(opts.delay, 500);
        assert!(opts.trigger.mouse.left);
        assert!(opts.trigger.mouse.wheel);
        assert!(opts.trigger.keyboard.enter);
        assert!(opts.trigger.keyboard.space);
        assert_eq!(opts.trigger.movement.interval, 100);
        assert_eq!(opts.trigger.movement.threshold, 0.005);
    }

    #[test]
    fn bgra_to_rgba_flipped_swaps_channels_and_flips_vertically() {
        // 2x2 BGRA buffer: pixel(0,0)=blue, pixel(1,0)=red, etc.
        // BGRA row 0: [255,0,0,255] [0,0,255,255]
        // BGRA row 1: [0,255,0,255] [255,255,0,255]
        let data = vec![
            255u8, 0, 0, 255, 0, 0, 255, 255, // row 0
            0, 255, 0, 255, 255, 255, 0, 255, // row 1
        ];
        let img = bgra_to_rgba_flipped(&data, 2, 2).unwrap();
        assert_eq!(img.dimensions(), (2, 2));

        // After flipping, source row 1 (bottom) becomes dest row 0 (top).
        let top_left = img.get_pixel(0, 0);
        // Source pixel (0,1) = [0,255,0,255] (BGRA) -> RGBA [0,255,0,255]
        assert_eq!(top_left.0, [0, 255, 0, 255]);
        let top_right = img.get_pixel(1, 0);
        // Source pixel (1,1) = [255,255,0,255] (BGRA) -> RGBA [0,255,255,255]
        assert_eq!(top_right.0, [0, 255, 255, 255]);
        let bottom_left = img.get_pixel(0, 1);
        // Source pixel (0,0) = [255,0,0,255] (BGRA) -> RGBA [0,0,255,255]
        assert_eq!(bottom_left.0, [0, 0, 255, 255]);
        let bottom_right = img.get_pixel(1, 1);
        // Source pixel (1,0) = [0,0,255,255] (BGRA) -> RGBA [255,0,0,255]
        assert_eq!(bottom_right.0, [255, 0, 0, 255]);
    }

    #[test]
    fn bgra_to_rgba_flipped_rejects_short_buffers() {
        assert!(bgra_to_rgba_flipped(&[1, 2, 3], 2, 2).is_none());
    }

    #[test]
    fn crop_image_clamps_out_of_bounds() {
        let img = RgbaImage::from_pixel(100, 80, image::Rgba([255, 0, 0, 255]));
        let cropped = crop_image(
            &img,
            &CropRect {
                left: 50,
                top: 60,
                width: 200,
                height: 200,
            },
        );
        // crop_imm clamps width/height to the image bounds.
        assert_eq!(cropped.dimensions(), (50, 80));
    }

    #[test]
    fn preprocess_grayscale_and_threshold() {
        let mut img = RgbaImage::new(2, 1);
        img.put_pixel(0, 0, image::Rgba([100, 100, 100, 255]));
        img.put_pixel(1, 0, image::Rgba([200, 200, 200, 255]));

        let gray = preprocess(
            &img,
            &PreprocessOption {
                color: "colorful".into(),
                threshold: None,
            },
        );
        assert_eq!(gray.get_pixel(0, 0).0[0], 100);
        assert_eq!(gray.get_pixel(1, 0).0[0], 200);

        let bin = preprocess(
            &img,
            &PreprocessOption {
                color: "colorful".into(),
                threshold: Some(150),
            },
        );
        assert_eq!(bin.get_pixel(0, 0).0[0], 0);
        assert_eq!(bin.get_pixel(1, 0).0[0], 255);
    }

    #[test]
    fn preprocess_extracts_red_channel() {
        let img = RgbaImage::from_pixel(1, 1, image::Rgba([10, 20, 30, 255]));
        let red = preprocess(
            &img,
            &PreprocessOption {
                color: "red".into(),
                threshold: None,
            },
        );
        assert_eq!(red.get_pixel(0, 0).0[0], 10);
        let green = preprocess(
            &img,
            &PreprocessOption {
                color: "green".into(),
                threshold: None,
            },
        );
        assert_eq!(green.get_pixel(0, 0).0[0], 20);
        let blue = preprocess(
            &img,
            &PreprocessOption {
                color: "blue".into(),
                threshold: None,
            },
        );
        assert_eq!(blue.get_pixel(0, 0).0[0], 30);
    }

    #[test]
    fn movement_detector_first_frame_is_baseline() {
        let detector = MovementDetector::new(0.01);
        let img = GrayImage::from_pixel(2, 2, image::Luma([100]));
        assert!(!detector.detect(img));
    }

    #[test]
    fn movement_detector_detects_change_above_threshold() {
        let detector = MovementDetector::new(0.01);
        let img1 = GrayImage::from_pixel(2, 2, image::Luma([100]));
        let img2 = GrayImage::from_pixel(2, 2, image::Luma([0]));
        assert!(!detector.detect(img1));
        // 100/255 per pixel difference = ~39% >> 1% threshold.
        assert!(detector.detect(img2));
    }

    #[test]
    fn movement_detector_ignores_small_change() {
        let detector = MovementDetector::new(0.5);
        let img1 = GrayImage::from_pixel(2, 2, image::Luma([100]));
        let img2 = GrayImage::from_pixel(2, 2, image::Luma([110]));
        assert!(!detector.detect(img1));
        assert!(!detector.detect(img2));
    }

    #[test]
    fn movement_detector_resets_on_size_change() {
        let detector = MovementDetector::new(0.01);
        let img1 = GrayImage::from_pixel(2, 2, image::Luma([100]));
        let img2 = GrayImage::from_pixel(4, 4, image::Luma([0]));
        assert!(!detector.detect(img1));
        assert!(!detector.detect(img2));
    }
}
