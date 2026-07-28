import { test, expect, navigateTo, waitForContent, openSelect } from './fixtures';

test.describe('/add-game', () => {
  test('should display step 0 with title and path inputs', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Steps component should be visible
    const steps = page.locator('.t-steps');
    await expect(steps).toBeVisible();

    // Step items should exist
    const stepItems = page.locator('.t-steps-item');
    await expect(stepItems).toHaveCount(3);

    // First step should contain "选择游戏路径"
    await expect(stepItems.nth(0)).toContainText('选择游戏路径');

    // Should have "标题" textbox
    const nameInput = page.getByPlaceholder('标题');
    await expect(nameInput).toBeVisible();

    // Should have "路径" textbox
    const pathInput = page.getByPlaceholder('路径');
    await expect(pathInput).toBeVisible();

    // Should have "下一步" button
    const nextButton = page.locator('button.t-button:has-text("下一步")');
    await expect(nextButton).toBeVisible();
  });

  test('should navigate to step 1 when clicking next', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Fill in required fields
    const nameInput = page.getByPlaceholder('标题');
    await nameInput.fill('TestGame');

    const pathInput = page.getByPlaceholder('路径');
    await pathInput.fill('C:\\test\\game.exe');

    const nextButton = page.locator('button.t-button:has-text("下一步")');
    await nextButton.click();

    // Step 1: should have 区域转换器 label and select
    await expect(page.getByText('区域转换器', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('请选择').first()).toBeVisible();

    // Should have 启动参数 textarea (disabled because default is "不转换")
    await expect(page.getByText('启动参数', { exact: true })).toBeVisible();

    // Should have 提取方法 select
    await expect(page.getByText('提取方法', { exact: true })).toBeVisible();

    // Should have HookCode input
    await expect(page.getByPlaceholder('可以留空')).toBeVisible();

    // Should have both "下一步" and "上一步" buttons
    await expect(page.locator('button.t-button:has-text("下一步")')).toBeVisible();
    await expect(page.locator('button.t-button:has-text("上一步")')).toBeVisible();
  });

  test('should go back to step 0 when clicking prev', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Go to step 1
    const nameInput = page.getByPlaceholder('标题');
    await nameInput.fill('TestGame');

    const pathInput = page.getByPlaceholder('路径');
    await pathInput.fill('C:\\test\\game.exe');

    await page.locator('button.t-button:has-text("下一步")').click();

    // Click "上一步"
    await page.locator('button.t-button:has-text("上一步")').click();

    // Should be back at step 0 — "标题" input should be visible
    await expect(page.getByPlaceholder('标题')).toBeVisible();
  });

  test('should disable HookCode input when extract method is OCR', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Go to step 1
    const nameInput = page.getByPlaceholder('标题');
    await nameInput.fill('TestGame');

    const pathInput = page.getByPlaceholder('路径');
    await pathInput.fill('C:\\test\\game.exe');

    await page.locator('button.t-button:has-text("下一步")').click();

    // HookCode should be enabled (textractor is default)
    const hookCodeInput = page.getByPlaceholder('可以留空');
    await expect(hookCodeInput).toBeEnabled();

    // Select OCR as extract method
    const selectTriggers = page.locator('.t-select');
    const options = await openSelect(page, selectTriggers.nth(1));

    const ocrOption = options.filter({ hasText: 'OCR' });
    await ocrOption.click();

    // HookCode should now be disabled
    await expect(hookCodeInput).toBeDisabled();
  });

  test('should show three steps in the steps component', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    const stepItems = page.locator('.t-steps-item');
    await expect(stepItems).toHaveCount(3);

    await expect(stepItems.nth(0)).toContainText('选择游戏路径');
    await expect(stepItems.nth(1)).toContainText('设置启动参数');
    await expect(stepItems.nth(2)).toContainText('检查配置');
  });

  test('should show locale changer options including 不转换 and 自定义启动参数 in step 1', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Go to step 1
    await page.getByPlaceholder('标题').fill('TestGame');
    await page.getByPlaceholder('路径').fill('C:\\test\\game.exe');
    await page.locator('button.t-button:has-text("下一步")').click();

    // Open the 区域转换器 select (first select on step 1)
    const localeSelect = page.locator('.t-select').first();
    const options = await openSelect(page, localeSelect);
    const optionTexts = await options.allTextContents();

    // Default entries always present
    expect(optionTexts).toContain('不转换');
    expect(optionTexts).toContain('自定义启动参数');

    await page.keyboard.press('Escape');
  });

  test('should enable exec shell textarea only when 自定义启动参数 is selected', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    await page.getByPlaceholder('标题').fill('TestGame');
    await page.getByPlaceholder('路径').fill('C:\\test\\game.exe');
    await page.locator('button.t-button:has-text("下一步")').click();

    // By default (不转换), the 启动参数 textarea is disabled
    const execShell = page.locator('.exec-shell textarea');
    await expect(execShell).toBeDisabled();

    // Select 自定义启动参数
    const localeSelect = page.locator('.t-select').first();
    const options = await openSelect(page, localeSelect);
    await options.filter({ hasText: '自定义启动参数' }).click();

    // Now the textarea should be enabled
    await expect(execShell).toBeEnabled();
  });

  test('should show loading state when advancing from step 1 to step 2', async ({ page }) => {
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Step 0
    await page.getByPlaceholder('标题').fill('TestGame');
    await page.getByPlaceholder('路径').fill('C:\\test\\game.exe');
    await page.locator('button.t-button:has-text("下一步")').click();

    // Step 1 → click 下一步 to trigger check() which shows loading
    await page.locator('button.t-button:has-text("下一步")').click();

    // Step 2 shows a loading spinner while startGame runs
    await expect(page.locator('.t-loading')).toBeVisible({ timeout: 5000 });
  });
});
