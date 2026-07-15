const { test, expect } = require('@playwright/test');

const rootUrl = `file://${process.cwd()}/index.html`;

test.describe('FieldKit launcher library appearance', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('fieldkit_library_theme_v1');
    });
  });

  test('keeps the tag cloud compact and persists appearance settings', async ({ page }) => {
    await page.goto(rootUrl);
    await expect(page.locator('#fkAppLibrary')).toBeVisible({ timeout: 5000 });

    const tagCloud = page.locator('.fk-tag-cloud');
    await expect(tagCloud).toBeVisible();
    const tagCloudHeight = await tagCloud.evaluate((element) => element.getBoundingClientRect().height);
    expect(tagCloudHeight).toBeLessThanOrEqual(170);

    await page.getByRole('button', { name: 'Theme' }).click();
    await expect(page.locator('.fk-theme-settings.is-open')).toBeVisible();

    await page.locator('[data-theme-field="accent"]').evaluate((input) => {
      input.value = '#22c55e';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('[data-theme-field="fontScale"]').selectOption('1.10');

    await expect.poll(() => page.evaluate(() => localStorage.getItem('fieldkit_library_theme_v1')))
      .toContain('"accent":"#22c55e"');

    await page.reload();
    await page.getByRole('button', { name: 'Theme' }).click();
    await expect(page.locator('[data-theme-field="accent"]')).toHaveValue('#22c55e');
    await expect(page.locator('[data-theme-field="fontScale"]')).toHaveValue('1.10');
  });
});
