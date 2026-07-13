const { test, expect } = require('@playwright/test');

const APP_PATH = 'drivers-license/index.html';
const PRIVATE_MODE = {
  mode: 'offline_private',
  allowSync: false,
  allowSupport: false,
  allowAI: false,
  managedEndpoint: '',
  customEndpoint: ''
};

async function readDeckCount(page) {
  const text = (await page.locator('#cardProgress').textContent()) || '';
  const match = text.match(/\/\s*(\d+)\s+cards/i);
  return match ? Number(match[1]) : 0;
}

async function waitForCompleteDeck(page) {
  await expect.poll(
    () => readDeckCount(page),
    { message: 'Driver-license deck should finish loading its manual digest cards' }
  ).toBeGreaterThanOrEqual(150);
  return readDeckCount(page);
}

async function selectLanguage(page, language) {
  await page.selectOption('#langSelect', language);
  return waitForCompleteDeck(page);
}

test.describe('Driver License multilingual decks', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((config) => {
      localStorage.setItem('suite.privacy.mode.v1', JSON.stringify(config));
    }, PRIVATE_MODE);

    await page.goto(APP_PATH);
    await expect(page.locator('#langSelect')).toBeVisible();
    await waitForCompleteDeck(page);
  });

  test('English and Russian contain the same complete question bank', async ({ page }) => {
    const englishCount = await selectLanguage(page, 'en');
    const russianCount = await selectLanguage(page, 'ru');

    expect(englishCount).toBeGreaterThanOrEqual(150);
    expect(russianCount).toBe(englishCount);
  });

  test('Russian flashcards use a recall prompt instead of repeating the answer', async ({ page }) => {
    await selectLanguage(page, 'ru');
    await page.locator('.tab[data-tab="cards"]').click();

    // Move beyond the opening cards and validate the expanded bank. A valid
    // recall card may be authored as a direct question or generated as cloze.
    for (let index = 0; index < 8; index += 1) {
      await page.locator('#cardNext').click();
    }

    const front = ((await page.locator('#cardFront').textContent()) || '').trim();
    const back = ((await page.locator('#cardBack').textContent()) || '').trim();
    const isRecallPrompt = front.includes('______') || /[?？]$/.test(front);

    expect(front.length).toBeGreaterThan(10);
    expect(back.length).toBeGreaterThan(1);
    expect(front).not.toBe(back);
    expect(isRecallPrompt).toBe(true);

    await page.locator('#cardFlip').click();
    await expect(page.locator('#flashcard')).toHaveClass(/flipped/);
  });

  test('question-and-answer mode presents distinct Russian questions and answers', async ({ page }) => {
    await selectLanguage(page, 'ru');
    await page.locator('.tab[data-tab="qa"]').click();

    const question = ((await page.locator('#qaQuestion').textContent()) || '').trim();
    const answer = ((await page.locator('#qaAnswer').textContent()) || '')
      .replace(/^Answer:\s*/i, '')
      .trim();

    expect(question.length).toBeGreaterThan(10);
    expect(answer.length).toBeGreaterThan(1);
    expect(question).not.toBe(answer);
    await expect(page.locator('#qaOptions .qa-option')).toHaveCount(4);
  });
});
