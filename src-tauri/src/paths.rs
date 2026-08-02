//! Runtime path helpers — resolves bundled resources (Textractor, OCR models).

use tauri::{AppHandle, Manager};

/// Resolve the directory containing bundled static resources.
///
/// In dev this is `<project>/build/static`; in a packaged app it is the
/// Tauri resource directory (`resources/static`).
pub fn static_dir(app: &AppHandle) -> std::path::PathBuf {
    // Prefer the bundled resource location when packaged. Tauri flattens
    // glob resources (basename only), so only accept the nested layout the
    // runtime expects (textractor/{x64,x86}, ppocr, native/bin); otherwise
    // fall back to the source-tree layout used during development.
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("static");
        if bundled.join("textractor/x64/TextractorCLI.exe").exists() {
            return bundled;
        }
    }
    // Fall back to the source tree layout used during development.
    std::env::current_dir()
        .map(|cwd| cwd.join("build/static"))
        .unwrap_or_else(|_| std::path::PathBuf::from("build/static"))
}
