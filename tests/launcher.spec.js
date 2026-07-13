const { test, expect } = require('@playwright/test');

const PRIVATE_MODE = {
  mode: 'offline_private',
  allowSync: false,
  allowSupport: false,
  allowAI: false,
  managedEndpoint: '',
  customEndpoint: ''
};

test.describe('Launcher connectivity filters', () => {
  test('shows Airplane Mode and Wi-Fi / Cell tags and updates the file view', async ({ page }) => {
    await page.addInitScript((config) => {
      localStorage.setItem('suite_logged_in', '1');
      localStorage.setItem('suite.privacy.mode.v1', JSON.stringify(config));
      localStorage.setItem('fieldkit_launcher_view_v2', 'list');
    }, PRIVATE_MODE);

    await page.goto(`file://${process.cwd()}/index.html`);
    await expect(page.locator('#fkExplorer')).toBeVisible({ timeout: 5000 });

    const airplaneTag = page.locator('[data-action="tag"][data-tag="Airplane Mode"]').first();
    const connectedTag = page.locator('[data-action="tag"][data-tag="Wi-Fi / Cell"]').first();
    await expect(airplaneTag).toBeVisible();
    await expect(connectedTag).toBeVisible();

    await airplaneTag.click();
    await expect(page.locator('.fk-file-row').first()).toBeVisible();
    expect(await page.locator('.fk-file-row .fk-meta-offline').count()).toBeGreaterThan(0);
    await expect(page.locator('.fk-file-row .fk-meta-connected')).toHaveCount(0);

    await airplaneTag.click();
    await connectedTag.click();
    await expect(page.locator('.fk-file-row').first()).toBeVisible();
    expect(await page.locator('.fk-file-row .fk-meta-connected').count()).toBeGreaterThan(0);
    await expect(page.locator('.fk-file-row .fk-meta-offline')).toHaveCount(0);
  });
});
