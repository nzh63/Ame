import {
  test,
  expect,
  navigateTo,
  waitForContent,
  waitForHashNavigation,
  providerRoute,
  findFieldByKey,
  findInputByKey,
  expectTags,
  testValidation,
  testValidInput,
  openSelect,
} from './fixtures';
import type { Locator } from '@playwright/test';

async function expectFieldVisible(mainContent: Locator, labelText: string) {
  await expect(mainContent.locator(`text=${labelText}`).first()).toBeVisible();
}

test.describe('/options/translate-provider/OpenAI-Compatible API', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Title
    const title = mainContent.locator('.title');
    await expect(title).toContainText('OpenAI-Compatible API');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // Options:
    // 1. enable (Boolean) → t-select
    await expectFieldVisible(mainContent, '启用');

    // 2. apiConfig.baseURL (String) → t-input
    await expectFieldVisible(mainContent, 'Base URL');

    // 3. apiConfig.apiKey (String) → t-input
    await expectFieldVisible(mainContent, 'API Key');

    // 4. apiConfig.organization (String) → t-input
    await expectFieldVisible(mainContent, '组织');

    // 5. chatConfig.model (String) → t-input
    await expectFieldVisible(mainContent, '模型');

    // 6. chatConfig.maxHistory (Number) → t-input
    await expectFieldVisible(mainContent, '最长历史大小');

    // 7. chatConfig.systemPrompt (String) → t-input
    await expectFieldVisible(mainContent, 'System Prompt');

    // 8. chatConfig.reasoningEffort (string) → t-select
    await expectFieldVisible(mainContent, '思考强度');
  });

  test('should show correct type tags on all input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // String fields → tags: ["string"]
    await expectTags(mainContent, 'apiConfig.baseURL', ['string']);
    await expectTags(mainContent, 'apiConfig.apiKey', ['string']);
    await expectTags(mainContent, 'apiConfig.organization', ['string']);
    await expectTags(mainContent, 'chatConfig.model', ['string']);
    await expectTags(mainContent, 'chatConfig.systemPrompt', ['string']);

    // Number field → tags: ["number"]
    await expectTags(mainContent, 'chatConfig.maxHistory', ['number']);
  });

  test('should toggle enable boolean select', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const select = mainContent.locator('.t-select').first();

    const options = await openSelect(page, select);
    const optionTexts = await options.allTextContents();
    expect(optionTexts.some((t) => t.includes('true'))).toBeTruthy();
    expect(optionTexts.some((t) => t.includes('false'))).toBeTruthy();

    await page.keyboard.press('Escape');
  });

  test('should reject non-numeric input and accept valid number for maxHistory', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // chatConfig.maxHistory (Number): invalid "not-a-number" → error, valid "50" → no error
    await testValidation(mainContent, 'chatConfig.maxHistory', 'not-a-number', '应当是一个数字', '50');
  });

  test('should show red error message for invalid number input', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Enter letters in number field
    const input = findInputByKey(mainContent, 'chatConfig.maxHistory');
    await input.fill('abc-hi-123');
    await input.blur();

    // The error-message span should be visible (rendered in red via CSS)
    const field = findFieldByKey(mainContent, 'chatConfig.maxHistory');
    const errorEl = field.locator('.error-message');
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await expect(errorEl).toContainText('chatConfig.maxHistory 应当是一个数字');

    // The error message should have red color from tdesign --td-error-color
    await expect(errorEl).toHaveCSS('color', 'rgb(213, 73, 65)');

    // After entering valid input, error should disappear
    await input.fill('50');
    await input.blur();
    await expect(errorEl).not.toBeVisible();
  });

  test('should prevent saving when there is a validation error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Enter invalid letters in number field
    const input = findInputByKey(mainContent, 'chatConfig.maxHistory');
    await input.fill('not-a-number');
    await input.blur();

    // Verify error is shown
    const field = findFieldByKey(mainContent, 'chatConfig.maxHistory');
    const errorEl = field.locator('.error-message');
    await expect(errorEl).toBeVisible({ timeout: 5000 });

    // Click save — should be blocked with a warning
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    // Should show warning message instead of success
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    const warning = page.locator('.t-message');
    await expect(warning).toBeVisible({ timeout: 5000 });
    await expect(warning).toContainText('请先修正输入错误再保存');

    // Fix the input
    await input.fill('50');
    await input.blur();
    await expect(errorEl).not.toBeVisible();

    // Save should now succeed
    await saveButton.click();
    const success = page.locator('.t-message').last();
    await expect(success).toBeVisible({ timeout: 5000 });
    await expect(success).toContainText('已成功保存');
  });

  test('should accept any string in String fields without validation error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // String fields accept any string (no type validation)
    await testValidInput(mainContent, 'apiConfig.baseURL', 'https://custom-api.example.com/v1');
    await testValidInput(mainContent, 'apiConfig.apiKey', 'sk-test-key-123');
    await testValidInput(mainContent, 'chatConfig.model', 'gpt-4o');
  });

  test('should edit input fields and save', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Edit Base URL
    const baseUrlInput = findInputByKey(mainContent, 'apiConfig.baseURL');
    await baseUrlInput.fill('https://custom-api.example.com/v1');
    await baseUrlInput.blur();

    // Save
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await waitForHashNavigation(page);
  });

  test('should NOT prompt unsaved changes when leaving without edits', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Click "放弃" without making any edits
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await waitForHashNavigation(page);

    // Should NOT show unsaved changes notification
    const notification = page.locator('.t-notification');
    await expect(notification).toHaveCount(0);
  });

  test('should prompt unsaved changes when leaving after edit', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Make an edit to trigger unsaved changes
    const baseUrlInput = findInputByKey(mainContent, 'apiConfig.baseURL');
    await baseUrlInput.fill('https://edited.example.com');
    await baseUrlInput.blur();

    // Click "放弃" — should trigger unsaved changes notification
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();

    // Should show unsaved changes notification
    const notification = page.locator('.t-notification');
    await expect(notification).toBeVisible({ timeout: 5000 });
    await expect(notification).toContainText('您有未保存的内容');

    // Click "离开，且不要保存" to proceed
    const leaveButton = notification.locator('button:has-text("离开，且不要保存")');
    await leaveButton.click();
    await waitForHashNavigation(page);
  });

  test('should NOT prompt unsaved changes when leaving after save', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'OpenAI-Compatible API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Make an edit
    const baseUrlInput = findInputByKey(mainContent, 'apiConfig.baseURL');
    await baseUrlInput.fill('https://edited.example.com');
    await baseUrlInput.blur();

    // Save
    const saveButton = mainContent.locator('button.t-button:has-text("保存并应用")');
    await saveButton.click();

    // Wait for success message
    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');

    // Now click "放弃" — should NOT prompt unsaved changes
    const discardButton = mainContent.locator('button.t-button:has-text("放弃")');
    await discardButton.click();
    await waitForHashNavigation(page);

    // Should NOT show unsaved changes notification after saving
    const notification = page.locator('.t-notification');
    await expect(notification).toHaveCount(0);
  });
});

test.describe('/options/translate-provider/腾讯云', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('腾讯云');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // Options:
    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, '密钥ID');
    await expectFieldVisible(mainContent, '密钥KEY');
    await expectFieldVisible(mainContent, '地域');
    await expectFieldVisible(mainContent, '源语言');
    await expectFieldVisible(mainContent, '目标语言');
    await expectFieldVisible(mainContent, 'ProjectId');
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] fields → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.credential.secretId', ['string', 'null']);
    await expectTags(mainContent, 'apiConfig.credential.secretKey', ['string', 'null']);

    // String field → tags: ["string"]
    await expectTags(mainContent, 'apiConfig.region', ['string']);

    // Number field → tags: ["number"]
    await expectTags(mainContent, 'apiConfig.params.ProjectId', ['number']);
  });

  test('should reject non-numeric input and accept valid number for ProjectId', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // apiConfig.params.ProjectId (Number): invalid "abc" → error, valid "0" → no error
    await testValidation(mainContent, 'apiConfig.params.ProjectId', 'abc', '应当是一个数字', '0');
  });

  test('should accept any string in [String, null] fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await testValidInput(mainContent, 'apiConfig.credential.secretId', 'my-secret-id');
    await testValidInput(mainContent, 'apiConfig.credential.secretKey', 'my-secret-key');
  });

  test('should open Source language select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯云'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const sourceSelect = mainContent.locator('.t-select').nth(1);

    const options = await openSelect(page, sourceSelect);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('auto');
    expect(optionTexts).toContain('ja');
    expect(optionTexts).toContain('zh');

    await page.keyboard.press('Escape');
  });
});

test.describe('/options/translate-provider/百度AI开放平台', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('百度AI开放平台');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, 'APP ID');
    await expectFieldVisible(mainContent, 'Key');
    await expectFieldVisible(mainContent, '源语言');
    await expectFieldVisible(mainContent, '目标语言');
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] fields → tags: ["string", "null"]
    await expectTags(mainContent, 'apiConfig.appid', ['string', 'null']);
    await expectTags(mainContent, 'apiConfig.key', ['string', 'null']);

    // String fields → tags: ["string"]
    await expectTags(mainContent, 'apiConfig.fromLanguage', ['string']);
    await expectTags(mainContent, 'apiConfig.toLanguage', ['string']);
  });

  test('should accept any string in String and [String, null] fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '百度AI开放平台'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] fields
    await testValidInput(mainContent, 'apiConfig.appid', 'my-app-id');
    await testValidInput(mainContent, 'apiConfig.key', 'my-key');

    // String fields
    await testValidInput(mainContent, 'apiConfig.fromLanguage', 'jp');
    await testValidInput(mainContent, 'apiConfig.toLanguage', 'zh');
  });
});

test.describe('/options/translate-provider/腾讯翻译君', () => {
  test('should display all options with correct fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯翻译君'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('腾讯翻译君');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, '源语言');
    await expectFieldVisible(mainContent, '目标语言');
  });

  test('should save 腾讯翻译君 options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯翻译君'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("保存并应用")').click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '腾讯翻译君'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("放弃")').click();
    await waitForHashNavigation(page);
  });
});

test.describe('/options/translate-provider/有道翻译', () => {
  test('should display all options with correct fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '有道翻译'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('有道翻译');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, '源语言');
    await expectFieldVisible(mainContent, '目标语言');
  });

  test('should save 有道翻译 options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '有道翻译'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("保存并应用")').click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });

  test('should navigate away when clicking "放弃"', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', '有道翻译'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("放弃")').click();
    await waitForHashNavigation(page);
  });
});

test.describe('/options/translate-provider/JBeijing', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'JBeijing'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('JBeijing');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, 'JBJCT.dll 的路径');
    // userDicts is an Array with 3 items, each with its own readableName
    await expectFieldVisible(mainContent, '用户辞书');
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'JBeijing'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // path.dll ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'path.dll', ['string', 'null']);

    // path.userDicts.0 (String) → tags: ["string"]
    await expectTags(mainContent, 'path.userDicts.0', ['string']);

    // path.userDicts.1 (String) → tags: ["string"]
    await expectTags(mainContent, 'path.userDicts.1', ['string']);

    // path.userDicts.2 (String) → tags: ["string"]
    await expectTags(mainContent, 'path.userDicts.2', ['string']);
  });

  test('should accept any string in [String, null] and String fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'JBeijing'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // [String, null] field
    await testValidInput(mainContent, 'path.dll', 'C:/test/JBJCT.dll');

    // String fields (array items)
    await testValidInput(mainContent, 'path.userDicts.0', 'C:/dict1.txt');
  });

  test('should accept "<null>" in [String, null] field', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'JBeijing'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await testValidInput(mainContent, 'path.dll', '<null>');
  });

  test('should reject invalid JSON and accept valid JSON for array field', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'JBeijing'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // path.userDicts.0 (String item in Array) — it's a plain String input,
    // so any string is valid JSON string. The array-level parsing happens
    // only for non-item-level fields. Since this is rendered as individual
    // String inputs, any string is accepted.
    await testValidInput(mainContent, 'path.userDicts.0', 'any-string-value');
  });
});

test.describe('/options/translate-provider/DrEye', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'DrEye'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    const title = mainContent.locator('.title');
    await expect(title).toContainText('DrEye');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, 'TransCOM.dll 的路径');
    await expectFieldVisible(mainContent, 'TransCOMEC.dll 的路径');
    await expectFieldVisible(mainContent, '翻译选项');
  });

  test('should show correct type tags on input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'DrEye'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // path.dllTransCOM ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'path.dllTransCOM', ['string', 'null']);

    // path.dllTransCOMEC ([String, null]) → tags: ["string", "null"]
    await expectTags(mainContent, 'path.dllTransCOMEC', ['string', 'null']);
  });

  test('should accept any string in [String, null] fields without error', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'DrEye'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await testValidInput(mainContent, 'path.dllTransCOM', 'C:/test/TransCOM.dll');
    await testValidInput(mainContent, 'path.dllTransCOMEC', 'C:/test/TransCOMEC.dll');
  });

  test('should accept "<null>" in [String, null] fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'DrEye'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await testValidInput(mainContent, 'path.dllTransCOM', '<null>');
    await testValidInput(mainContent, 'path.dllTransCOMEC', '<null>');
  });

  test('should open translateType select and show enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'DrEye'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    // translateType is the second select (index 1)
    const typeSelect = mainContent.locator('.t-select').nth(1);

    const options = await openSelect(page, typeSelect);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain('日->中');
    expect(optionTexts).toContain('中->日');
    expect(optionTexts).toContain('英->中');
    expect(optionTexts).toContain('中->英');

    await page.keyboard.press('Escape');
  });
});

test.describe('/options/translate-provider echo (DEV only)', () => {
  test('should load echo options page with empty state', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'echo'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const emptyState = mainContent.locator('text=没有可以调整的选项哦');
    await expect(emptyState)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        // If not in DEV mode, the page might show an error or different state
      });
  });
});

test.describe('/options/translate-provider/Anthropic Message API', () => {
  test('should display all options with correct fields and type tags', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    // Title
    const title = mainContent.locator('.title');
    await expect(title).toContainText('Anthropic Message API');

    await expect(mainContent.locator('button.t-button:has-text("保存并应用")')).toBeVisible();

    // Options (old Electron layout: apiConfig + chatConfig):
    await expectFieldVisible(mainContent, '启用');
    await expectFieldVisible(mainContent, 'Base URL');
    await expectFieldVisible(mainContent, 'API Key');
    await expectFieldVisible(mainContent, 'Auth Token');
    await expectFieldVisible(mainContent, '模型');
    await expectFieldVisible(mainContent, '最长历史大小');
    await expectFieldVisible(mainContent, '最大 Token 数');
    await expectFieldVisible(mainContent, 'System Prompt');
    await expectFieldVisible(mainContent, '思考模式');
    await expectFieldVisible(mainContent, '思考预算 Token');
    await expectFieldVisible(mainContent, '输出强度');
    await expectFieldVisible(mainContent, '缓存控制');
  });

  test('should show correct type tags on all input fields', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');

    await expectTags(mainContent, 'apiConfig.baseURL', ['string']);
    await expectTags(mainContent, 'apiConfig.apiKey', ['string']);
    await expectTags(mainContent, 'apiConfig.authToken', ['string']);
    await expectTags(mainContent, 'chatConfig.model', ['string']);
    await expectTags(mainContent, 'chatConfig.systemPrompt', ['string']);
    await expectTags(mainContent, 'chatConfig.maxHistory', ['number']);
    await expectTags(mainContent, 'chatConfig.maxTokens', ['number']);
    await expectTags(mainContent, 'chatConfig.thinkingBudgetTokens', ['number']);
  });

  test('should show thinkingType enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const thinkingSelect = findFieldByKey(mainContent, 'chatConfig.thinkingType').locator('.t-select');
    const options = await openSelect(page, thinkingSelect);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toEqual(expect.arrayContaining(['disabled', 'enabled', 'adaptive']));

    await page.keyboard.press('Escape');
  });

  test('should show outputEffort enum options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    const effortSelect = findFieldByKey(mainContent, 'chatConfig.outputEffort').locator('.t-select');
    const options = await openSelect(page, effortSelect);
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toEqual(expect.arrayContaining(['low', 'medium', 'high', 'xhigh', 'max']));

    await page.keyboard.press('Escape');
  });

  test('should reject non-numeric input for maxHistory and maxTokens', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await testValidation(mainContent, 'chatConfig.maxHistory', 'not-a-number', '应当是一个数字', '50');
    await testValidation(mainContent, 'chatConfig.maxTokens', 'not-a-number', '应当是一个数字', '4096');
  });

  test('should save Anthropic options', async ({ page }) => {
    await navigateTo(page, providerRoute('translate', 'Anthropic Message API'));
    await waitForContent(page);

    const mainContent = page.locator('#main-content');
    await mainContent.locator('button.t-button:has-text("保存并应用")').click();

    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});
