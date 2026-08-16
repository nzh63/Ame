# Build, Test, and Lint Commands Guide

## Project Architecture
- **Backend**: Rust + Tauri 2, in `src-tauri/` (cargo is the core build system)
- **Renderer Process**: Vue 3 + TypeScript, built with Vite (`src/render/`)
- **Native Code**: C++ (JBeijing/DrEye CLIs + PP-OCR FFI) lives in
  `src-tauri/native/` and is built from `src-tauri/build.rs` via CMake
- **Unit Test Framework**: Rust `#[cfg(test)]` (cargo test)
- **E2E Test Framework**: Playwright, driving the Tauri binary over WebView2 CDP
- **Lint**: ESLint + Prettier (frontend), cargo clippy (Rust)

## Build Commands

### Complete Build
```bash
yarn build                   # Build renderer + Rust app (debug)
yarn tauri:build             # Production build + bundling (NSIS installer)
```

### Partial Build
```bash
yarn build:render            # Build renderer process (Vite → build/render)
yarn build:rs                # Build renderer + Rust app
yarn build:e2e               # Build renderer + Rust app for e2e tests
```

### Development Mode
```bash
yarn dev                     # tauri dev (Vite dev server + cargo run, hot reload)
```

### Runtime Dependencies
- `cargo build` automatically downloads Textractor and PP-OCR models into
  `build/static` via `src-tauri/build.rs`; a download or native build failure
  aborts the build (no feature-missing binaries).
- The JBeijing/DrEye CLIs are compiled automatically by `cargo build`
  (`src-tauri/build.rs`) into `build/static/native/bin`.

## Test Commands

### Run Unit Tests
```bash
yarn test                    # Run all Rust unit tests (cargo test, src-tauri)
yarn test:rs                 # Same as `yarn test`
```

**IMPORTANT: Always wrap test runs in a timeout** (e.g. in Git Bash
`timeout 300 cargo test --manifest-path src-tauri/Cargo.toml --lib`) so a
hung or livelocked test cannot spin forever burning CPU.

### Manually Run Specific Unit Tests
```bash
# Run all unit tests in the lib target
cargo test --manifest-path src-tauri/Cargo.toml --lib

# Run tests matching a name pattern
cargo test --manifest-path src-tauri/Cargo.toml --lib store::tests
```

### Run E2E Tests
```bash
# Run all e2e tests (builds for e2e mode automatically)
yarn e2e

# Run specific e2e test file (build first, then run specific test)
yarn build:e2e && yarn playwright test e2e/ocr-options.spec.ts

# Run tests matching a pattern
yarn build:e2e && yarn playwright test -g "should load OCR"
```

### E2E Test Architecture
- E2E tests launch the Tauri binary (`src-tauri/target/debug/ame.exe`) via `spawn` in `e2e/fixtures.ts`
- The main window is created in Rust code (`src-tauri/src/lib.rs`); when `AME_E2E_CDP_PORT` is set it enables the WebView2 DevTools protocol on that port, and `AME_E2E_USER_DATA` isolates the WebView2 data folder
- Each Playwright worker picks a free CDP port and its own user-data folder, so workers run in parallel (`workers: 4` in `playwright.config.ts`)
- Playwright connects via `chromium.connectOverCDP`; tests drive the app DOM through the hidden main window (it is created with `visible: false`, so nothing pops up during test runs)
- Each test worker uses a temporary directory for the Rust store (via `AME_TEST_STORE_CWD` env var) to avoid polluting real user data
- Navigation uses hash-based routing: `window.location.hash = '#/options/...'`

### Provider Integration Tests (opt-in; real network/CLI/WebView)

These mirror the old Electron `test/main/providers/*` suite: they call the
real providers and skip when credentials are missing.

1. Copy the template and fill in credentials:
   ```powershell
   Copy-Item .env.test.template .env.test.local
   ```
2. In-process HTTP/CLI/OCR providers (OpenAI, Anthropic, BaiduAI, Tencent,
   JBeijing, DrEye, PP-OCR, cloud OCR):
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml --lib providers::test
   ```
   Each test prints `[SKIP] ...` when its env vars are absent.
3. Web scrapers (腾讯翻译君/有道翻译) need a real WebView +
   the `scraper` capability, so they are driven through the app binary via
   `AME_PROVIDER_TEST` (see `src-tauri/src/providers/selftest.rs`). Set `TEST_WEB` in
   `.env.test.local`, then:
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml --test web_scraper_selftest
   ```
   This launches `ame.exe` per site, waits for the JSON result file, and
   asserts the translation (needs network access to those sites).

## Lint Commands

### ESLint
```bash
yarn lint                               # Run ESLint with auto-fix
yarn eslint src/render/foo.ts           # Check specific file
```

### Code Formatting
```bash
yarn style                  # Run Prettier to format code
cargo fmt --manifest-path src-tauri/Cargo.toml --check   # Check Rust formatting
```

### Type Checking
```bash
yarn type-check             # Full project type checking
yarn tsc --noEmit           # Check TypeScript files
yarn vue-tsc --noEmit       # Check Vue component
```
There is no way to check a single file with tsc. Always check the whole project.

## Workflows

### Standard Workflow for Test File Changes
1. **Write/Modify Tests** (Rust `#[cfg(test)]` modules in `src-tauri/src/`, or `src-tauri/tests/`)
2. **Build and Run Tests**:
   ```bash
   yarn test
   ```

### Standard Workflow for E2E Test Changes
1. **Write/Modify E2E Tests** (in `e2e/` directory, e.g., `e2e/ocr-options.spec.ts`)
2. **Build and Run**:
   ```bash
   yarn build:e2e && yarn playwright test e2e/ocr-options.spec.ts
   ```

### Standard Workflow for Source Code Changes
1. **Modify source code**
2. **Type Check**: `cargo check --manifest-path src-tauri/Cargo.toml` (Rust)
3. **Lint Check**: `cargo clippy --manifest-path src-tauri/Cargo.toml`
4. **Build and Test**: `yarn build:rs && yarn test`

### Standard Workflow for Vue Component Changes
1. **Modify Vue component**
2. **Build Renderer Process**: `yarn build:render`
3. **Run Full Tests**: `yarn test`

## Build System Features

### Incremental Build
- Hot reload supported in development mode
- Native modules rebuilt only when necessary
- Runtime dependencies (Textractor, PP-OCR models) downloaded by `build.rs`

### Platform Support
- Windows x64 (Tauri 2 + WebView2)
- Windows-specific features implemented in `src-tauri/src/win32/`
- Bundling via Tauri (NSIS installer)

### Test Environment
- Unit tests run with `cargo test` (Rust `#[cfg(test)]` modules)
- E2E tests run via Playwright against the real Tauri binary over WebView2 CDP

## Important Notes

1. **First Run**: Just run `cargo build` — Textractor/PP-OCR assets are
   downloaded automatically by the build script
2. **Native Modules**: After modifying C++ code, rebuild with `cargo build`
   (`src-tauri/build.rs` re-runs the CMake build automatically)
