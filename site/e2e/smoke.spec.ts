/** Every route loads, the World mounts and nothing logs an error, on desktop and on a phone. */
import { expect, test } from '@playwright/test';
import { collectErrors, worldReady } from './world';

const ROUTES = ['/', '/services', '/about', '/about/team', '/garden', '/garden/archive-search', '/dock', '/contact'];

for (const route of ROUTES) {
  test(`${route} loads with the World`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${route}?life=still`);
    await worldReady(page);
    await expect(page.locator('.hud-bar')).toBeVisible();
    // No horizontal scroll at any width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('without a GPU the page is a normal page with the World still', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/about');
  await expect(page.locator('html')).not.toHaveAttribute('data-world', /.*/);
  await expect(page.locator('#world-canvas')).toBeHidden();
  // Only the page's own panel: the Story Scroll's other sections stay out of the fallback.
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  await expect(page.locator('[data-story-item][data-extra]').first()).toBeHidden();
  await context.close();
});
