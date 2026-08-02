//! Image utilities for OCR providers.

#![allow(dead_code)]

use base64::Engine;

/// Convert a BGRA raw buffer to a base64-encoded PNG string.
pub fn bgra_to_base64_png(data: &[u8], width: u32, height: u32) -> Result<String, String> {
    // Build an RGBA image by swapping B and R channels.
    let mut rgba = vec![0u8; data.len()];
    for (i, chunk) in data.chunks_exact(4).enumerate() {
        let o = i * 4;
        rgba[o] = chunk[2]; // R <- B
        rgba[o + 1] = chunk[1]; // G
        rgba[o + 2] = chunk[0]; // B <- R
        rgba[o + 3] = chunk[3]; // A
    }
    let img = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or_else(|| "invalid image dimensions".to_string())?;
    let mut png_bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&png_bytes))
}
