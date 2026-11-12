/**
 * The Story Scroll (polish 18): on a phone the site reads top to bottom over
 * the World and the camera follows the scroll from Landmark to Landmark,
 * never out to the Overview. Desktop keeps one panel over the World.
 */
import { expect, test, type Page } from '@playwright/test';
import { camera, collectErrors, restingCamera, worldReady, type Camera } from './world';

/** The sections of the Story Scroll in order, with where each starts on the page. */
async function sections(page: Page): Promise<Array<{ route: string; top: number }>> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-story-item]')].map((item) => ({
      route: item.dataset.route ?? '',
      top: Math.round(item.getBoundingClientRect().top + window.scrollY),
    })),
  );
}

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
}

const path = (page: Page) => new URL(page.url()).pathname.replace(/\/$/, '') || '/';
const same = (a: Camera, b: Camera) => Math.abs(a.x - b.x) < 0.02 && Math.abs(a.z - b.z) < 0.02 && Math.abs(a.zoom - b.zoom) < 0.01;

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'The Story Scroll is for phones');

  test('scrolling top to bottom visits every section close up, and the URL follows', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/?life=still');
    await worldReady(page);
    const stops = await sections(page);
    expect(stops.map((s) => s.route)).toEqual(['/', '/services', '/about', '/about/team', '/garden', '/dock', '/contact']);
    let previous: Camera | null = null;
    for (const [i, stop] of stops.entries()) {
      // Half-way to this section the camera is on its way, never out at the Overview (zoom 1).
      if (i > 0) {
        await scrollTo(page, Math.round((stops[i - 1]!.top + stop.top) / 2));
        await page.waitForTimeout(300);
        expect((await camera(page)).zoom).toBeGreaterThan(1.5);
      }
      await scrollTo(page, stop.top);
      const here = await restingCamera(page);
      expect(here.zoom).toBeGreaterThan(1.5);
      expect(path(page)).toBe(stop.route);
      if (previous && stop.route !== '/about/team') expect(same(here, previous)).toBe(false);
      // About and Team open the House; elsewhere it is shut.
      const interior = await page.locator('#world-canvas').getAttribute('data-interior');
      expect(interior).toBe(stop.route.startsWith('/about') ? 'open' : 'shut');
      previous = here;
    }
    expect(errors).toEqual([]);
  });

  test('a deep link opens at its section with the camera there; menu, Back and Forward scroll', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/dock?life=still');
    await worldReady(page);
    const stops = await sections(page);
    const dock = stops.find((s) => s.route === '/dock')!;
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(dock.top);
    const atDock = await restingCamera(page);
    expect(atDock.zoom).toBeGreaterThan(1.5);

    await page.getByRole('button', { name: 'Menu' }).tap();
    await page.locator('#landmark-list a[data-landmark="station"]').tap();
    await expect.poll(() => path(page)).toBe('/services');
    const services = stops.find((s) => s.route === '/services')!;
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(services.top);
    await expect(page.locator('#landmark-list a[aria-current="page"]')).toHaveAttribute('data-landmark', 'station');

    await page.goBack();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(dock.top);
    expect(path(page)).toBe('/dock');
    expect(same(await restingCamera(page), atDock)).toBe(true);

    await page.goForward();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(services.top);
    expect(path(page)).toBe('/services');
    expect(errors).toEqual([]);
  });

  test('a swipe on the World scrolls the page and never pans it', async ({ page, context }) => {
    await page.goto('/?life=still');
    await worldReady(page);
    const before = await restingCamera(page);
    const cdp = await context.newCDPSession(page);
    const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }],
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // Sideways over the World: nothing moves.
    await swipe({ x: 320, y: 300 }, { x: 120, y: 300 });
    await page.waitForTimeout(500);
    expect(same(await camera(page), before)).toBe(true);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    // Up over the World: the page scrolls.
    await swipe({ x: 120, y: 330 }, { x: 120, y: 80 });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  });

  test('under reduced motion the camera cuts as each section takes over', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?life=still');
    await worldReady(page);
    const stops = await sections(page);
    const [garden, dock] = [stops.find((s) => s.route === '/garden')!, stops.find((s) => s.route === '/dock')!];
    await scrollTo(page, garden.top);
    const atGarden = await restingCamera(page);
    await scrollTo(page, dock.top);
    const atDock = await restingCamera(page);
    // Short of half-way the Garden still holds the camera; past it the Dock's framing is there at once.
    await scrollTo(page, Math.round(garden.top + (dock.top - garden.top) * 0.95));
    await page.waitForTimeout(150);
    const nearDock = await camera(page);
    expect(same(nearDock, atDock) || same(nearDock, atGarden)).toBe(true);
    await scrollTo(page, dock.top - 1);
    await page.waitForTimeout(150);
    expect(same(await camera(page), atDock)).toBe(true);
  });
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop keeps one panel over the World');

  test('only the page own panel shows, beside the World', async ({ page }) => {
    await page.goto('/about?life=still');
    await worldReady(page);
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    await expect(page.locator('[data-story-item][data-extra]').first()).toBeHidden();
    // The page does not scroll; the camera sits at the House Interior, closer than the Overview.
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    expect((await restingCamera(page)).zoom).toBeGreaterThan(1.5);
  });
});
