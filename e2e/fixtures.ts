import { test as base, expect, type Locator, type Page, type ElectronApplication } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { _electron } from 'playwright';

export const PROVIDER_IDS = {
  translate: [
    'OpenAI-Compatible API',
    '腾讯混元大模型',
    '腾讯云',
    '百度AI开放平台',
    '腾讯翻译君',
    '有道翻译',
    '百度翻译',
    '谷歌翻译',
    'JBeijing',
    'DrEye',
  ],
  ocr: ['PP-OCR', 'tesseract', '腾讯云', '百度AI开放平台'],
  segment: ['intl-segmenter', 'mecab'],
  tts: ['WebSpeechSynthesisApi'],
  dict: ['有道词典', '沪江小D'],
} as const;

export type ProviderType = keyof typeof PROVIDER_IDS;

/** Create a temporary directory for electron-store */
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

/** Build the provider option page route with URL-encoded providerId */
export function providerRoute(type: ProviderType, providerId: string): string {
  return `/options/${type}-provider/${encodeURIComponent(providerId)}`;
}

/** Navigate to a hash route within the Electron app */
export async function navigateTo(page: Page, route: string): Promise<void> {
  await page.evaluate((r: string) => {
    window.location.hash = '#' + r;
  }, route);
  // Wait for the route change to take effect
  await page.waitForTimeout(300);
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
  app: ElectronApplication;
  page: Page;
  tempDir: string;
}

export const test = base.extend<E2EFixtures>({
  // eslint-disable-next-line no-empty-pattern
  tempDir: async ({}, use) => {
    const dir = createTempDir();
    await use(dir);
    removeTempDir(dir);
  },
  app: async ({ tempDir }, use) => {
    const electronPath = path.join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe');
    const mainPath = path.join(process.cwd(), 'build', 'main', 'index.js');

    const app = await _electron.launch({
      executablePath: electronPath,
      args: [mainPath],
      env: {
        ...process.env,
        AME_TEST_STORE_CWD: tempDir,
        NODE_ENV: 'test',
      },
    });

    // Monkey-patch BrowserWindow.show so windows render correctly but are moved
    // off-screen, preventing them from popping up during test runs.
    // Retry because app.evaluate may fail if a renderer navigation destroys
    // the execution context during app startup.
    const patchBrowserWindow = async (retries = 3): Promise<void> => {
      for (let i = 0; i < retries; i++) {
        try {
          await app.evaluate(({ BrowserWindow }) => {
            const origShow = BrowserWindow.prototype.show;
            BrowserWindow.prototype.show = function () {
              this.setPosition(-32000, -32000);
              return origShow.call(this);
            };
            BrowserWindow.prototype.moveTop = function () {
              // no-op: irrelevant when off-screen
            };
          });
          return;
        } catch {
          if (i === retries - 1) throw new Error('Failed to patch BrowserWindow after ' + retries + ' retries');
          await new Promise((r) => {
            setTimeout(r, 500);
          });
        }
      }
    };
    await patchBrowserWindow();

    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    // Wait for the window to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
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
