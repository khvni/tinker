import { test, expect, type Page } from '@playwright/test';
import { compareSnapshot } from './compare.js';

const waitForAppReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => document.documentElement.dataset['appReady'] === 'true',
    null,
    { timeout: 20_000 },
  );
  await page.evaluate(() => document.fonts.ready);
};

const captureAndCompare = async (page: Page, name: string): Promise<void> => {
  const buffer = await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide' });
  const result = compareSnapshot(name, buffer);

  switch (result.status) {
    case 'seeded':
      // eslint-disable-next-line no-console
      console.warn(`[visual] Seeded baseline for "${name}" at ${result.baselinePath}. Commit it.`);
      return;
    case 'updated':
      // eslint-disable-next-line no-console
      console.warn(`[visual] Updated baseline for "${name}" at ${result.baselinePath}.`);
      return;
    case 'match':
      return;
    case 'drift':
      expect(result.driftRatio, result.message).toBeLessThanOrEqual(0.02);
  }
};

test.describe('memory pane', () => {
  test('memory: opens from sidebar and renders', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.click('[aria-label="Memory"]');
    await page.waitForSelector('text=Memory files', { timeout: 5_000 });
    await captureAndCompare(page, 'memory-pane');
  });
});
