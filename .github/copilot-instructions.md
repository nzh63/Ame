# Build, Test, and Lint Commands Guide

## Project Architecture
- **Main Process**: TypeScript + Electron, built with Rollup
- **Renderer Process**: Vue 3 + TypeScript, built with Vite
- **Native Modules**: C++, built with CMake
- **Unit Test Framework**: Mocha + Chai
- **E2E Test Framework**: Playwright + Electron
- **Lint**: ESLint + Prettier

## Build Commands

### Complete Build
```bash
yarn build                   # Build all (production)
yarn build:dir               # Build all without packaging
```

### Partial Build
```bash
yarn build:js                # Build JS files (main + workers + render)
yarn build:main              # Build main process
yarn build:e2e               # Build for e2e tests (main in e2e preset, workers + render in production)
yarn build:render            # Build renderer process
yarn build:workers           # Build workers
yarn build:native            # Build native modules
yarn build:test              # Build test files
```

### Development Mode
```bash
yarn dev                     # Start development mode (hot reload)
```

### Dependency Management
```bash
yarn download:dep            # Download external dependencies (Textractor, OCR models, etc.)
```

## Test Commands

### Run Unit Tests
```bash
yarn test                    # Build tests and run all unit tests
```

### Manually Run Specific Unit Tests
```bash
# 1. Build test files
yarn build:test

# 2. Run specific test file
yarn electron-mocha --colors --require source-map-support/register ./build/test/foo.spec.js

# 3. Run specific test suite
yarn electron-mocha --colors --require source-map-support/register ./build/test --grep "foo"
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
- E2E tests use Playwright's Electron support (`_electron.launch`) to start the app
- Windows are moved off-screen (`setPosition(-32000, -32000)`) via monkey-patching `BrowserWindow.prototype.show` in `e2e/fixtures.ts` so they don't pop up during test runs
- Each test uses a temporary directory for `electron-store` (via `AME_TEST_STORE_CWD` env var) to avoid polluting real user data
- Navigation uses hash-based routing: `window.location.hash = '#/options/...'`
- The `build:e2e` command uses the `e2e` preset, which sets `import.meta.env.TEMP_STORE = true` (for temp storage) and `import.meta.env.RESOURCE_MODE = 'unpacked'` (local file loading), allowing e2e-specific behavior without affecting production builds

## Lint Commands

### ESLint
```bash
yarn lint                               # Run ESLint with auto-fix
yarn eslint test/main/foo.spec.ts       # Check specific file
```

### Code Formatting
```bash
yarn style                  # Run Prettier to format code
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
1. **Write/Modify Tests** (e.g., `test/main/foo/bar.spec.ts`)
2. **Type Check**: `yarn tsc --noEmit`
3. **Lint Check**: `yarn eslint test/main/foo/bar.spec.ts`
4. **Build and Run Tests**:
   ```bash
   yarn build:test && yarn electron-mocha --colors --require source-map-support/register ./build/test/bar.spec.js
   ```

### Standard Workflow for E2E Test Changes
1. **Write/Modify E2E Tests** (in `e2e/` directory, e.g., `e2e/ocr-options.spec.ts`)
2. **Type Check**: `yarn tsc --noEmit`
3. **Build and Run**:
   ```bash
   yarn build:e2e && yarn playwright test e2e/ocr-options.spec.ts
   ```

### Standard Workflow for Source Code Changes
1. **Modify source code**
2. **Type Check**: `yarn tsc --noEmit` (TypeScript) / `yarn vue-tsc --noEmit` (Vue components)
3. **Lint Check**: `yarn lint`
4. **Build and Test**: `yarn test`

### Standard Workflow for Vue Component Changes
1. **Modify Vue component**
2. **Build Renderer Process**: `yarn build:render`
3. **Run Full Tests**: `yarn test`

## Build System Features

### Incremental Build
- Hot reload supported in development mode
- Native modules rebuilt only when necessary
- Dependencies automatically detected and downloaded

### Platform Support
- Multi-architecture support (x64, ia32)
- Windows-specific features (ScreenCapturer, WindowEventHook, etc.)
- Electron cross-platform packaging

### Test Environment
- Unit tests run in Electron environment using electron-mocha
- E2E tests run via Playwright with real Electron app launch
- Source-map debugging supported
- Chai assertion library + Chai-as-promised for async testing

## Important Notes

1. **First Run**: Need to run `yarn download:dep` to download dependencies first
2. **Native Modules**: After modifying C++ code, need to rebuild with `yarn build:native`
