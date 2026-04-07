const { test, expect } = require('@playwright/test');

const appUrl = (app) => `file://${process.cwd()}/${app}/index.html`;

test.describe('Clock App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('clock'));
    await expect(page.locator('.time')).toBeVisible();
    await expect(page.locator('.date')).toBeVisible();
    await expect(page.locator('#alarmTime')).toBeVisible();
    await expect(page.locator('#setAlarmBtn')).toBeVisible();
    await expect(page.locator('#timerMin')).toBeVisible();
    await expect(page.locator('#timerStartBtn')).toBeVisible();
    await expect(page.locator('#swStartBtn')).toBeVisible();
  });

  test('should set and clear alarm', async ({ page }) => {
    await page.goto(appUrl('clock'));
    await page.fill('#alarmTime', '12:00');
    await page.click('#setAlarmBtn');
    await expect(page.locator('#clearAlarmBtn')).toBeVisible();
    await page.click('#clearAlarmBtn');
  });

  test('should start and reset timer', async ({ page }) => {
    await page.goto(appUrl('clock'));
    await page.fill('#timerMin', '1');
    await page.click('#timerStartBtn');
    await expect(page.locator('#timerPauseBtn')).toBeVisible();
    await page.click('#timerResetBtn');
  });

  test('should start and lap stopwatch', async ({ page }) => {
    await page.goto(appUrl('clock'));
    await page.click('#swStartBtn');
    await expect(page.locator('#swPauseBtn')).toBeVisible();
    await page.click('#swLapBtn');
    await expect(page.locator('.lap')).toBeVisible();
  });
});

test.describe('Pomodoro App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('pomodoro'));
    await expect(page.locator('#timer')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#workMins')).toBeVisible();
    await expect(page.locator('#breakMins')).toBeVisible();
  });

  test('should start and pause timer', async ({ page }) => {
    await page.goto(appUrl('pomodoro'));
    await page.click('#startBtn');
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await page.click('#pauseBtn');
    await expect(page.locator('#startBtn')).toBeVisible();
  });
});

test.describe('Tic-Tac-Toe App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('tic-tac-toe'));
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#undoBtn')).toBeVisible();
    await expect(page.locator('#boardSize')).toBeVisible();
  });

  test('should make a move', async ({ page }) => {
    await page.goto(appUrl('tic-tac-toe'));
    const cells = page.locator('.cell');
    const count = await cells.count();
    if (count > 0) {
      await cells.nth(0).click();
    }
  });
});

test.describe('Snake Game', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('snake'));
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await expect(page.locator('canvas')).toBeVisible();
  });
});

test.describe('Battleship Game', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('battleship'));
    await expect(page.locator('#playerGrid')).toBeVisible();
    await expect(page.locator('#enemyGrid')).toBeVisible();
    await expect(page.locator('#restartBtn')).toBeVisible();
  });

  test('should start new game', async ({ page }) => {
    await page.goto(appUrl('battleship'));
    await page.click('#restartBtn');
  });
});

test.describe('Inventory App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('inventory'));
    await expect(page.locator('#sku')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#category')).toBeVisible();
    await expect(page.locator('#qty')).toBeVisible();
    await expect(page.locator('#price')).toBeVisible();
    await expect(page.locator('#saveBtn')).toBeVisible();
    await expect(page.locator('#clearFormBtn')).toBeVisible();
  });
});

test.describe('Kanban App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('kanban'));
    await expect(page.locator('#list-todo')).toBeVisible();
    await expect(page.locator('#list-doing')).toBeVisible();
    await expect(page.locator('#list-done')).toBeVisible();
  });
});

test.describe('Snippet Board App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('snippet-board'));
    await expect(page.locator('#new-title')).toBeVisible();
    await expect(page.locator('#new-content')).toBeVisible();
    await expect(page.locator('#add-snippet')).toBeVisible();
  });
});

test.describe('Math Raindrops Game', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('math-raindrops'));
    await expect(page.locator('#field')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await expect(page.locator('#modeInputBtn')).toBeVisible();
    await expect(page.locator('#modeMCBtn')).toBeVisible();
  });
});

test.describe('Receipt Tracker', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('receipt-tracker'));
    await expect(page.locator('#fileInput')).toBeVisible();
    await expect(page.locator('#manualEntryCard')).toBeVisible();
    await expect(page.locator('#exportCsvBtn')).toBeVisible();
  });
});

test.describe('Acronym List', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('acronym-list'));
    await expect(page.locator('input[type="search"], #search, input[type="text"]').first()).toBeVisible();
  });
});

test.describe('Habit Tracker', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('habit-tracker'));
    await expect(page.locator('button, input').first()).toBeVisible();
  });
});

test.describe('Time Tracker', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('time-tracker'));
    await expect(page.locator('button, input').first()).toBeVisible();
  });
});

test.describe('Music Player', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('music-player'));
    await expect(page.locator('button, input, audio').first()).toBeVisible();
  });
});

test.describe('Light Messenger', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('light-messenger'));
    await expect(page.locator('#txStart')).toBeVisible();
    await expect(page.locator('#txStop')).toBeVisible();
  });
});

test.describe('MIDI Note Helper', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('midi-note-helper'));
    await expect(page.locator('button, input, select').first()).toBeVisible();
  });
});

test.describe('Odd One Out', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('odd-one-out'));
    await expect(page.locator('button, .game, #start').first()).toBeVisible();
  });
});

test.describe('Pattern Mirror', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('pattern-mirror'));
    await expect(page.locator('button, canvas, #start').first()).toBeVisible();
  });
});

test.describe('Music Trainer', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('music-trainer'));
    await expect(page.locator('button, input, select').first()).toBeVisible();
  });
});

test.describe('Math Trainer', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('math-trainer'));
    await expect(page.locator('button, input, #start').first()).toBeVisible();
  });
});

test.describe('Employee Skills', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('employee-skills'));
    await expect(page.locator('table')).toBeVisible();
  });
});

test.describe('Field Checkin', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('field-checkin'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('Image Rater', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('image-rater'));
    await expect(page.locator('button, input, #upload').first()).toBeVisible();
  });
});

test.describe('Wishlist', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('wishlist'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('Support', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('support'));
    await expect(page.locator('button, form, #submit').first()).toBeVisible();
  });
});

test.describe('Profile', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('profile'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('UI Tweaker', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('ui-tweaker'));
    await expect(page.locator('button, input, select').first()).toBeVisible();
  });
});

test.describe('Positive IQ', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('positive-iq'));
    await expect(page.locator('button, .game, #start').first()).toBeVisible();
  });
});

test.describe('Outdoor Kit', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('outdoor-kit'));
    await expect(page.locator('button, input, .item').first()).toBeVisible();
  });
});

test.describe('Audio Notes', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('audio-notes'));
    await expect(page.locator('button, input, audio').first()).toBeVisible();
  });
});

test.describe('First Aid', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('first-aid'));
    await expect(page.locator('button, input, #search').first()).toBeVisible();
  });
});

test.describe('Linux Trainer', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('linux-trainer'));
    await expect(page.locator('button, input, #start').first()).toBeVisible();
  });
});

test.describe('Drivers License', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('drivers-license'));
    await expect(page.locator('button, input, select').first()).toBeVisible();
  });
});

test.describe('Gigtax', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('gigtax'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('Legal Library', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('legal-library'));
    await expect(page.locator('button, input, #search').first()).toBeVisible();
  });
});

test.describe('JS Trainer', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('js-trainer'));
    await expect(page.locator('button, input, #start').first()).toBeVisible();
  });
});

test.describe('Authority Assistant', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('authority-assistant'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('Docketpro', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('docketpro'));
    await expect(page.locator('button, input, form').first()).toBeVisible();
  });
});

test.describe('Accent Speaker', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('accent-speaker'));
    await expect(page.locator('button, input, select').first()).toBeVisible();
  });
});

test.describe('Privacy Camera', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('privacy-camera'));
    await expect(page.locator('button, video, #start').first()).toBeVisible();
  });
});

test.describe('Privacy Recorder', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('privacy-recorder'));
    await expect(page.locator('button, audio, #record').first()).toBeVisible();
  });
});

test.describe('Help App', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('help'));
    await expect(page.locator('button, input, #search').first()).toBeVisible();
  });
});

test.describe('CNS TAP Test', () => {
  test('should load and have essential elements', async ({ page }) => {
    await page.goto(appUrl('cns-tap-test'));
    await expect(page.locator('button, input, #start').first()).toBeVisible();
  });
});
