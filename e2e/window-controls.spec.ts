import { expect, navigateTo, test, waitForContent } from './fixtures';

test.describe('main window title bar controls', () => {
  test('should render minimize/maximize/close buttons at the top-right', async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);

    const controls = page.locator('.window-control');
    await expect(controls).toHaveCount(3);
    await expect(controls.nth(0)).toHaveAttribute('aria-label', '最小化');
    await expect(controls.nth(1)).toHaveAttribute('aria-label', '最大化');
    await expect(controls.nth(2)).toHaveAttribute('aria-label', '关闭');

    // Buttons sit flush in the top-right corner of the window: first row,
    // right edge aligned with the window width.
    const geometry = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.window-control'));
      const last = buttons[buttons.length - 1].getBoundingClientRect();
      return {
        top: last.top,
        rightGap: window.innerWidth - last.right,
        count: buttons.length,
      };
    });
    expect(geometry.top).toBe(0);
    expect(geometry.rightGap).toBeLessThanOrEqual(1);
    expect(geometry.count).toBe(3);
  });

  test('should toggle maximize and swap the button label', async ({ page }) => {
    await navigateTo(page, '/dashboard');
    await waitForContent(page);

    const maximizeButton = page.locator('.window-control[aria-label="最大化"]');
    const restoreButton = page.locator('.window-control[aria-label="还原"]');

    await maximizeButton.click();
    await expect(restoreButton).toBeVisible({ timeout: 5000 });

    await restoreButton.click();
    await expect(maximizeButton).toBeVisible({ timeout: 5000 });
  });
});
