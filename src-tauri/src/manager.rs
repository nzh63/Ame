//! Manager — replaces `src/main/manager/BaseManager.ts`.
//!
//! Manages a collection of providers of a given type, watching the store
//! for configuration changes and refreshing providers accordingly.

use crate::provider::Provider;

/// Manages the lifecycle of a set of providers.
pub struct Manager<P: Provider> {
    providers: Vec<P>,
}

impl<P: Provider> Manager<P> {
    /// Create a new manager with the given provider instances.
    pub fn new(providers: Vec<P>) -> Self {
        let mut mgr = Self { providers };
        for p in mgr.providers.iter_mut() {
            p.init();
        }
        mgr
    }

    /// Get all active providers.
    pub fn providers(&self) -> &[P] {
        &self.providers
    }

    /// Get a mutable reference to a provider by id.
    pub fn get_mut(&mut self, id: &str) -> Option<&mut P> {
        self.providers.iter_mut().find(|p| p.id() == id)
    }

    /// Get a reference to a provider by id.
    pub fn get(&self, id: &str) -> Option<&P> {
        self.providers.iter().find(|p| p.id() == id)
    }

    /// Destroy all providers.
    pub fn destroy_all(&mut self) {
        for p in self.providers.iter_mut() {
            p.destroy();
        }
        self.providers.clear();
    }

    /// Replace all providers with new instances.
    pub fn refresh(&mut self, new_providers: Vec<P>) {
        self.destroy_all();
        self.providers = new_providers;
        for p in self.providers.iter_mut() {
            p.init();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[derive(Debug)]
    struct MockProvider {
        id: String,
        init_count: Arc<AtomicU32>,
        destroy_count: Arc<AtomicU32>,
    }

    impl MockProvider {
        fn new(id: &str) -> Self {
            Self {
                id: id.to_string(),
                init_count: Arc::new(AtomicU32::new(0)),
                destroy_count: Arc::new(AtomicU32::new(0)),
            }
        }
    }

    fn init_count(p: &MockProvider) -> u32 {
        p.init_count.load(Ordering::Relaxed)
    }

    fn destroy_count(p: &MockProvider) -> u32 {
        p.destroy_count.load(Ordering::Relaxed)
    }

    impl Provider for MockProvider {
        fn id(&self) -> &str {
            &self.id
        }

        fn options_schema(&self) -> Value {
            json!({})
        }

        fn default_options(&self) -> Value {
            json!({})
        }

        fn init(&mut self) {
            self.init_count.fetch_add(1, Ordering::Relaxed);
        }

        fn destroy(&mut self) {
            self.destroy_count.fetch_add(1, Ordering::Relaxed);
        }
    }

    #[test]
    fn new_initializes_all_providers() {
        let providers = vec![
            MockProvider::new("a"),
            MockProvider::new("b"),
            MockProvider::new("c"),
        ];
        let counters: Vec<_> = providers
            .iter()
            .map(|p| (p.init_count.clone(), p.destroy_count.clone()))
            .collect();
        let mut mgr = Manager::new(providers);
        assert_eq!(mgr.providers().len(), 3);
        assert!(mgr.providers().iter().all(|p| init_count(p) == 1));

        mgr.destroy_all();
        assert!(mgr.providers().is_empty());
        for (init, destroy) in &counters {
            assert_eq!(init.load(Ordering::Relaxed), 1);
            assert_eq!(destroy.load(Ordering::Relaxed), 1);
        }
    }

    #[test]
    fn get_and_get_mut_by_id() {
        let mut mgr = Manager::new(vec![
            MockProvider::new("translate.openai"),
            MockProvider::new("translate.baidu"),
        ]);

        assert_eq!(mgr.get("translate.openai").unwrap().id, "translate.openai");
        assert!(mgr.get("missing").is_none());

        let p = mgr.get_mut("translate.baidu").unwrap();
        p.init_count.fetch_add(98, Ordering::Relaxed);
        assert_eq!(init_count(mgr.get("translate.baidu").unwrap()), 99);
    }

    #[test]
    fn refresh_destroys_old_and_initializes_new() {
        let old = MockProvider::new("old");
        let old_destroy = old.destroy_count.clone();
        let mut mgr = Manager::new(vec![old]);
        let old_id = mgr.providers()[0].id.clone();

        mgr.refresh(vec![MockProvider::new("new1"), MockProvider::new("new2")]);

        assert_eq!(mgr.providers().len(), 2);
        assert!(mgr.get(&old_id).is_none());
        assert!(mgr.providers().iter().all(|p| init_count(p) == 1));
        assert!(mgr.providers().iter().all(|p| destroy_count(p) == 0));
        assert_eq!(old_destroy.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn destroy_all_calls_destroy_once_per_provider() {
        let a = MockProvider::new("a");
        let b = MockProvider::new("b");
        let a_destroy = a.destroy_count.clone();
        let b_destroy = b.destroy_count.clone();
        let mut mgr = Manager::new(vec![a, b]);
        mgr.destroy_all();
        assert!(mgr.providers().is_empty());
        assert_eq!(a_destroy.load(Ordering::Relaxed), 1);
        assert_eq!(b_destroy.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn manager_is_empty_when_created_with_no_providers() {
        let mgr: Manager<MockProvider> = Manager::new(vec![]);
        assert!(mgr.providers().is_empty());
        assert!(mgr.get("anything").is_none());
    }
}
