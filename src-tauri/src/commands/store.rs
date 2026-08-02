//! Store commands, mirroring `src/remote/store.ts`.

use serde_json::{json, Value};
use tauri::State;

use crate::store::Store;

/// Default values matching the original electron-store schema.
/// When a key is missing, these are returned instead of null.
fn default_for_key(key: &str) -> Option<Value> {
    match key {
        "games" => Some(json!([])),
        "localeChangers" => Some(json!([])),
        "translateProviders" => Some(json!({})),
        "ttsProviders" => Some(json!({})),
        "ocrProviders" => Some(json!({})),
        "segmentProviders" => Some(json!({})),
        "dictProviders" => Some(json!({})),
        "ttsManager" => Some(json!({ "defaultProvider": "WebSpeechSynthesisApi" })),
        "segmentManager" => Some(json!({ "defaultProvider": "intl-segmenter" })),
        "dictManager" => Some(json!({ "defaultProvider": "有道词典" })),
        "ocrExtractor" => Some(json!({
            "delay": 500,
            "trigger": {
                "mouse": { "left": true, "wheel": true },
                "keyboard": { "enter": true, "space": true },
                "movement": { "interval": 100, "threshold": 0.005 }
            }
        })),
        "ui" => Some(json!({ "fontSize": 16 })),
        _ => None,
    }
}

#[tauri::command]
pub fn store_get(store: State<'_, Store>, key: String, default: Option<Value>) -> Value {
    crate::log_info!("rpc", "store_get <- {key}");
    let result = store.get(&key, default.clone());
    crate::log_info!("rpc", "store_get -> {}", result);
    if result.is_null() {
        // Fall back to schema defaults for known top-level keys.
        if let Some(default_value) = default_for_key(&key) {
            return default_value;
        }
    }
    result
}

#[tauri::command]
pub fn store_set(store: State<'_, Store>, key: String, value: Value) -> Result<(), String> {
    crate::log_info!("rpc", "store_set <- {key} = {value}");
    let r = store.set(&key, value).map_err(|e| e.to_string());
    crate::log_info!("rpc", "store_set -> {r:?}");
    r
}

#[tauri::command]
pub fn store_has(store: State<'_, Store>, key: String) -> bool {
    crate::log_info!("rpc", "store_has <- {key}");
    let r = store.has(&key);
    crate::log_info!("rpc", "store_has -> {r}");
    r
}

#[tauri::command]
pub fn store_delete(store: State<'_, Store>, key: String) -> Result<(), String> {
    crate::log_info!("rpc", "store_delete <- {key}");
    let r = store.delete(&key).map_err(|e| e.to_string());
    crate::log_info!("rpc", "store_delete -> {r:?}");
    r
}

#[tauri::command]
pub fn store_reset(store: State<'_, Store>, keys: Vec<String>) -> Result<(), String> {
    crate::log_info!("rpc", "store_reset <- {keys:?}");
    let r = store.reset(&keys).map_err(|e| e.to_string());
    crate::log_info!("rpc", "store_reset -> {r:?}");
    r
}

#[tauri::command]
pub fn store_clear(store: State<'_, Store>) -> Result<(), String> {
    crate::log_info!("rpc", "store_clear");
    let r = store.clear().map_err(|e| e.to_string());
    crate::log_info!("rpc", "store_clear -> {r:?}");
    r
}
