const { test, expect } = require('@playwright/test');

const appUrl = (app) => `file://${process.cwd()}/${app}/index.html`;

test.describe('Marketing Demo - Clock App', () => {
  test('alarm timer stopwatch showcase', async ({ page }) => {
    await page.goto(appUrl('clock'));
    await page.waitForLoadState('domcontentloaded');
    
    // Set alarm
    await page.fill('#alarmTime', '07:00');
    await page.click('#setAlarmBtn');
    await page.waitForTimeout(500);
    
    // Timer demo
    await page.fill('#timerMin', '5');
    await page.click('#timerStartBtn');
    await page.waitForTimeout(800);
    await page.click('#timerPauseBtn');
    await page.waitForTimeout(500);
    
    // Stopwatch demo
    await page.click('#swStartBtn');
    await page.waitForTimeout(1000);
    await page.click('#swLapBtn');
    await page.waitForTimeout(500);
    await page.click('#swPauseBtn');
  });
});

test.describe('Marketing Demo - Pomodoro', () => {
  test('pomodoro timer flow', async ({ page }) => {
    await page.goto(appUrl('pomodoro'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    
    // Start work timer
    await page.click('#startBtn');
    await page.waitForTimeout(1500);
    await page.click('#pauseBtn');
    await page.waitForTimeout(500);
  });
});

test.describe('Marketing Demo - Games', () => {
  test('tic-tac-toe quick game', async ({ page }) => {
    await page.goto(appUrl('tic-tac-toe'));
    await page.waitForLoadState('domcontentloaded');
    
    // Click several cells to show gameplay
    const cells = page.locator('.cell');
    await cells.nth(0).click();
    await page.waitForTimeout(300);
    await cells.nth(4).click();
    await page.waitForTimeout(300);
    await cells.nth(1).click();
  });
  
  test('battleship action', async ({ page }) => {
    await page.goto(appUrl('battleship'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.click('#restartBtn');
    await page.waitForTimeout(500);
  });
});

test.describe('Marketing Demo - Productivity', () => {
  test('kanban board', async ({ page }) => {
    await page.goto(appUrl('kanban'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });
  
  test('inventory app', async ({ page }) => {
    await page.goto(appUrl('inventory'));
    await page.waitForLoadState('domcontentloaded');
    await page.fill('#name', 'Sample Product');
    await page.fill('#sku', 'SKU-001');
    await page.fill('#qty', '100');
    await page.fill('#price', '29.99');
  });
  
  test('receipt tracker', async ({ page }) => {
    await page.goto(appUrl('receipt-tracker'));
    await page.waitForLoadState('domcontentloaded');
  });
});
