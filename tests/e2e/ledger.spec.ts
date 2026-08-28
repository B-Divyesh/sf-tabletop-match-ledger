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

test('opens from its installed cache while offline', async ({ page, context }) => {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
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
