import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { execFile, spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { chromium, type Browser } from 'playwright';

/** Absolute path of the Tauri debug binary used by e2e tests. */
export function ameBinaryPath(): string {
  return path.join(process.cwd(), 'src-tauri', 'target', 'debug', 'ame.exe');
}

/** Reserve a free TCP port for this worker's WebView2 CDP endpoint. */
function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Wait until the WebView2 CDP endpoint is accepting connections. */
async function waitForCdp(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => {
      setTimeout(r, 250);
    });
  }
  throw new Error(`Timed out waiting for WebView2 CDP endpoint on port ${port}`);
}

/** Find the app page among the CDP browser's targets. */
function findAppPage(browser: Browser): Page {
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      if (page.url().includes('tauri.localhost')) return page;
    }
  }
  const pages = browser.contexts().flatMap((c) => c.pages());
  if (pages.length > 0) return pages[0];
  throw new Error('No WebView2 page target found via CDP');
}

export const PROVIDER_IDS = {
  translate: ['OpenAI-Compatible API', '腾讯云', '百度AI开放平台', '腾讯翻译君', '有道翻译', 'JBeijing', 'DrEye'],
  ocr: ['PP-OCR', '腾讯云', '百度AI开放平台'],
  segment: ['intl-segmenter', 'mecab'],
  tts: ['WebSpeechSynthesisApi'],
  dict: ['有道词典', '沪江小D'],
} as const;

export type ProviderType = keyof typeof PROVIDER_IDS;

/** Create a temporary directory for the persistent store */
export function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ame-e2e-'));
  return dir;
}

/** Remove a temporary directory */
export function removeTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Poll until `pid` no longer exists or `timeoutMs` elapses. */
async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0); // throws if the process is gone
    } catch {
      return;
    }
    await new Promise((r) => {
      setTimeout(r, 250);
    });
  }
}

/**
 * Remove a directory, retrying briefly to ride out Windows file locks.
 * WebView2 child processes can outlive the killed app process by a moment
 * and still hold the user-data dir open; a plain rmSync then throws EBUSY.
 */
async function removeDirWithRetry(dir: string, retries: number): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      if (attempt >= retries) return; // temp dir; the OS reclaims it eventually
      await new Promise((r) => {
        setTimeout(r, 400);
      });
    }
  }
}

/** Build the provider option page route with URL-encoded providerId */
export function providerRoute(type: ProviderType, providerId: string): string {
  return `/options/${type}-provider/${encodeURIComponent(providerId)}`;
}

/**
 * Wait until the Vue app has mounted and the router is ready.
 * The side menu (.t-menu) is rendered by the root layout once Vue is up.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator('.t-menu').waitFor({ state: 'visible', timeout: 30_000 });
}

/**
 * Navigate to a hash route within the Electron app.
 *
 * Uses a full page reload to guarantee a completely fresh Vue app mount.
 * This eliminates ALL shared-state issues between tests in the same worker:
 *  - stale component state (Vue reuses Options.vue across routes)
 *  - unsaved-changes route guards blocking navigation
 *  - leftover notifications / messages in the DOM
 *
 * The hash is set synchronously before reload, so the app boots directly into
 * the target route. This is still far cheaper than the original per-test
 * Electron process launch (~1s reload vs ~5s process start).
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  // Force a guaranteed full document reload onto the target route.
  //
  // Two subtleties make the naive approaches flaky in Electron:
  //  - evaluate(hash) + reload(): reload() can fire before the hash is
  //    committed, loading the PREVIOUS route (wrong content).
  //  - goto(base + '#route'): a hash-only change does not reload the document,
  //    so Vue stays mounted with stale component state.
  //
  // Navigating to about:blank first unloads the app entirely; the subsequent
  // goto() to the full target URL then performs a real load with the hash
  // committed as part of the navigation. This yields a fresh Vue mount on the
  // correct route every time.
  const base = page.url().split('#')[0];
  await page.goto('about:blank');
  await page.goto(base + '#' + route, { waitUntil: 'domcontentloaded' });

  // Wait for the Vue app to mount (side menu is in the root layout).
  await waitForAppReady(page);

  // Route components are lazy-loaded via dynamic import(); wait for the target
  // route's actual content to render so tests don't race the async load.
  await page
    .locator('#main-content .t-form__item, #main-content .title, .drag-area, .t-steps')
    .first()
    .or(page.getByText('没有可以调整的选项哦'))
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {
      // Some routes (e.g. dev-only) may not match any marker; tests assert specifics.
    });
}

/** Wait for hash-based navigation to complete (e.g. after clicking "放弃") */
export async function waitForHashNavigation(page: Page, pattern = /^#\/(|dashboard)$/): Promise<void> {
  await page.waitForFunction(
    (p: string) => new RegExp(p).test(decodeURIComponent(window.location.hash)),
    pattern.source,
    {
      timeout: 0,
    },
  );
}

/** Click a t-select and wait for dropdown options to appear */
export async function openSelect(page: Page, select: Locator): Promise<Locator> {
  await select.click();
  const options = page.locator('.t-select-option');
  await options.first().waitFor({ state: 'visible', timeout: 3000 });
  return options;
}

/** Wait for TDesign skeleton loader to disappear (page content loaded) */
export async function waitForContent(page: Page): Promise<void> {
  await page.waitForSelector('.t-skeleton', { state: 'hidden', timeout: 15_000 }).catch(() => {
    // Skeleton might not be present, which is fine
  });
}

/** Click a TDesign button by its text content */
export async function clickButton(page: Page, text: string): Promise<void> {
  await page.locator(`button.t-button:has-text("${text}")`).first().click();
}

/** Get TDesign message plugin notification */
export async function waitForMessage(page: Page, expectedText?: string, timeout = 5000): Promise<void> {
  const msg = page.locator('.t-message');
  await msg.waitFor({ state: 'visible', timeout });
  if (expectedText) {
    await expect(msg).toContainText(expectedText);
  }
}

interface E2EFixtures {
  browser: Browser;
  page: Page;
  tempDir: string;
}

export const test = base.extend<{}, E2EFixtures>({
  // Worker-scoped: one temp dir per worker, shared across all tests in that worker
  tempDir: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const dir = createTempDir();
      await use(dir);
      removeTempDir(dir);
    },
    { scope: 'worker' },
  ],
  // Worker-scoped: one Tauri app process per worker instead of per test.
  // The main window is created hidden (visible: false) so nothing pops up
  // during test runs; the webview is still fully functional over CDP.
  browser: [
    async ({ tempDir }, use) => {
      const binary = ameBinaryPath();
      if (!fs.existsSync(binary)) {
        throw new Error(`Tauri binary not found at ${binary}. Run \`yarn build:e2e\` first.`);
      }
      const cdpPort = await getFreePort();
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ame-e2e-webview-'));

      const app = spawn(binary, [], {
        env: {
          ...process.env,
          AME_TEST_STORE_CWD: tempDir,
          AME_E2E_CDP_PORT: String(cdpPort),
          AME_E2E_USER_DATA: userDataDir,
          NODE_ENV: 'test',
        },
        stdio: 'ignore',
        windowsHide: true,
      });

      await waitForCdp(cdpPort, 30_000);
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
      await use(browser);

      // Teardown: close the CDP connection, then kill the app process tree.
      await browser.close().catch(() => {});
      if (app.pid) {
        await new Promise<void>((resolve) => {
          execFile('taskkill', ['/pid', String(app.pid), '/T', '/F'], () => resolve());
        });
        // Give WebView2 children a moment to exit so they release the locks
        // they hold on the user-data directory (otherwise rmSync throws EBUSY).
        await waitForProcessExit(app.pid, 5000);
      }
      await removeDirWithRetry(userDataDir, 5);
    },
    { scope: 'worker' },
  ],
  page: async ({ browser }, use) => {
    const page = findAppPage(browser);
    // Wait for the window to fully load and the Vue app to mount
    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await use(page);
  },
});

export { expect };

// ─── Form Field Helpers ─────────────────────────────────────────────────────
// Options.vue renders each option as a t-form-item containing:
//   Label: <span class="key">keyPath</span>
//   Control: t-select (for enum) or t-input (for free-form)
//   Tags: <t-tag> inside t-input's suffix slot showing type info

/**
 * Find the t-form-item container for a field by its key path.
 * Each field has a <span class="key">keyPath</span> in its label.
 */
export function findFieldByKey(mainContent: Locator, keyPath: string): Locator {
  return mainContent
    .locator('span.key')
    .getByText(keyPath, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"t-form__item")]')
    .first();
}

/**
 * Find the editable input for a specific field by key path.
 * Returns the <input placeholder="请输入"> inside the form item.
 */
export function findInputByKey(mainContent: Locator, keyPath: string): Locator {
  return findFieldByKey(mainContent, keyPath).locator('input[placeholder="请输入"]');
}

/**
 * Get the type tag texts for a specific field by key path.
 * e.g., for a [String, null] field, returns ['string', 'null']
 */
export async function getTagTextsByKey(mainContent: Locator, keyPath: string): Promise<string[]> {
  const tags = findFieldByKey(mainContent, keyPath).locator('.t-tag');
  // Wait for at least one tag to render — tags are added asynchronously after
  // the form item mounts, so reading immediately can return an empty list.
  await tags
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .catch(() => {
      // Field may legitimately have no tags; count will be 0.
    });
  const count = await tags.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await tags.nth(i).textContent();
    if (text) texts.push(text.trim());
  }
  return texts;
}

/**
 * Assert that a field has specific type tags.
 */
export async function expectTags(mainContent: Locator, keyPath: string, expectedTags: string[]): Promise<void> {
  const actualTags = await getTagTextsByKey(mainContent, keyPath);
  expect(actualTags.sort()).toEqual(expectedTags.sort());
}

/**
 * Fill an input field by key path, blur it, and check for validation error.
 * If invalidValue is provided, it should trigger a validation error containing errorFragment.
 * Then fill with validValue and verify the error disappears.
 */
export async function testValidation(
  mainContent: Locator,
  keyPath: string,
  invalidValue: string,
  errorFragment: string,
  validValue: string,
): Promise<void> {
  const input = findInputByKey(mainContent, keyPath);

  // Input invalid value
  await input.fill(invalidValue);
  await input.blur();

  // Should show validation error
  const field = findFieldByKey(mainContent, keyPath);
  await expect(field.locator('.error-message')).toContainText(errorFragment, { timeout: 5000 });

  // Input valid value
  await input.fill(validValue);
  await input.blur();

  // Error should disappear
  await expect(field.locator('.error-message')).not.toBeVisible();
}

/**
 * Fill an input field by key path with a valid value, blur, and verify no validation error.
 */
export async function testValidInput(mainContent: Locator, keyPath: string, validValue: string): Promise<void> {
  const input = findInputByKey(mainContent, keyPath);
  await input.fill(validValue);
  await input.blur();

  const field = findFieldByKey(mainContent, keyPath);
  await expect(field.locator('.error-message')).not.toBeVisible();
}
