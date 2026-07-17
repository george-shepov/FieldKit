const { test, expect } = require('@playwright/test');

const rootUrl = `file://${process.cwd()}/index.html`;
const appUrl = (app) => `file://${process.cwd()}/${app}/index.html`;
const PRIVATE_MODE = {
  mode: 'offline_private',
  allowSync: false,
  allowSupport: false,
  allowAI: false,
  managedEndpoint: '',
  customEndpoint: ''
};

test.describe('FieldKit App Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((config) => {
      localStorage.setItem('suite.privacy.mode.v1', JSON.stringify(config));
    }, PRIVATE_MODE);
  });

  test('supports category, tag, search, and theme filters', async ({ page }) => {
    await page.goto(rootUrl);
    await expect(page.locator('#fkAppLibrary')).toBeVisible({ timeout: 5000 });

    const apps = page.locator('.fk-library-app');
    await expect(apps.first()).toBeVisible();
    expect(await apps.count()).toBeGreaterThan(20);

    await page.locator('[data-action="category"][data-category="legal"]').click();
    await expect(apps.first()).toBeVisible();
    expect(await apps.count()).toBeGreaterThan(0);

    await page.locator('.fk-tag-cloud [data-action="tag"][data-tag="Legal"]').click();
    await expect(apps.first()).toBeVisible();

    await page.locator('#fkLibrarySearch').fill('library');
    await expect(apps.first()).toBeVisible();
    await expect(page.locator('.fk-library-summary')).toContainText('of');

    await page.locator('[data-action="theme-settings"]').click();
    await expect(page.locator('.fk-theme-settings')).toBeVisible();
    await expect(page.locator('[data-action="theme-settings"]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('uses compact icon actions on a phone and has no floating privacy obstruction', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(rootUrl);
    await expect(page.locator('#fkAppLibrary')).toBeVisible({ timeout: 5000 });

    const firstApp = page.locator('.fk-library-app').first();
    await expect(firstApp).toBeVisible();

    await firstApp.locator('[data-action="favorite"]').click();
    await page.locator('.fk-library-toolbar [data-action="favorites"]').click();
    await expect(page.locator('.fk-library-app')).toHaveCount(1);

    await expect(page.locator('.suite-privacy-fab')).toHaveCount(0);
    await expect(page.locator('.fk-library-toolbar [data-action="theme-settings"]')).toBeVisible();
  });
});

test.describe('Generalized Tic-Tac-Toe Layout', () => {
  test('keeps all 10x10 cells visible and compresses the scoreboard', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(appUrl('tic-tac-toe'));

    const board = page.locator('#board');
    const lastCell = page.locator('.cell').nth(99);
    const scoreboard = page.locator('#scoreboard');

    await expect(board).toBeVisible();
    await expect(page.locator('.cell')).toHaveCount(100);
    await expect(page.locator('body')).toHaveClass(/fk-tic-tac-toe/);

    await expect.poll(async () => board.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return Math.abs(rect.width - rect.height);
    })).toBeLessThanOrEqual(2);

    await expect.poll(async () => lastCell.evaluate((element) => {
      return element.getBoundingClientRect().bottom;
    })).toBeLessThanOrEqual(900);

    await expect.poll(async () => scoreboard.evaluate((element) => {
      return element.getBoundingClientRect().height;
    })).toBeLessThanOrEqual(70);

    const boardBox = await board.boundingBox();
    const lastCellBox = await lastCell.boundingBox();
    const scoreboardBox = await scoreboard.boundingBox();

    expect(boardBox).not.toBeNull();
    expect(lastCellBox).not.toBeNull();
    expect(scoreboardBox).not.toBeNull();
    expect(Math.abs((boardBox?.width ?? 0) - (boardBox?.height ?? Number.POSITIVE_INFINITY))).toBeLessThanOrEqual(2);
    expect((lastCellBox?.y ?? Number.POSITIVE_INFINITY) + (lastCellBox?.height ?? 0)).toBeLessThanOrEqual(900);
    expect(scoreboardBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(70);
    await expect(page.locator('.s-header')).toHaveCount(1);
    await expect(page.locator('.suite-privacy-fab')).toHaveCount(0);
  });
});
