const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'file://' + process.cwd(),
    trace: 'on-first-retry',
    headless: false,  // Show browser
    viewport: { width: 1400, height: 900 },
    actionTimeout: 10000,
  },
  timeout: 60000,
});
