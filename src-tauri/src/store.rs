//! Persistent JSON store, replacing `electron-store`.
//!
//! Data is stored as a nested JSON object keyed by dot-separated paths
//! (e.g. `translateProviders.openai`), mirroring the original store layout.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex as StdMutex};
use std::thread::JoinHandle;

use parking_lot::RwLock;
use serde_json::Value;
use tauri::{Manager, Runtime};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

/// Thread-safe, file-backed JSON store.
#[derive(Clone)]
pub struct Store {
    path: PathBuf,
    data: Arc<RwLock<Value>>,
    /// 后台落盘器：文件 IO 由单一后台线程串行执行，绝不阻塞调用线程
    /// （tokio worker / IPC 线程 / 防抖线程）。
    disk: Arc<DiskWriter>,
}

/// 后台落盘：写请求只保留最新一份快照，由单线程原子写入磁盘。
///
/// `submit` 在调用线程只做内存更新 + 覆盖待写内容（微秒级），真正
/// 的 `fs::write` + `rename` 在后台线程执行，因此快速连续保存不会让
/// 调用线程等待文件 IO。
struct DiskWriter {
    path: PathBuf,
    /// 最新待写内容（`None` = 无待写任务）。
    pending: StdMutex<Option<String>>,
    /// 写线程是否正在写盘（`flush` 需要等它结束）。
    busy: AtomicBool,
    stopped: AtomicBool,
    cond: Condvar,
    thread: StdMutex<Option<JoinHandle<()>>>,
}

impl DiskWriter {
    fn new(path: PathBuf) -> Self {
        Self {
            path,
            pending: StdMutex::new(None),
            busy: AtomicBool::new(false),
            stopped: AtomicBool::new(false),
            cond: Condvar::new(),
            thread: StdMutex::new(None),
        }
    }

    /// 提交一份最新快照（覆盖任何尚未写盘的旧快照）。
    fn submit(self: &Arc<Self>, raw: String) {
        {
            let mut pending = self.pending.lock().unwrap();
            *pending = Some(raw);
        }
        // 必须 notify_all：condvar 上有两个等待者（写线程 + flush）。用
        // notify_one 时可能唤醒的是 flush——它看到 pending=Some 继续睡，
        // 而真正该干活的写线程仍带着待写快照沉睡，直到下一次提交才可能
        // 被唤醒（高频提交场景表现为写盘长时间停摆的活锁）。
        self.cond.notify_all();
        self.spawn_if_needed();
    }

    /// 同步等待所有已提交的落盘完成（退出前 / 测试用）。
    fn flush(&self) {
        let mut pending = self.pending.lock().unwrap();
        while pending.is_some() || self.busy.load(Ordering::SeqCst) {
            pending = self.cond.wait(pending).unwrap();
        }
    }

    /// 惰性启动写线程（第一次提交时）。
    fn spawn_if_needed(self: &Arc<Self>) {
        let mut thread = self.thread.lock().unwrap();
        if thread.is_some() {
            return;
        }
        let this = self.clone();
        *thread = Some(std::thread::spawn(move || this.run_loop()));
    }

    fn run_loop(self: Arc<Self>) {
        loop {
            let raw = {
                let mut pending = self.pending.lock().unwrap();
                while pending.is_none() && !self.stopped.load(Ordering::SeqCst) {
                    pending = self.cond.wait(pending).unwrap();
                }
                let raw = pending.take();
                // busy 必须与 take() 同临界区置位：否则 flush() 恰好在两者
                // 之间拿锁时会看到 pending=None && busy=false 而提前返回，
                // 退出前的最后一次保存被随后的 app.exit() 丢掉。
                if raw.is_some() {
                    self.busy.store(true, Ordering::SeqCst);
                }
                raw
            };
            let Some(raw) = raw else { break };
            // 先写临时文件再 rename，崩溃/断电不会截断正式文件。
            let tmp = self.path.with_extension("json.tmp");
            if let Err(err) = std::fs::write(&tmp, &raw) {
                crate::log_info!("store", "persist write failed: {err}");
            } else if let Err(err) = std::fs::rename(&tmp, &self.path) {
                let _ = std::fs::remove_file(&tmp);
                crate::log_info!("store", "persist rename failed: {err}");
            }
            self.busy.store(false, Ordering::SeqCst);
            self.cond.notify_all();
        }
    }
}

impl Store {
    /// Load the store from the app config directory, creating it if missing.
    pub fn load<R: Runtime, M: Manager<R>>(manager: M) -> Result<Self, StoreError> {
        #[cfg(debug_assertions)]
        if let Ok(test_dir) = std::env::var("AME_TEST_STORE_CWD") {
            // E2E/unit-test isolation: mirror the old `electron-store` test hook.
            return Self::load_from_dir(std::path::PathBuf::from(test_dir));
        }
        let dir = manager
            .path()
            .app_config_dir()
            .map_err(|e| StoreError::Io(std::io::Error::other(e.to_string())))?;
        // First launch after the Electron → Tauri rewrite: carry over the old
        // electron-store data so games/provider settings are not lost.
        migrate_legacy_electron_store(&dir);
        Self::load_from_dir(dir)
    }

    /// Load the store from an explicit directory (used by tests).
    pub fn load_from_dir(dir: PathBuf) -> Result<Self, StoreError> {
        std::fs::create_dir_all(&dir)?;

        let path = dir.join("config.json");
        let data = if path.exists() {
            let raw = std::fs::read_to_string(&path)?;
            match serde_json::from_str(&raw) {
                Ok(value) => value,
                Err(err) => {
                    // Never silently reset user data: keep a recoverable backup
                    // of the unparsable file instead of discarding it.
                    let backup = dir.join(format!(
                        "config.json.corrupt-{}",
                        chrono::Utc::now().format("%Y%m%d-%H%M%S")
                    ));
                    let _ = std::fs::rename(&path, &backup);
                    crate::log_info!(
                        "store",
                        "failed to parse {} ({err}); moved to {}",
                        path.display(),
                        backup.display()
                    );
                    Value::Object(Default::default())
                }
            }
        } else {
            Value::Object(Default::default())
        };

        let disk = Arc::new(DiskWriter::new(path.clone()));
        Ok(Self {
            path,
            data: Arc::new(RwLock::new(data)),
            disk,
        })
    }

    /// Get a value at a dot-separated `key`, falling back to `default`.
    pub fn get(&self, key: &str, default: Option<Value>) -> Value {
        let data = self.data.read();
        get_path(&data, key)
            .cloned()
            .or(default)
            .unwrap_or(Value::Null)
    }

    /// Set a value at a dot-separated `key`, creating intermediate objects.
    pub fn set(&self, key: &str, value: Value) -> Result<(), StoreError> {
        {
            let mut data = self.data.write();
            set_path(&mut data, key, value);
        }
        self.schedule_persist()
    }

    pub fn has(&self, key: &str) -> bool {
        let data = self.data.read();
        get_path(&data, key).is_some()
    }

    pub fn delete(&self, key: &str) -> Result<(), StoreError> {
        {
            let mut data = self.data.write();
            delete_path(&mut data, key);
        }
        self.schedule_persist()
    }

    /// Reset the given keys back to `undefined` (removes them).
    pub fn reset(&self, keys: &[String]) -> Result<(), StoreError> {
        {
            let mut data = self.data.write();
            for key in keys {
                delete_path(&mut data, key);
            }
        }
        self.schedule_persist()
    }

    pub fn clear(&self) -> Result<(), StoreError> {
        {
            let mut data = self.data.write();
            *data = Value::Object(Default::default());
        }
        self.schedule_persist()
    }

    /// 序列化（调用线程，内存操作）并提交后台落盘。
    fn schedule_persist(&self) -> Result<(), StoreError> {
        let data = self.data.read();
        let raw = serde_json::to_string_pretty(&*data)?;
        drop(data);
        // 写盘失败只记日志（磁盘满/权限等极罕见场景）；内存态已更新，
        // 下一次保存会带着最新内容重试。
        self.disk.submit(raw);
        Ok(())
    }

    /// 同步等待所有已提交的落盘完成（退出前调用，避免丢失最后几次保存）。
    pub fn flush(&self) {
        self.disk.flush();
    }
}

/// Copy the old Electron (electron-store) config into the new Tauri config
/// directory on first launch, so existing games/provider settings survive the
/// Electron → Tauri rewrite.
fn migrate_legacy_electron_store(new_dir: &Path) {
    if let Some(config_dir) = dirs::config_dir() {
        migrate_legacy_store(&config_dir, new_dir);
    }
}

/// Locate the old electron-store file.
///
/// Electron's `app.getPath('userData')` defaults to
/// `<config_dir>/<app name>`; the old package.json had `name: "ame"` (no
/// productName), so the file lives at `<config_dir>/ame/config.json`.
fn migrate_legacy_store(config_dir: &Path, new_dir: &Path) {
    let new_path = new_dir.join("config.json");
    if new_path.exists() {
        return;
    }
    let Some(legacy) = legacy_electron_store_path_in(config_dir) else {
        return;
    };
    // Only migrate a legacy file that actually parses as JSON, so a corrupt
    // old config cannot be copied over and then silently reset.
    let ok = std::fs::read_to_string(&legacy)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .is_some();
    if !ok {
        return;
    }
    let _ = std::fs::create_dir_all(new_dir);
    let _ = std::fs::copy(&legacy, &new_path);
}

fn legacy_electron_store_path_in(config_dir: &Path) -> Option<PathBuf> {
    for name in ["ame", "Ame"] {
        let candidate = config_dir.join(name).join("config.json");
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn split_key(key: &str) -> Vec<&str> {
    key.split('.').collect()
}

fn get_path<'a>(mut node: &'a Value, key: &str) -> Option<&'a Value> {
    for part in split_key(key) {
        node = node.get(part)?;
    }
    Some(node)
}

fn set_path(root: &mut Value, key: &str, value: Value) {
    let parts = split_key(key);
    let mut node = root;
    for part in &parts[..parts.len() - 1] {
        if !node.get(part).is_some_and(Value::is_object) {
            node[*part] = Value::Object(Default::default());
        }
        node = node.get_mut(part).unwrap();
    }
    if let Some(last) = parts.last() {
        node[*last] = value;
    }
}

fn delete_path(root: &mut Value, key: &str) {
    let parts = split_key(key);
    let mut node = root;
    for part in &parts[..parts.len() - 1] {
        match node.get_mut(part) {
            Some(next) => node = next,
            None => return,
        }
    }
    if let Some(last) = parts.last() {
        if let Some(obj) = node.as_object_mut() {
            obj.remove(*last);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_store() -> (Store, PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "ame-store-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let store = Store::load_from_dir(dir.clone()).unwrap();
        (store, dir)
    }

    #[test]
    fn get_missing_returns_default() {
        let (store, dir) = temp_store();
        assert_eq!(store.get("missing.key", None), Value::Null);
        assert_eq!(store.get("missing.key", Some(json!(42))), json!(42));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn set_and_get_nested_paths() {
        let (store, dir) = temp_store();
        store
            .set("translateProviders.openai.enable", json!(true))
            .unwrap();
        store
            .set("translateProviders.openai.model", json!("gpt-4"))
            .unwrap();

        assert_eq!(
            store.get("translateProviders.openai.enable", None),
            json!(true)
        );
        assert_eq!(
            store.get("translateProviders.openai.model", None),
            json!("gpt-4")
        );
        assert!(store.has("translateProviders.openai.model"));
        assert!(!store.has("translateProviders.openai.apiKey"));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn set_replaces_non_object_nodes() {
        let (store, dir) = temp_store();
        store.set("a.b", json!(1)).unwrap();
        // Overwriting `a` with a scalar must replace the whole subtree.
        store.set("a", json!("scalar")).unwrap();
        assert_eq!(store.get("a", None), json!("scalar"));
        assert!(!store.has("a.b"));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_and_reset() {
        let (store, dir) = temp_store();
        store.set("a.b.c", json!(1)).unwrap();
        store.set("x.y", json!(2)).unwrap();
        store.delete("a.b.c").unwrap();
        assert!(!store.has("a.b.c"));
        assert!(store.has("a.b"));

        store.reset(&["a".to_string(), "x".to_string()]).unwrap();
        assert!(!store.has("a"));
        assert!(!store.has("x"));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn delete_missing_key_is_noop() {
        let (store, dir) = temp_store();
        store.delete("nope.nope").unwrap();
        store.delete("").unwrap();
        assert_eq!(store.get("nope", None), Value::Null);
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn clear_empties_store() {
        let (store, dir) = temp_store();
        store.set("a", json!(1)).unwrap();
        store.clear().unwrap();
        assert!(!store.has("a"));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn persists_across_reload() {
        let (store, dir) = temp_store();
        store
            .set("games", json!([{ "uuid": "abc", "name": "test" }]))
            .unwrap();
        store.flush();
        drop(store);

        let reloaded = Store::load_from_dir(dir.clone()).unwrap();
        // Dot paths address object keys; array elements are accessed by
        // retrieving the whole value (matching how the app uses `games`).
        let games = reloaded.get("games", None);
        assert_eq!(games[0]["name"], json!("test"));
        assert_eq!(games[0]["uuid"], json!("abc"));
        drop(reloaded);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn set_path_edge_cases() {
        let mut root = Value::Object(Default::default());
        // Empty key maps to a literal "" property (split_key("") == [""]).
        set_path(&mut root, "", json!(1));
        assert_eq!(root[""], json!(1));

        // Single-part key.
        set_path(&mut root, "foo", json!("bar"));
        assert_eq!(root["foo"], json!("bar"));

        // Deep nesting.
        set_path(&mut root, "a.b.c.d", json!(true));
        assert_eq!(root["a"]["b"]["c"]["d"], json!(true));
    }

    #[test]
    fn store_creates_config_json_on_write() {
        let (store, dir) = temp_store();
        store.set("key", json!("value")).unwrap();
        store.flush();
        assert!(dir.join("config.json").exists());
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn rapid_sets_land_latest_value_after_flush() {
        let (store, dir) = temp_store();
        // 不等待中间落盘，快速连续写；后台线程只保留最新快照。
        for i in 0..50 {
            store.set("counter", json!(i)).unwrap();
        }
        store.flush();
        let raw = std::fs::read_to_string(dir.join("config.json")).unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["counter"], json!(49));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn concurrent_flush_waits_for_inflight_write() {
        // 回归：flush() 与后台写线程并发时，绝不允许在"已 take 快照但
        // 还没写盘"的窗口里提前返回——旧实现在该窗口看到
        // pending=None && busy=false 就直接返回，最后一次保存会被
        // 退出路径的 app.exit() 丢掉。
        let (store, dir) = temp_store();
        // 先由主线程提交一次，保证写线程一定启动、文件一定会生成
        // （否则 hammer 线程若未被调度测试就退化成空转）。
        store.set("v", json!(0)).unwrap();
        let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let stop_writer = stop.clone();
        let writer_store = store.clone();
        let writer = std::thread::spawn(move || {
            let mut i = 1u64;
            while !stop_writer.load(Ordering::SeqCst) {
                writer_store.set("v", json!(i)).unwrap();
                i += 1;
                // 毫秒级 sleep：制造与写盘/flush 的真实交错，同时给 flush
                // 留出抓取 pending 空窗的机会（更短的热循环会饿死 flush，
                // 把测试变成活锁）。
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        });
        // 并发 flush：每次 flush 返回时，此刻已提交的值必须在盘上。
        for _ in 0..30 {
            store.flush();
        }
        stop.store(true, Ordering::SeqCst);
        writer.join().unwrap();
        // 退出路径：最后一次提交 + flush 后，盘上必须包含该值。
        store.set("v", json!("final")).unwrap();
        store.flush();
        let raw = std::fs::read_to_string(dir.join("config.json")).unwrap();
        let value: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["v"], json!("final"));
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn corrupt_config_is_backed_up_not_silently_lost() {
        let dir = std::env::temp_dir().join(format!(
            "ame-store-corrupt-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("config.json"), "{ not valid json").unwrap();

        let store = Store::load_from_dir(dir.clone()).unwrap();
        assert_eq!(store.get("anything", None), Value::Null);
        // The corrupt file must be preserved (renamed) for recovery.
        let backups = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("config.json.corrupt-")
            })
            .count();
        assert_eq!(backups, 1);
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn persist_leaves_no_temp_file() {
        let (store, dir) = temp_store();
        for i in 0..5 {
            let key = format!("key.{i}");
            store.set(&key, json!(i)).unwrap();
        }
        store.flush();
        assert!(
            !dir.join("config.json.tmp").exists(),
            "temp file left behind after persist"
        );
        drop(store);
        let _ = std::fs::remove_dir_all(dir);
    }

    fn migration_fixture(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ame-store-migration-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn migrates_legacy_electron_config_on_first_launch() {
        let base = migration_fixture("copy");
        let legacy_dir = base.join("ame");
        std::fs::create_dir_all(&legacy_dir).unwrap();
        std::fs::write(
            legacy_dir.join("config.json"),
            r#"{ "games": [{ "uuid": "abc", "name": "test" }], "ui": { "fontSize": 20 } }"#,
        )
        .unwrap();

        let new_dir = base.join("new");
        migrate_legacy_store(&base, &new_dir);

        let migrated = Store::load_from_dir(new_dir).unwrap();
        assert_eq!(migrated.get("games", None)[0]["uuid"], json!("abc"));
        assert_eq!(migrated.get("ui", None)["fontSize"], json!(20));
        let _ = std::fs::remove_dir_all(base);
    }

    #[test]
    fn migration_does_not_overwrite_existing_new_config() {
        let base = migration_fixture("keep");
        let legacy_dir = base.join("Ame");
        std::fs::create_dir_all(&legacy_dir).unwrap();
        std::fs::write(legacy_dir.join("config.json"), r#"{ "old": true }"#).unwrap();

        let new_dir = base.join("new");
        std::fs::create_dir_all(&new_dir).unwrap();
        std::fs::write(new_dir.join("config.json"), r#"{ "new": true }"#).unwrap();

        migrate_legacy_store(&base, &new_dir);

        let migrated = Store::load_from_dir(new_dir).unwrap();
        assert_eq!(migrated.get("new", None), json!(true));
        assert_eq!(migrated.get("old", None), Value::Null);
        let _ = std::fs::remove_dir_all(base);
    }

    #[test]
    fn migration_ignores_corrupt_legacy_config() {
        let base = migration_fixture("corrupt");
        let legacy_dir = base.join("ame");
        std::fs::create_dir_all(&legacy_dir).unwrap();
        std::fs::write(legacy_dir.join("config.json"), "{ not json").unwrap();

        let new_dir = base.join("new");
        migrate_legacy_store(&base, &new_dir);

        assert!(!new_dir.join("config.json").exists());
        let _ = std::fs::remove_dir_all(base);
    }
}
