import { test, expect, navigateTo, waitForContent } from './fixtures';

test.describe('/options/locale-changers', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/options/locale-changers');
    await waitForContent(page);
  });

  test('should display the locale changers options page', async ({ page }) => {
    const mainContent = page.locator('#main-content');

    // Should have the default "Locale Emulator" text
    await expect(mainContent.getByText('Locale Emulator')).toBeVisible();

    // Should have the "新建" button
    const addButton = mainContent.locator('button:has-text("新建")');
    await expect(addButton).toBeVisible();

    // Should have "保存并应用" and "放弃" buttons
    await expect(mainContent.locator('button:has-text("保存并应用")')).toBeVisible();
    await expect(mainContent.locator('button:has-text("放弃")')).toBeVisible();
  });

  test('should have default "Locale Emulator" entry with placeholder', async ({ page }) => {
    const mainContent = page.locator('#main-content');

    // The default "Locale Emulator" text should be present
    await expect(mainContent.getByText('Locale Emulator')).toBeVisible();

    // Should have LEProc.exe placeholder input
    const leInput = mainContent.locator('input[placeholder="LEProc.exe"]');
    await expect(leInput).toBeVisible();
  });

  test('should add a new locale changer when clicking "新建"', async ({ page }) => {
    const mainContent = page.locator('#main-content');

    // Count all textbox inputs before adding
    const inputsBefore = await mainContent.locator('input, textarea').count();

    // Click the "新建" button
    const addButton = mainContent.locator('button:has-text("新建")');
    await addButton.click();

    // A new textbox should be added
    const inputsAfter = await mainContent.locator('input, textarea').count();
    expect(inputsAfter).toBe(inputsBefore + 1);
  });

  test('should allow editing the name of a locale changer', async ({ page }) => {
    // The edit button is labeled with the locale changer name (e.g., "Locale Emulator")
    const editButton = page.getByRole('button', { name: 'Locale Emulator' });
    await editButton.click({ force: true });

    // After clicking edit, the span becomes a textbox input
    const nameInput = page.locator('#main-content input').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test('should show delete confirmation popup when clicking delete', async ({ page }) => {
    // First add a new locale changer so we can delete it
    const mainContent = page.locator('#main-content');
    const addButton = mainContent.locator('button:has-text("新建")');
    await addButton.click();

    // Wait for the new entry to appear
    const name1Label = page.locator('.t-space.t-space-horizontal').filter({ hasText: 'name1' });
    await name1Label.waitFor({ state: 'visible', timeout: 5000 });

    // TDesign's t-space wraps each child in a <div class="t-space-item">
    const deleteItem = name1Label.locator('.t-space-item').nth(2);
    const deleteButton = deleteItem.locator('button');
    await deleteButton.click({ force: true });

    // Popconfirm should appear with "确认删除？" text
    const popconfirm = page.locator('.t-popconfirm__content');
    await expect(popconfirm).toBeVisible({ timeout: 5000 });
  });

  test('should save and show success message', async ({ page }) => {
    const mainContent = page.locator('#main-content');
    // Click "保存并应用"
    const saveButton = mainContent.locator('button:has-text("保存并应用")');
    await saveButton.click({ force: true });

    // Should show success message
    const message = page.locator('.t-message');
    await expect(message).toBeVisible({ timeout: 5000 });
    await expect(message).toContainText('已成功保存');
  });
});
