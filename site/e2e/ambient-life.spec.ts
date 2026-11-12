/**
 * Ambient Life in the browser: with life on, the shared clock runs (the plants sway, leaves fall, boats
 * rock) and nothing logs an error; under reduced motion the clock stays frozen and the World never changes.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, worldReady } from './world';

const clock = async (page: import('@playwright/test').Page) => Number(await page.locator('#world-canvas').getAttribute('data-clock'));

for (const seed of ['harbour', 'seed-1']) {
  test(`Ambient Life runs on the Garden of ${seed} with no errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/garden?seed=${seed}&life=full`);
    await worldReady(page);
    const before = await clock(page);
    await expect.poll(() => clock(page), { timeout: 30_000 }).toBeGreaterThan(before + 0.5);
    expect(errors).toEqual([]);
  });
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
