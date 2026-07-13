const { test, expect } = require('@playwright/test');

const rootUrl = `file://${process.cwd()}/index.html`;
const appUrl = (app) => `file://${process.cwd()}/${app}/index.html`;

test.describe('FieldKit App Explorer', () => {
  test('supports list, card, atlas, search, and details views', async ({ page }) => {
    await page.goto(rootUrl);
    await expect(page.locator('#fkExplorer')).toBeVisible({ timeout: 5000 });

    const rows = page.locator('.fk-file-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(20);

    await rows.nth(1).click();
    await expect(page.locator('#fkExplorerDetails h2')).toBeVisible();
    await expect(page.locator('#fkExplorerDetails .fk-open-button')).toBeVisible();

    await page.getByRole('button', { name: 'Detailed cards' }).click();
    await expect(page.locator('.fk-app-card').first()).toBeVisible();

    await page.getByRole('button', { name: 'Capability atlas' }).click();
    await expect(page.locator('.fk-atlas-core')).toBeVisible();
    await expect(page.locator('.fk-atlas-tag').first()).toBeVisible();

    await page.locator('#fkExplorerSearch').fill('legal');
    await expect(page.locator('#fkResultCount')).toContainText('apps');
    expect(await page.locator('.fk-atlas-app').count()).toBeGreaterThan(0);
  });

  test('uses compact icon actions on a phone and has no floating privacy obstruction', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(rootUrl);
    await expect(page.locator('#fkExplorer')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'File list' }).click();
    const firstRow = page.locator('.fk-file-row').first();
    await expect(firstRow).toBeVisible();

    const metaBadge = firstRow.locator('.fk-meta-badge').first();
    await expect(metaBadge).toBeVisible();
    const badgeBox = await metaBadge.boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(32);

    await expect(page.locator('.suite-privacy-fab')).toHaveCount(0);
    await expect(page.locator('[data-open-privacy]').first()).toBeVisible();
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
