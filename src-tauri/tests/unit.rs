//! Integration test harness.
//!
//! Declaring an explicit `[[test]]` target makes `cargo:rustc-link-arg-tests`
//! (emitted by `build.rs` to embed the Common Controls v6 manifest) valid for
//! this package. Without it, Cargo rejects the directive and unit-test
//! binaries crash with STATUS_ENTRYPOINT_NOT_FOUND on startup.

#[test]
fn harness_links_with_app_manifest() {
    // The test binary itself must start up (i.e. the manifest embedding
    // worked). Nothing else to assert here.
}
