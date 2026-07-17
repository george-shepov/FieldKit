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
    await expect(page.locator('#fkAppLibrary')).toBeVisible({ timeout: 5000 });

    const apps = page.locator('.fk-library-app');
    const initialCount = await apps.count();
    expect(initialCount).toBeGreaterThan(20);

    const offlineTag = page.locator('.fk-tag-cloud [data-action="tag"][data-tag="Offline"]').first();
    const connectedTag = page.locator('.fk-tag-cloud [data-action="tag"][data-tag="Connected"]').first();
    await expect(offlineTag).toBeVisible();
    await expect(connectedTag).toBeVisible();

    await offlineTag.click();
    await expect(apps.first()).toBeVisible();
    const offlineCount = await apps.count();
    expect(offlineCount).toBeGreaterThan(0);
    expect(offlineCount).toBeLessThan(initialCount);

    await offlineTag.click();
    await connectedTag.click();
    await expect(apps.first()).toBeVisible();
    const connectedCount = await apps.count();
    expect(connectedCount).toBeGreaterThan(0);
    expect(connectedCount).toBeLessThan(initialCount);
  });
});
