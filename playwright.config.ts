import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
