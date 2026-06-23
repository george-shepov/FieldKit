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

test.describe('Launcher sort modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('suite_logged_in', '1');
    });
    await page.goto(`file://${process.cwd()}/index.html`);
    // Wait for apps to render
    await page.waitForSelector('.app-name', { timeout: 15000 });
  });

  test('A-Z sort displays app names in ascending order', async ({ page }) => {
    await page.selectOption('#sortModeSelect', 'az');
    await page.waitForTimeout(500);
    const names = await page.locator('.app-name').allTextContents();
    expect(names.length).toBeGreaterThan(1);
    const sorted = [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    expect(names).toEqual(sorted);
  });

  test('Z-A sort displays app names in descending order', async ({ page }) => {
    await page.selectOption('#sortModeSelect', 'za');
    await page.waitForTimeout(500);
    const names = await page.locator('.app-name').allTextContents();
    expect(names.length).toBeGreaterThan(1);
    const sorted = [...names].sort((a, b) =>
      b.localeCompare(a, undefined, { sensitivity: 'base' })
    );
    expect(names).toEqual(sorted);
  });

  test('By Category sort shows category headers', async ({ page }) => {
    await page.selectOption('#sortModeSelect', 'categories');
    await page.waitForTimeout(500);
    const headers = await page.locator('.category-title, .category-header h2, .category h2').count();
    expect(headers).toBeGreaterThan(0);
  });

  test('All apps are present in A-Z view', async ({ page }) => {
    await page.selectOption('#sortModeSelect', 'az');
    await page.waitForTimeout(500);
    const names = await page.locator('.app-name').allTextContents();
    // The suite should have at least 30 apps
    expect(names.length).toBeGreaterThanOrEqual(30);
  });
});

test.describe('Launcher app cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('suite_logged_in', '1');
    });
    await page.goto(`file://${process.cwd()}/index.html`);
    await page.waitForSelector('.app-name', { timeout: 15000 });
  });

  test('each app card has a visible name', async ({ page }) => {
    const names = await page.locator('.app-name').allTextContents();
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
  });

  test('clear recent button is visible', async ({ page }) => {
    await expect(page.locator('#clearRecentBtn')).toBeVisible();
  });
});
