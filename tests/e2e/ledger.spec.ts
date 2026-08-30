import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('tabletop-match-ledger');
    localStorage.clear();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Track every tabletop round.' })).toBeVisible();
});

test('@claim:score-ledger starts a match, wraps the track, undoes, and survives reload', async ({ page }) => {
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

test('@claim:accessible-interface has no serious accessibility violations in setup and match views', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to match ledger' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transitionSeconds = await page.locator('.button').first().evaluate(element => Number.parseFloat(getComputedStyle(element).transitionDuration));
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  let results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('keeps legal and not-found pages semantic and free of serious accessibility errors', async ({ page }) => {
  for (const path of ['/privacy/', '/terms/', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  }
});

test('@claim:offline-reload opens from a fully precached shell while offline with HTTP cache disabled', async ({ browser }) => {
  const offlineContext = await browser.newContext();
  let offlinePage = await offlineContext.newPage();
  try {
    let cdp = await offlineContext.newCDPSession(offlinePage);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await offlinePage.goto('http://127.0.0.1:4173/');
    await offlinePage.waitForFunction(() => navigator.serviceWorker?.controller !== null);
    await offlinePage.waitForFunction(async () => {
      const cachesForApp = await caches.keys();
      const requests = await Promise.all(cachesForApp.map(async cacheName => (await caches.open(cacheName)).keys()));
      return requests.flat().some(request => /\/assets\/main-.*\.js$/.test(request.url)) && requests.flat().some(request => /\/assets\/main-.*\.css$/.test(request.url));
    });
    await offlinePage.close();
    await offlineContext.setOffline(true);
    offlinePage = await offlineContext.newPage();
    cdp = await offlineContext.newCDPSession(offlinePage);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const failedRequests: string[] = [];
    offlinePage.on('requestfailed', request => failedRequests.push(request.url()));
    await offlinePage.goto('http://127.0.0.1:4173/');
    await expect(offlinePage.getByRole('heading', { name: 'Track every tabletop round.' })).toBeVisible();
    await expect(offlinePage.locator('#connection')).toContainText('Offline');
    expect(failedRequests.filter(url => /\/assets\/main-.*\.(?:js|css)$/.test(url))).toEqual([]);
  } finally {
    await offlineContext.close();
  }
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
  await expect(page.getByRole('heading', { name: 'Track every tabletop round.' })).toBeVisible();
  await page.getByLabel('Target score optional').fill('50');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await expect(page.locator('#setup-error')).toHaveText('Rounds must be a whole number between 1 and 999.');
});

test('rejects a malformed imported event without replacing the current match', async ({ page }) => {
  await page.getByLabel('Player 1').fill('Ada');
  await page.getByLabel('Player 2').fill('Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await page.getByRole('button', { name: 'Open match options' }).click();
  const invalidLedger = {
    version: 1, id: 'bad-import', title: 'Bad import', createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z', status: 'active', trackLength: 100, target: null, maxRounds: null,
    players: [{ id: 'a', name: 'Ada', color: '#fff' }, { id: 'b', name: 'Bea', color: '#000' }],
    events: [{ id: 'broken-event', kind: 'round', round: 1, note: '', createdAt: '2026-08-28T00:00:00.000Z' }]
  };
  await page.locator('#import-file').setInputFiles({ name: 'broken.ledger.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidLedger)) });
  await expect(page.locator('#toast')).toContainText('The imported event scores are invalid.');
  await expect(page.getByRole('heading', { name: "Tonight's match" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bad import' })).toHaveCount(0);
  await expect(page.locator('#toast')).not.toContainText('Cannot read properties');
});

test('@claim:lan-sync pairs two local devices and mirrors a newly committed score', async ({ page, browser }) => {
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
    const adaCard = joiningPage.locator('.score-card').filter({ has: joiningPage.getByRole('heading', { name: 'Ada' }) });
    await expect(adaCard.locator('.total strong')).toHaveText('12', { timeout: 10_000 });
  } finally {
    await joiningContext.close();
  }
});

test('@claim:demo-sandbox keeps sample data separate from a real ledger', async ({ page }) => {
  await page.getByLabel('Player 1').fill('Real Ada');
  await page.getByLabel('Player 2').fill('Real Bea');
  await page.getByRole('button', { name: 'Start the ledger' }).click();
  await expect(page.getByRole('heading', { name: "Tonight's match" })).toBeVisible();

  await page.goto('/?demo=1');
  await expect(page.getByText('Demo — sample data, nothing is saved to your ledger')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sunday strategy table' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cal' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('155', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { name: "Tonight's match" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Real Ada' })).toBeVisible();
});

test('@claim:data-export exports valid JSON and one CSV row per sample event', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByRole('button', { name: 'Open match options' }).click();
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const jsonPath = await (await jsonDownload).path();
  expect(jsonPath).not.toBeNull();
  const ledger = JSON.parse(await readFile(jsonPath!, 'utf8')) as { events: unknown[] };
  expect(ledger.events).toHaveLength(3);

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csvPath = await (await csvDownload).path();
  expect(csvPath).not.toBeNull();
  const rows = (await readFile(csvPath!, 'utf8')).trim().split('\n');
  expect(rows).toHaveLength(4);
  expect(rows[0]).toContain('"Ada"');
});

test('@claim:local-data sends no score data to another origin during the demo flow', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/?demo=1');
  await page.locator('#round-form').getByLabel('Ada', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Commit round 3' }).click();
  await expect(page.getByText('164', { exact: true })).toBeVisible();
  expect(requests.filter(url => new URL(url).origin !== 'http://127.0.0.1:4173')).toEqual([]);
});
