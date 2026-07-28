import {
  test,
  expect,
  navigateTo,
  waitForContent,
  providerRoute,
  findInputByKey,
  expectTags,
  testValidInput,
  openSelect,
} from './fixtures';

test.describe('/options/segment-manager', () => {
  test('should load segment manager options page with correct fields', async ({ page }) => {
    await navigateTo(page, '/options/segment-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // segment-manager uses providerId='<none>', no title
    const title = mainContent.locator('.title');
    expect(await title.count()).toBe(0);

    // SegmentManager has one option: defaultProvider (enum select)
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await expect(saveButton).toBeVisible();
    await expect(mainContent.locator('button.t-button:has-text("放弃")')).toBeVisible();

    // Should show "默认提供程序" field as a t-select
    await expect(mainContent.locator('text=默认提供程序')).toBeVisible();
    const select = mainContent.locator('.t-select').first();
    await expect(select).toBeVisible();
  });

  test('should open defaultProvider select and show enum options', async ({ page }) => {
    await navigateTo(page, '/options/segment-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    const options = await openSelect(page, select);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('intl-segmenter');
    expect(optionTexts).toContain('mecab');

    await page.keyboard.press('Escape');
  });

  test('should save segment manager options', async ({ page }) => {
    await navigateTo(page, '/options/segment-manager');
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});

test.describe('/options/segment-provider/intl-segmenter', () => {
  test('should display intl-segmenter options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'intl-segmenter'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('intl-segmenter');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // intl-segmenter options:
    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. language (String) → t-input with "string" tag
    await expect(mainContent.locator('text=语言').first()).toBeVisible();

    // Verify type tags
    await expectTags(mainContent, 'language', ['string']);
  });

  test('should toggle enable boolean select', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'intl-segmenter'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    const options = await openSelect(page, select);
    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => t.includes('true'))).toBeTruthy();
    expect(optionTexts.some((t) => t.includes('false'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should accept any string in language field without validation error', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'intl-segmenter'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // language (String) → any string is accepted
    await testValidInput(mainContent, 'language', 'en');
    await testValidInput(mainContent, 'language', 'ja');
    await testValidInput(mainContent, 'language', 'zh-CN');
  });

  test('should edit language input and save', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'intl-segmenter'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const langInput = findInputByKey(mainContent, 'language');
    await langInput.fill('en');
    await langInput.blur();

    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});

test.describe('/options/segment-provider/mecab', () => {
  test('should display mecab options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'mecab'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('mecab');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // mecab options:
    // 1. enable (Boolean) → t-select
    await expect(mainContent.locator('text=启用').first()).toBeVisible();

    // 2. exePath (String) → t-input with "string" tag
    await expect(mainContent.locator('text=mecab.exe路径').first()).toBeVisible();

    // 3. encoding (enum) → t-select
    await expect(mainContent.locator('text=编码格式').first()).toBeVisible();

    // Verify type tag
    await expectTags(mainContent, 'exePath', ['string']);
  });

  test('should open encoding select and show all enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'mecab'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    // encoding is the second select
    const encodingSelect = mainContent.locator('.t-select').nth(1);

    const options = await openSelect(page, encodingSelect);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('Shift_JIS');
    expect(optionTexts).toContain('UTF-8');
    expect(optionTexts).toContain('UTF-16');
    expect(optionTexts).toContain('EUC-JP');

    await page.keyboard.press('Escape');
  });

  test('should accept any string in exePath field without validation error', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'mecab'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // exePath (String) → any string is accepted
    await testValidInput(mainContent, 'exePath', 'C:/test/mecab.exe');
    await testValidInput(mainContent, 'exePath', '/usr/local/bin/mecab');
  });

  test('should edit exePath input and save', async ({ page }) => {
    await navigateTo(page, providerRoute('segment', 'mecab'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const exePathInput = findInputByKey(mainContent, 'exePath');
    await exePathInput.fill('C:/test/mecab.exe');
    await exePathInput.blur();

    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});
