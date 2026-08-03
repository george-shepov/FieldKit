const { test, expect } = require('@playwright/test');

test.describe('FieldKit launcher catalog', () => {
  test('all launchable apps load without runtime errors', async ({ browser }) => {
    test.setTimeout(180000);

    const context = await browser.newContext();
    const catalog = await context.newPage();
    await catalog.goto(`file://${process.cwd()}/index.html`);
    await catalog.waitForTimeout(1200);

    const launchLinks = await catalog.locator('a[href]').evaluateAll((anchors) => (
      anchors
        .filter((anchor) => anchor.textContent.includes('Launch'))
        .map((anchor) => anchor.href)
    ));

    expect(launchLinks).toHaveLength(60);

    const failures = [];
    for (const target of launchLinks) {
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];
      const failedRequests = [];

      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        if (['document', 'script', 'wasm'].includes(request.resourceType())) {
          failedRequests.push(`${request.resourceType()}: ${request.url()}`);
        }
      });

      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(300);
        const bodyText = await page.locator('body').innerText();
        if (!bodyText.trim()) failures.push({ target, reason: 'blank body' });
        if (pageErrors.length || consoleErrors.length || failedRequests.length) {
          failures.push({ target, pageErrors, consoleErrors, failedRequests });
        }
      } catch (error) {
        failures.push({ target, reason: error.message });
      } finally {
        await page.close();
      }
    }

    await context.close();
    expect(failures).toEqual([]);
  });
});
