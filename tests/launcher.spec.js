const { test, expect } = require('@playwright/test');

test.describe('Launcher connectivity filters', () => {
  test('shows Airplane mode and Wi-Fi/Cell filters and updates cards', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('suite_logged_in', '1');
    });

    await page.goto(`file://${process.cwd()}/index.html`);

    await expect(page.locator('#connectivityFilterSelect')).toBeVisible();
    await expect(page.locator('#sortModeSelect')).toBeVisible();

    // Airplane mode should show at least one AIRPLANE badge.
    await page.selectOption('#connectivityFilterSelect', 'airplane');
    await expect(page.locator('.badge.offline').first()).toBeVisible();
    await expect(page.locator('.badge.offline').first()).toContainText('AIRPLANE MODE');

    // Wi-Fi / Cell should show at least one WI-FI / CELL badge.
    await page.selectOption('#connectivityFilterSelect', 'wifi');
    await expect(page.locator('.badge.online').first()).toBeVisible();
    await expect(page.locator('.badge.online').first()).toContainText('WI-FI / CELL');
  });
});
