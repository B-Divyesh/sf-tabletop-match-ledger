import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('tabletop-match-ledger');
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Scores that survive the next lap.' })).toBeVisible();
});

test('starts a match, wraps the track, undoes, and survives reload', async ({ page }) => {
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByLabel('Target score optional').fill('400');
  await page.getByRole('button', { name: 'Start the ledger' }).click();

  await page.locator('#round-form').getByLabel('Ada', { exact: true }).fill('237');
  await page.locator('#round-form').getByLabel('Bea', { exact: true }).fill('98');
  await page.getByRole('button', { name: 'Commit round 1' }).click();
  await expect(page.getByText('2 laps completed')).toBeVisible();
  await expect(page.getByText('37 / 100')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ada' })).toBeVisible();
  await expect(page.getByText('237', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Undo last entry/ }).click();
  await expect(page.getByText('0 laps completed').first()).toBeVisible();
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.getByText('Undo recorded')).toBeVisible();
  await expect(page.getByText(/· Undone$/)).toBeVisible();
});

test('has no serious accessibility violations in setup and match views', async ({ page }) => {
  let results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('opens from a fully precached shell while offline with HTTP cache disabled', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.waitForFunction(async () => {
    const cachesForApp = await caches.keys();
    const requests = await Promise.all(cachesForApp.map(async cacheName => (await caches.open(cacheName)).keys()));
    return requests.flat().some(request => /\/assets\/main-.*\.js$/.test(request.url)) && requests.flat().some(request => /\/assets\/main-.*\.css$/.test(request.url));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Scores that survive the next lap.' })).toBeVisible();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
});

test('loads and scores without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await page.locator('#round-form').getByLabel('Ada', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Commit round 1' }).click();
  expect(errors).toEqual([]);
  await expect(page.locator('h1')).toHaveCount(1);
});

test('announces invalid target and round settings without starting a match', async ({ page }) => {
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByLabel('Target score optional').fill('-5');
  await page.getByLabel('Rounds optional').fill('1.5');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await expect(page.locator('#setup-error')).toHaveText('Target score must be a whole number between 1 and 999,999.');
  await expect(page.getByRole('heading', { name: 'Scores that survive the next lap.' })).toBeVisible();
  await page.getByLabel('Target score optional').fill('50');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await expect(page.locator('#setup-error')).toHaveText('Rounds must be a whole number between 1 and 999.');
});

test('rejects a malformed imported event without replacing the current setup', async ({ page }) => {
  const invalidLedger = {
    version: 1, id: 'bad-import', title: 'Bad import', createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z', status: 'active', trackLength: 100, target: null, maxRounds: null,
    players: [{ id: 'a', name: 'Ada', color: '#fff' }, { id: 'b', name: 'Bea', color: '#000' }],
    events: [{ id: 'broken-event', kind: 'round', round: 1, scores: { a: 12 }, note: '', createdAt: '2026-08-28T00:00:00.000Z' }]
  };
  await page.locator('#import-file').setInputFiles({ name: 'broken.ledger.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidLedger)) });
  await expect(page.locator('#toast')).toContainText('The imported event scores are invalid.');
  await expect(page.getByRole('heading', { name: 'Scores that survive the next lap.' })).toBeVisible();
  await expect(page.locator('#toast')).not.toContainText('Cannot read properties');
});

test('pairs two local devices and mirrors a newly committed score', async ({ page, browser }) => {
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();

  const joiningContext = await browser.newContext();
  const joiningPage = await joiningContext.newPage();
  try {
    await joiningPage.goto('http://127.0.0.1:4173/');
    await page.getByRole('button', { name: 'Share table' }).click();
    await page.locator('#create-offer').click();
    await expect(page.locator('#offer-code')).not.toHaveValue('', { timeout: 10_000 });
    const offer = await page.locator('#offer-code').inputValue();
    await joiningPage.bringToFront();
    await joiningPage.getByRole('button', { name: 'Share table' }).click();
    await joiningPage.locator('#offer-input').fill(offer);
    await joiningPage.locator('#create-answer').click();
    await expect(joiningPage.locator('#answer-output')).not.toHaveValue('', { timeout: 10_000 });
    const answer = await joiningPage.locator('#answer-output').inputValue();
    await page.bringToFront();
    await page.locator('#answer-code').fill(answer);
    await page.locator('#accept-answer').click();
    await expect(joiningPage.getByRole('heading', { name: "Tonight's match" })).toBeVisible({ timeout: 15_000 });
    await page.locator('#round-form').getByLabel('Ada', { exact: true }).fill('12');
    await page.getByRole('button', { name: 'Commit round 1' }).click();
    await expect(joiningPage.getByText('12', { exact: true })).toBeVisible({ timeout: 10_000 });
  } finally {
    await joiningContext.close();
  }
});
