/**
 * Leaving the open House (`render/houseLeave.ts`): zooming back out past the
 * House's own close-up, or panning it off screen, closes About or Team as
 * its close button does. The lid comes down, the developer's link hides,
 * the URL goes back to the World and the camera stays where the visitor
 * took it. On a phone the Story Scroll moves the lid (`phone-scroll.spec.ts`).
 */
import { expect, test, type Page } from '@playwright/test';
import { camera, collectErrors, restingCamera, worldReady } from './world';

const path = (page: Page) => new URL(page.url()).pathname.replace(/\/$/, '') || '/';
const canvas = (page: Page) => page.locator('#world-canvas');
const developer = (page: Page) => page.locator('a[data-developer]');

test.skip(({ isMobile }) => isMobile, 'The Story Scroll takes no pan or zoom: scrolling past About and Team shuts the House');

test('zooming out of the open House closes Team, and the camera stays put', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/about/team?life=still');
  await worldReady(page);
  await expect(canvas(page)).toHaveAttribute('data-interior', 'open');
  await expect(developer(page)).toBeVisible();
  const inside = await restingCamera(page);
  const box = (await page.locator('#world-frame').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // A little zoom out stays in the House.
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await camera(page)).zoom).toBeLessThan(inside.zoom);
  expect(path(page)).toBe('/about/team');
  await expect(canvas(page)).toHaveAttribute('data-interior', 'open');

  // Further out than the House's own close-up: Team closes and the lid comes down.
  for (let i = 0; i < 6 && path(page) !== '/'; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(150);
  }
  await expect.poll(() => path(page)).toBe('/');
  await expect(canvas(page)).toHaveAttribute('data-interior', 'shut');
  await expect(developer(page)).toBeHidden();
  // No flight back out to the Overview: the camera rests where the wheel left it.
  const left = await camera(page);
  const rest = await restingCamera(page);
  expect(rest.zoom).toBeGreaterThan(1.5);
  expect(Math.abs(rest.zoom - left.zoom)).toBeLessThan(0.01);

  // Back opens Team again, and the House with it.
  await page.goBack();
  await expect.poll(() => path(page)).toBe('/about/team');
  await expect(canvas(page)).toHaveAttribute('data-interior', 'open');
  expect(errors).toEqual([]);
});

test('panning the open House off screen closes About', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/about?life=still');
  await worldReady(page);
  await expect(canvas(page)).toHaveAttribute('data-interior', 'open');
  await restingCamera(page);
  const box = (await page.locator('#world-frame').boundingBox())!;
  // Drag leftwards, clear of the panel at the right: the House slides off the left edge.
  for (let i = 0; i < 4 && path(page) !== '/'; i++) {
    await page.mouse.move(box.x + box.width - 480, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
  }
  await expect.poll(() => path(page)).toBe('/');
  await expect(canvas(page)).toHaveAttribute('data-interior', 'shut');
  expect(errors).toEqual([]);
});

test('a zoom out while the camera is still diving into the House keeps About open', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/?life=still');
  await worldReady(page);
  await restingCamera(page);
  await page.locator('#landmark-list a[data-landmark="house"]').evaluate((a: HTMLAnchorElement) => a.click());
  await expect.poll(() => path(page)).toBe('/about');
  // Stopped early in its dive, far outside the House: that is not leaving it.
  const box = (await page.locator('#world-frame').boundingBox())!;
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(1500);
  expect(path(page)).toBe('/about');
  await expect(canvas(page)).toHaveAttribute('data-interior', 'open');
  expect(errors).toEqual([]);
});
