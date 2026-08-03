const { test, expect } = require('@playwright/test');
const fs = require('fs');
const http = require('http');
const path = require('path');

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.pdf': 'application/pdf',
};

const startStaticServer = () => new Promise((resolve, reject) => {
  const root = process.cwd();
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = path.resolve(root, `.${requestPath}`);
    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const resolvedPath = requestPath.endsWith('/') ? path.join(filePath, 'index.html') : filePath;
    fs.readFile(resolvedPath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(resolvedPath)] || 'text/plain' });
      response.end(data);
    });
  });
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

test.describe('FieldKit launcher catalog', () => {
  test('all launchable apps load without runtime errors', async ({ browser }) => {
    test.setTimeout(180000);

    const server = await startStaticServer();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const context = await browser.newContext();
    const catalog = await context.newPage();
    await catalog.goto(`${baseUrl}/index.html`);
    await expect(catalog.locator('a.app-item')).toHaveCount(60);

    const launchLinks = await catalog.locator('a.app-item').evaluateAll((anchors) => (
      anchors
        .map((anchor) => anchor.href)
    ));

    expect(launchLinks).toHaveLength(60);

    const failures = [];
    for (const target of launchLinks) {
      const page = await context.newPage();
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
          consoleErrors.push(message.text());
        }
      });

      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await expect(page.locator('body')).toBeVisible();
        await page.waitForTimeout(300);
        const bodyText = await page.locator('body').innerText();
        if (!bodyText.trim()) failures.push({ target, reason: 'blank body' });
        if (pageErrors.length || consoleErrors.length) {
          failures.push({ target, pageErrors, consoleErrors });
        }
      } catch (error) {
        failures.push({ target, reason: error.message });
      } finally {
        await page.close();
      }
    }

    await context.close();
    await new Promise((resolve) => server.close(resolve));
    expect(failures).toEqual([]);
  });
});
