/**
 * The model of a link over the World is outlined (`render/outline.ts`):
 * under the pointer, focused from the keyboard, or the page now open. The
 * link's own box stays invisible. `canvas.dataset.outline` lists the
 * models outlined.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, worldReady } from './world';

const outlined = (page: import('@playwright/test').Page) => page.locator('#world-canvas');

test('hovering or tabbing to a Landmark outlines its model, not its box', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'no pointer to hover with, nor keys to tab with');
  const errors = collectErrors(page);
  await page.goto('/?life=still');
  await worldReady(page);
  await expect(outlined(page)).toHaveAttribute('data-outline', '');

  const station = page.locator('a.hotspot[data-hotspot="station"]');
  const box = await station.boundingBox();
  if (!box) throw new Error('No Station hotspot on screen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(outlined(page)).toHaveAttribute('data-outline', 'landmark:station');
  // The box itself shows nothing: no outline, no tint.
  const look = await station.evaluate((a) => ({ outline: getComputedStyle(a).outlineStyle, background: getComputedStyle(a).backgroundColor }));
  expect(look).toEqual({ outline: 'none', background: 'rgba(0, 0, 0, 0)' });

  await page.mouse.move(2, box.y + box.height / 2);
  await expect(outlined(page)).toHaveAttribute('data-outline', '');

  // Tab until a Landmark's link has focus: its model is outlined while it keeps it.
  let key: string | undefined;
  for (let i = 0; i < 40 && !key; i++) {
    await page.keyboard.press('Tab');
    key = await page.evaluate(() => {
      const data = (document.activeElement as HTMLElement | null)?.dataset;
      if (!data?.hotspot) return undefined;
      return data.project ? `plant:${data.project}` : `landmark:${data.hotspot}`;
    });
  }
  if (!key) throw new Error('No hotspot took focus');
  await expect(outlined(page)).toHaveAttribute('data-outline', key);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('none');
  expect(errors).toEqual([]);
});

test('the open Project\'s plant and the developer on Team are outlined', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/garden/archive-search?life=still');
  await worldReady(page);
  await expect(outlined(page)).toHaveAttribute('data-outline', 'plant:archive-search');
  await page.goto('/about/team?life=still');
  await worldReady(page);
  await expect(outlined(page)).toHaveAttribute('data-outline', 'developer');
  expect(errors).toEqual([]);
});
