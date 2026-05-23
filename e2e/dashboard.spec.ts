import { test, expect, navigateTo, waitForContent } from './fixtures';

test.describe('/dashboard', () => {
  test('should display the dashboard page with drag area and PID button', async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);

    // Dashboard should have a drag-area
    const dragArea = page.locator('.drag-area');
    await expect(dragArea).toBeVisible();

    // Should have the "通过PID启动" button
    const pidButton = page.locator('button.t-button:has-text("通过PID启动")');
    await expect(pidButton).toBeVisible();

    // No game cards initially (empty state)
    const gameCards = page.locator('.game-card');
    await expect(gameCards).toHaveCount(0);
  });

  test('should open PID dialog when clicking PID button', async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);

    // Click the PID button
    const pidButton = page.locator('button.t-button:has-text("通过PID启动")');
    await pidButton.click();

    // Dialog should appear
    const dialog = page.locator('.t-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('通过PID启动');

    // Dialog should contain a PID input
    const pidInput = dialog.locator('input[type="number"]');
    await expect(pidInput).toBeVisible();

    // Dialog should contain a tooltip button for window selection
    const focusButton = dialog.locator('button:has(.t-icon)');
    await expect(focusButton.first()).toBeVisible();

    // Close dialog by clicking confirm (force click to avoid animation stability issues)
    const confirmButton = dialog.locator('button.t-button:has-text("确认")');
    await confirmButton.click({ force: true });
    await expect(dialog).not.toBeVisible();
  });

  test('should have drag-area with correct structure for drag-and-drop', async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);

    // Dashboard should have a drag-area element
    const dragArea = page.locator('.drag-area');
    await expect(dragArea).toBeVisible();

    // Verify the element has the expected CSS class
    await expect(dragArea).toHaveClass(/drag-area/);

    // Verify no draging class initially
    await expect(dragArea).not.toHaveClass(/draging/);

    // The "松开以添加" tip should not be visible initially (v-if="draging" is false)
    const tip = page.locator('h1.tip');
    await expect(tip).not.toBeVisible();
  });
});
