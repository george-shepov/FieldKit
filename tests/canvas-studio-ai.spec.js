const { test, expect } = require('@playwright/test');

const appUrl = () => `file://${process.cwd()}/canvas-studio/index.html`;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYGD4z8DAwMDAxAADAAoAAf8CBdoAAAAASUVORK5CYII=',
  'base64'
);

test.describe('Canvas Studio AI background removal', () => {
  test('loads the AI cutout workflow and enables it for an image layer', async ({ page }) => {
    await page.goto(appUrl());

    await expect(page.locator('#editorCanvas')).toBeAttached();
    await page.locator('[data-panel="background"]').click();
    await expect(page.locator('#aiRemoveBackgroundBtn')).toBeVisible();
    await expect(page.locator('#aiRemoveBackgroundBtn')).toBeDisabled();
    await expect(page.locator('#aiBackgroundStatus')).toContainText('First use downloads');
    await expect(page.locator('[data-panel-content="background"] .section-title h3').nth(1)).toHaveText('Color key');

    await page.locator('#fileInput').setInputFiles({
      name: 'tiny-test.png',
      mimeType: 'image/png',
      buffer: tinyPng
    });

    await expect(page.locator('#canvasFrame')).not.toHaveClass(/hidden/);
    await expect(page.locator('#aiRemoveBackgroundBtn')).toBeEnabled();
    await expect(page.locator('#backgroundEnabled')).toBeEnabled();
  });
});
