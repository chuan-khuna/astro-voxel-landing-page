/**
 * Ambient Life in the browser: with life on, the shared clock runs (the plants sway, leaves fall, boats
 * rock, butterflies, fireflies, snow and ash fly, clouds drift, surf breaks, fish swim, animals walk and birds or bats fly) in every Biome, by Day and at Night, and nothing logs an error; under reduced motion the clock stays frozen and the World never changes. Clouds show at the Overview and are gone in a close-up. The fish, animals and birds follow the life tier (and the animals and birds the theme).
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

test('clouds show over the sea at the Overview and are gone in a Landmark\'s close-up', async ({ page }, info) => {
  const errors = collectErrors(page);
  const canvas = page.locator('#world-canvas');
  // Phones never show the Overview (the Story Scroll starts at the Station): only the close-up is checked there.
  if (info.project.name === 'desktop') {
    await page.goto('/?seed=harbour&life=full');
    await worldReady(page);
    await expect(canvas).toHaveAttribute('data-clouds', '1.00');
  }
  await page.goto('/garden?seed=harbour&life=full');
  await worldReady(page);
  await expect(canvas).toHaveAttribute('data-clouds', '0.00');
  expect(errors).toEqual([]);
});

test('the fish swim in every World, as many schools as the life tier allows', async ({ page }) => {
  const errors = collectErrors(page);
  const canvas = page.locator('#world-canvas');
  const fish = async () => Number(await canvas.getAttribute('data-fish'));
  await page.goto('/dock?seed=harbour&life=full');
  await worldReady(page);
  const all = await fish();
  expect(all).toBeGreaterThan(0);
  await page.goto('/dock?seed=harbour&life=reduced');
  await worldReady(page);
  const reduced = await fish();
  expect(reduced).toBeGreaterThan(0);
  expect(reduced).toBeLessThan(all);
  expect(errors).toEqual([]);
});

test('land animals walk and birds fly by Day, bats at Night where the Biome has them, as many as the life tier allows', async ({ page }) => {
  const errors = collectErrors(page);
  const canvas = page.locator('#world-canvas');
  const count = async (what: 'animals' | 'birds') => Number(await canvas.getAttribute(`data-${what}`));
  const open = async (seed: string, theme: 'day' | 'night', life: string) => {
    await page.addInitScript(([key, t]) => localStorage.setItem(key, t), [THEME_STORAGE_KEY, theme] as const);
    await page.goto(`/dock?seed=${seed}&life=${life}`);
    await worldReady(page);
  };
  // Tropical (harbour) by Day: junglefowl and seabirds; at Night neither.
  await open('harbour', 'day', 'full');
  const animals = await count('animals');
  expect(animals).toBeGreaterThan(0);
  expect(await count('birds')).toBeGreaterThan(0);
  await open('seed-1', 'day', 'reduced');
  const reduced = await count('animals');
  await open('seed-1', 'day', 'full');
  expect(reduced).toBeGreaterThan(0);
  expect(reduced).toBeLessThan(await count('animals'));
  // Autumn (seed-1) at Night: the squirrels rest out of sight and bats fly.
  await open('seed-1', 'night', 'full');
  expect(await count('animals')).toBe(0);
  expect(await count('birds')).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
