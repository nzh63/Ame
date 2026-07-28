import {
  test,
  expect,
  navigateTo,
  waitForContent,
  waitForHashNavigation,
  openSelect,
  PROVIDER_IDS,
  providerRoute,
} from './fixtures';
import type { Locator } from '@playwright/test';

/**
 * Helper: find the select (t-select) that is near a label text.
 * TDesign renders select as a textbox with "请选择" placeholder.
 * We find it by looking for the label text and then the nearest select-like element.
 */
function selectNearLabel(mainContent: Locator, labelText: string) {
  // Find the select component near the label. Options.vue renders each option
  // with the label text (readableName + key) followed by a t-select or t-input.
  // Use locator chaining based on the parent structure.
  // The t-form groups items in its content area.
  return mainContent.locator('.t-select').filter({ hasText: labelText }).first();
}

/**
 * Helper: find a form row by label text. Options.vue renders each option as:
 * [readableName key] (label)
 * [t-select or t-input] (value)
 * We use the form's structure to locate the right element.
 */
function inputNearLabel(mainContent: Locator, labelText: string) {
  // t-input is rendered for non-enum fields
  return mainContent.locator('.t-input').filter({ hasText: labelText }).first();
}

test.describe('/options/dict-manager', () => {
  test('should load dict manager options page with correct fields', async ({ page }) => {
    await navigateTo(page, '/options/dict-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // dict-manager uses providerId='<none>', so no provider title in main-content
    const title = mainContent.locator('.title');
    const titleCount = await title.count();
    expect(titleCount).toBe(0);

    // DictManager has one option: defaultProvider (enum select)
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await expect(saveButton).toBeVisible();
    await expect(mainContent.locator('button.t-button:has-text("放弃")')).toBeVisible();

    // Should show "默认提供程序" field as a select (enum type)
    await expect(mainContent.locator('text=默认提供程序')).toBeVisible();
    // The select should be visible (rendered as a textbox by TDesign)
    const select = mainContent.locator('.t-select').first();
    await expect(select).toBeVisible();
  });

  test('should change defaultProvider select and save', async ({ page }) => {
    await navigateTo(page, '/options/dict-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    // Click to open the dropdown
    const options = await openSelect(page, select);

    // Should show enum options in the dropdown
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');

    // Save
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();
    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, '/options/dict-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await waitForHashNavigation(page);
  });
});

test.describe('/options/dict-provider/:providerId', () => {
  for (const providerId of PROVIDER_IDS.dict) {
    test.describe(`dict provider: ${providerId}`, () => {
      test(`should load ${providerId} options page with empty state (no options)`, async ({ page }) => {
        const route = providerRoute('dict', providerId);
        await navigateTo(page, route);
        await waitForContent(page);

        const mainContent = page.locator('#main-content');

        // Should show the title
        const title = mainContent.locator('.title');
        await expect(title).toContainText(providerId);

        // External dict providers (有道词典, 沪江小D) have optionsSchema = null
        // Should show empty state
        const emptyState = mainContent.locator('text=没有可以调整的选项哦');
        await expect(emptyState).toBeVisible({ timeout: 5000 });

        // Should NOT have save/discard buttons
        const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
        await expect(saveButton).not.toBeVisible();
      });
    });
  }
});
