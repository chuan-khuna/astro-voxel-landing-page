/**
 * Ambient Life in the browser: with life on, the shared clock runs (the plants sway, leaves fall, boats
 * rock, butterflies, fireflies, snow and ash fly) in every Biome, by Day and at Night, and nothing logs an error; under reduced motion the clock stays frozen and the World never changes.
 */
import { expect, test } from '@playwright/test';
import { THEME_STORAGE_KEY } from '../src/lib/theme';
import { collectErrors, worldReady } from './world';

const clock = async (page: import('@playwright/test').Page) => Number(await page.locator('#world-canvas').getAttribute('data-clock'));

// One Seed per Biome: tropical, autumn, northern, volcanic.
for (const seed of ['harbour', 'seed-1', 'seed-2', 'seed-3']) {
  for (const theme of ['day', 'night'] as const) {
    test(`Ambient Life runs on the Garden of ${seed} by ${theme} with no errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.addInitScript(([key, t]) => localStorage.setItem(key, t), [THEME_STORAGE_KEY, theme] as const);
      await page.goto(`/garden?seed=${seed}&life=full`);
      await worldReady(page);
      const before = await clock(page);
      await expect.poll(() => clock(page), { timeout: 30_000 }).toBeGreaterThan(before + 0.5);
      expect(errors).toEqual([]);
    });
  }
}

test('under reduced motion nothing sways, falls or rocks', async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The Dock: boats, Decoration and the Garden's trees nearby; `life=full` would run if motion were allowed.
  await page.goto('/dock?seed=harbour&life=full');
  await worldReady(page);
  const canvas = page.locator('#world-canvas');
  await expect(canvas).toHaveAttribute('data-life', 'still');
  const first = await canvas.screenshot();
  await page.waitForTimeout(2000);
  expect(await clock(page)).toBe(0);
  expect((await canvas.screenshot()).equals(first)).toBe(true);
  expect(errors).toEqual([]);
});
