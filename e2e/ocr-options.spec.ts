import {
  test,
  expect,
  navigateTo,
  waitForContent,
  waitForHashNavigation,
  providerRoute,
  expectTags,
  testValidation,
  testValidInput,
  openSelect,
} from './fixtures';

test.describe('/options/ocr-extractor', () => {
  test('should load OCR extractor options page with all expected fields', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // ocr-extractor uses providerId='<none>', no title
    const title = mainContent.locator('.title');
    expect(await title.count()).toBe(0);

    // Should have save/discard buttons
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await expect(saveButton).toBeVisible();
    await expect(mainContent.locator('button.t-button:has-text("放弃")')).toBeVisible();

    // OcrExtractor options (7 fields):
    // 1. delay (Number) → t-input
    await expect(mainContent.locator('text=截图延时').first()).toBeVisible();
    // 2. trigger.mouse.left (Boolean) → t-select
    await expect(mainContent.locator('text=鼠标左键触发').first()).toBeVisible();
    // 3. trigger.mouse.wheel (Boolean) → t-select
    await expect(mainContent.locator('text=鼠标滚轮触发').first()).toBeVisible();
    // 4. trigger.keyboard.enter (Boolean) → t-select
    await expect(mainContent.locator('text=回车键触发').first()).toBeVisible();
    // 5. trigger.keyboard.space (Boolean) → t-select
    await expect(mainContent.locator('text=空格键触发').first()).toBeVisible();
    // 6. trigger.movement.interval (Number) → t-input
    await expect(mainContent.locator('text=移动检测间隔').first()).toBeVisible();
    // 7. trigger.movement.threshold (Number) → t-input
    await expect(mainContent.locator('text=移动检测阈值').first()).toBeVisible();

    // Verify key path is displayed alongside readable name
    await expect(mainContent.locator('text=delay').first()).toBeVisible();
    await expect(mainContent.locator('text=trigger.mouse.left').first()).toBeVisible();
  });

  test('should show correct type tags on Number input fields', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // delay (Number) → tags: ["number"]
    await expectTags(mainContent, 'delay', ['number']);

    // trigger.movement.interval (Number) → tags: ["number"]
    await expectTags(mainContent, 'trigger.movement.interval', ['number']);

    // trigger.movement.threshold (Number) → tags: ["number"]
    await expectTags(mainContent, 'trigger.movement.threshold', ['number']);
  });

  test('should toggle boolean select and verify enum options', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Boolean fields render as t-select with true/false options
    const select = mainContent.locator('.t-select').first();
    const options = await openSelect(page, select);

    // Should show true and false options
    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => t.includes('true'))).toBeTruthy();
    expect(optionTexts.some((t) => t.includes('false'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should reject non-numeric input and accept valid number for delay field', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // delay (Number): invalid "abc" → error, valid "1000" → no error
    await testValidation(mainContent, 'delay', 'abc', '应当是一个数字', '1000');
  });

  test('should reject non-numeric input and accept valid number for interval field', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // trigger.movement.interval (Number): invalid "xyz" → error, valid "200" → no error
    await testValidation(mainContent, 'trigger.movement.interval', 'xyz', '应当是一个数字', '200');
  });

  test('should reject non-numeric input and accept valid number for threshold field', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // trigger.movement.threshold (Number): invalid "bad" → error, valid "0.01" → no error
    await testValidation(mainContent, 'trigger.movement.threshold', 'bad', '应当是一个数字', '0.01');
  });

  test('should save OCR extractor options', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, '/options/ocr-extractor');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await waitForHashNavigation(page);
  });
});

test.describe('/options/ocr-provider/PP-OCR', () => {
  test('should display PP-OCR options with correct fields', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', 'PP-OCR'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Title
    const title = mainContent.locator('.title');
    await expect(title).toContainText('PP-OCR');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // PP-OCR options (all enum/select, no t-input):
    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. model (enum) → t-select
    await expect(mainContent.locator('text=模型').first()).toBeVisible();

    // 3. device (enum) → t-select
    await expect(mainContent.locator('text=设备').first()).toBeVisible();

    // 4. textDirection (enum) → t-select
    await expect(mainContent.locator('text=文本方向').first()).toBeVisible();
  });

  test('should open model select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', 'PP-OCR'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const modelSelect = mainContent.locator('.t-select').nth(1);
    const options = await openSelect(page, modelSelect);

    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('mobile.fp16');
    expect(optionTexts).toContain('server.fp32');

    await page.keyboard.press('Escape');
  });

  test('should open textDirection select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', 'PP-OCR'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const dirSelect = mainContent.locator('.t-select').nth(3);
    const options = await openSelect(page, dirSelect);

    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('横排文本 从左到右');
    expect(optionTexts).toContain('竖排文本 从右到左');

    await page.keyboard.press('Escape');
  });

  test('should save PP-OCR options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', 'PP-OCR'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});

test.describe('/options/ocr-provider/腾讯云', () => {
  test('should display 腾讯云 OCR options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Title
    const title = mainContent.locator('.title');
    await expect(title).toContainText('腾讯云');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // 腾讯云 OCR options:
    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. apiConfig.credential.secretId ([String, null]) → t-input
    await expect(mainContent.locator('text=密钥ID').first()).toBeVisible();

    // 3. apiConfig.credential.secretKey ([String, null]) → t-input
    await expect(mainContent.locator('text=密钥KEY').first()).toBeVisible();

    // 4. apiConfig.region (String) → t-input
    await expect(mainContent.locator('text=地域').first()).toBeVisible();

    // 5. apiConfig.params.LanguageType (enum) → t-select
    await expect(mainContent.locator('text=语言').first()).toBeVisible();
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // apiConfig.credential.secretId ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.credential.secretId', ['string', 'null']);

    // apiConfig.credential.secretKey ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.credential.secretKey', ['string', 'null']);

    // apiConfig.region (String) → tags: ["string"]
    await expectTags(mainContent, 'apiConfig.region', ['string']);
  });

  test('should accept any string in [String, null] fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] fields accept any string (no type validation error)
    await testValidInput(mainContent, 'apiConfig.credential.secretId', 'my-secret-id');
    await testValidInput(mainContent, 'apiConfig.credential.secretKey', 'my-secret-key');
  });

  test('should accept "<null>" in [String, null] fields', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] fields accept "<null>" (parsed as null)
    await testValidInput(mainContent, 'apiConfig.credential.secretId', '<null>');
    await testValidInput(mainContent, 'apiConfig.credential.secretKey', '<null>');
  });

  test('should open LanguageType select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const langSelect = mainContent.locator('.t-select').nth(1);
    const options = await openSelect(page, langSelect);

    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => t.includes('auto'))).toBeTruthy();
    expect(optionTexts.some((t) => t.includes('jap'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should save 腾讯云 OCR options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("保存并应用")').click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("放弃")').click();
    await waitForHashNavigation(page);
  });
});

test.describe('/options/ocr-provider/百度AI开放平台', () => {
  test('should display 百度AI OCR options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('百度AI开放平台');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. apiConfig.apiKey ([String, null]) → t-input
    await expect(mainContent.locator('text=APP ID').first()).toBeVisible();

    // 3. apiConfig.secretKey ([String, null]) → t-input
    await expect(mainContent.locator('text=Secret Key').first()).toBeVisible();

    // 4. apiConfig.language (enum) → t-select
    await expect(mainContent.locator('text=识别语言类型').first()).toBeVisible();
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // apiConfig.apiKey ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.apiKey', ['string', 'null']);

    // apiConfig.secretKey ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.secretKey', ['string', 'null']);
  });

  test('should accept any string in [String, null] fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await testValidInput(mainContent, 'apiConfig.apiKey', 'my-app-id');
    await testValidInput(mainContent, 'apiConfig.secretKey', 'my-secret-key');
  });

  test('should open language select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const langSelect = mainContent.locator('.t-select').nth(1);
    const options = await openSelect(page, langSelect);

    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('JAP');

    await page.keyboard.press('Escape');
  });

  test('should save 百度AI OCR options', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("保存并应用")').click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, providerRoute('ocr', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("放弃")').click();
    await waitForHashNavigation(page);
  });
});
