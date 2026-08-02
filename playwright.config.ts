import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: 1,
  // Each worker launches its own Ame instance with an isolated WebView2 user
  // data folder and its own CDP port (see e2e/fixtures.ts). GitHub-hosted
  // Windows runners have 4 vCPUs; more workers oversubscribe them and make
  // app startup exceed the test timeout (observed as add-game fixture
  // timeouts on CI).
  workers: 4,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
