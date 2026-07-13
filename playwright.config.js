const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'file://' + process.cwd(),
    trace: 'retain-on-failure',
    headless: Boolean(process.env.CI),
    viewport: { width: 1400, height: 900 },
    actionTimeout: 10000
  }
});
