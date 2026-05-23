import {
  test,
  expect,
  navigateTo,
  waitForContent,
  providerRoute,
  findFieldByKey,
  expectTags,
  testValidInput,
} from './fixtures';

test.describe('/options/tts-manager', () => {
  test('should load tts manager options page with correct fields', async ({ page }) => {
    await navigateTo(page, '/options/tts-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // tts-manager uses providerId='<none>', no title
    const title = mainContent.locator('.title');
    expect(await title.count()).toBe(0);

    // TtsManager has one option: defaultProvider (enum select)
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await expect(saveButton).toBeVisible();
    await expect(mainContent.locator('button.t-button:has-text("放弃")')).toBeVisible();

    // Should show "默认提供程序" field as a t-select
    await expect(mainContent.locator('text=默认提供程序')).toBeVisible();
    const select = mainContent.locator('.t-select').first();
    await expect(select).toBeVisible();
  });

  test('should open defaultProvider select and show enum options', async ({ page }) => {
    await navigateTo(page, '/options/tts-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    await select.click();
    await page.waitForTimeout(300);

    const options = page.locator('.t-select-option');
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('WebSpeechSynthesisApi');

    await page.keyboard.press('Escape');
  });

  test('should save tts manager options', async ({ page }) => {
    await navigateTo(page, '/options/tts-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, '/options/tts-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await page.waitForTimeout(300);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toMatch(/^#\/(|dashboard)$/);
  });
});

test.describe('/options/tts-provider/WebSpeechSynthesisApi', () => {
  test('should display all options with correct fields', async ({ page }) => {
    await navigateTo(page, '/options/tts-provider/WebSpeechSynthesisApi');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Title
    const title = mainContent.locator('.title');
    await expect(title).toContainText('WebSpeechSynthesisApi');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // WebSpeechSynthesisApi options:
    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. voice.originalVoiceURI — rendered as t-select at runtime
    //    because the app dynamically injects system voice options
    await expect(mainContent.locator('text=源语言语音').first()).toBeVisible();

    // 3. voice.translateVoiceURI — rendered as t-select at runtime
    await expect(mainContent.locator('text=翻译语言语音').first()).toBeVisible();
  });

  test('should render enable as Boolean select and voice fields as selects', async ({ page }) => {
    await navigateTo(page, '/options/tts-provider/WebSpeechSynthesisApi');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // All 3 fields are rendered as t-select (voice fields are dynamically
    // populated with system voice options at runtime)
    const selects = mainContent.locator('.t-select');
    const selectCount = await selects.count();
    expect(selectCount).toBe(3);

    // No t-input fields (no free-form inputs with type tags)
    const editableInputs = mainContent.locator('input[placeholder="请输入"]');
    expect(await editableInputs.count()).toBe(0);
  });

  test('should toggle enable boolean select', async ({ page }) => {
    await navigateTo(page, '/options/tts-provider/WebSpeechSynthesisApi');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    await select.click();
    await page.waitForTimeout(300);

    const options = page.locator('.t-select-option');
    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => t.includes('true'))).toBeTruthy();
    expect(optionTexts.some((t) => t.includes('false'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should show voice options in select dropdowns', async ({ page }) => {
    await navigateTo(page, '/options/tts-provider/WebSpeechSynthesisApi');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Open the originalVoiceURI select (second select)
    const voiceSelect = mainContent.locator('.t-select').nth(1);
    await voiceSelect.click();
    await page.waitForTimeout(300);

    // Should show "null" as an option (since default is null)
    const options = page.locator('.t-select-option');
    const optionTexts = await options.allTextContents();
    // The voice select should have at least the "null" option
    expect(optionTexts.some((t) => t.includes('null'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should save WebSpeechSynthesisApi options', async ({ page }) => {
    await navigateTo(page, '/options/tts-provider/WebSpeechSynthesisApi');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});
