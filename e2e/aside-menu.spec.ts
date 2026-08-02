import { test, expect, navigateTo, waitForContent } from './fixtures';

test.describe('AsideMenu navigation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);
  });

  test('should display the sidebar menu with logo and main items', async ({ page }) => {
    // Logo should be visible
    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();
    await expect(logo.locator('.title')).toContainText('Ame');

    // Main menu items (TDesign uses BEM class t-menu__item)
    await expect(page.locator('.t-menu__item:has-text("主页")')).toBeVisible();
    await expect(page.locator('.t-menu__item:has-text("添加游戏")')).toBeVisible();
    await expect(page.locator('.t-menu__item:has-text("区域转换器设置")')).toBeVisible();
  });

  test('should display all submenu groups', async ({ page }) => {
    // Submenu titles
    await expect(page.locator('.t-submenu:has-text("翻译器设置")')).toBeVisible();
    await expect(page.locator('.t-submenu:has-text("TTS设置")')).toBeVisible();
    await expect(page.locator('.t-submenu:has-text("OCR设置")')).toBeVisible();
    await expect(page.locator('.t-submenu:has-text("分词设置")')).toBeVisible();
    await expect(page.locator('.t-submenu:has-text("词典设置")')).toBeVisible();
  });

  test('should navigate to /add-game when clicking menu item', async ({ page }) => {
    await page.locator('.t-menu__item:has-text("添加游戏")').click();
    await waitForContent(page);

    // Should be on add-game page
    await expect(page.locator('.t-steps')).toBeVisible();
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#/add-game');
  });

  test('should navigate to /options/locale-changers when clicking menu item', async ({ page }) => {
    await page.locator('.t-menu__item:has-text("区域转换器设置")').click();
    await waitForContent(page);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#/options/locale-changers');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('should navigate to /dashboard when clicking 主页', async ({ page }) => {
    // First go to another page
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // Click 主页
    await page.locator('.t-menu__item:has-text("主页")').click();
    await waitForContent(page);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toMatch(/^#\/(|dashboard)$/);
    await expect(page.locator('.drag-area')).toBeVisible();
  });

  test('should expand 翻译器设置 submenu and show provider items', async ({ page }) => {
    // Click the 翻译器设置 submenu title to expand it
    await page.getByText('翻译器设置', { exact: true }).click();

    // Should show translate provider menu items
    await expect(page.locator('.t-menu__item:has-text("OpenAI-Compatible API")')).toBeVisible();
    await expect(page.locator('.t-menu__item:has-text("有道翻译")')).toBeVisible();
  });

  test('should navigate to a translate provider via submenu', async ({ page }) => {
    // Expand 翻译器设置 submenu
    await page.getByText('翻译器设置', { exact: true }).click();

    // Click a provider
    await page.locator('.t-menu__item:has-text("OpenAI-Compatible API")').click();
    await waitForContent(page);

    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toContain('/options/translate-provider/');
    await expect(page.locator('#main-content .title')).toContainText('OpenAI-Compatible API');
  });

  test('should expand OCR设置 submenu and show 通用设置 and providers', async ({ page }) => {
    await page.getByText('OCR设置', { exact: true }).click();

    // Scope to the OCR submenu container — "通用设置" also exists in the TTS,
    // 分词 and 词典 submenus, so an unscoped .first() would match a hidden item.
    const ocrSubmenu = page.locator('.t-submenu', { hasText: 'OCR设置' });
    await expect(ocrSubmenu.locator('.t-menu__item:has-text("通用设置")')).toBeVisible();
    await expect(ocrSubmenu.locator('.t-menu__item:has-text("PP-OCR")')).toBeVisible();
    // Tesseract was removed with the frontend WASM worker; it must not reappear.
    await expect(ocrSubmenu.locator('.t-menu__item:has-text("tesseract")')).toHaveCount(0);
  });

  test('should highlight the active menu item', async ({ page }) => {
    // Navigate to add-game
    await navigateTo(page, '/add-game');
    await waitForContent(page);

    // The 添加游戏 menu item should be active (TDesign adds t-is-active class)
    const menuItem = page.locator('.t-menu__item:has-text("添加游戏")');
    await expect(menuItem).toHaveClass(/t-is-active/);
  });
});
