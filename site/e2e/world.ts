/** Shared steps for the browser tests: waiting for the World, and reading the camera. */
import { expect, type Page } from '@playwright/test';

/** Errors the browser may log that say nothing about the site. */
const KNOWN_ERRORS: RegExp[] = [];

/** Collect the page's console errors and uncaught exceptions (less the known ones). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !KNOWN_ERRORS.some((known) => known.test(message.text()))) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

/** Wait until the World has mounted and drawn a few frames. */
export async function worldReady(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-world', 'live');
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('#world-canvas')?.dataset.frames ?? 0) > 2, null, {
    timeout: 120_000,
  });
}

export interface Camera {
  x: number;
  z: number;
  zoom: number;
}

/** The camera as the World last drew it (`canvas.dataset.camera`). */
export async function camera(page: Page): Promise<Camera> {
  const text = await page.locator('#world-canvas').getAttribute('data-camera');
  const [x = 0, z = 0, zoom = 0] = (text ?? '').split(' ').map(Number);
  return { x, z, zoom };
}

/** Wait until the camera has come to rest (two readings a while apart agree), and return it. */
export async function restingCamera(page: Page): Promise<Camera> {
  let before = await camera(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const now = await camera(page);
    if (now.x === before.x && now.z === before.z && now.zoom === before.zoom) return now;
    before = now;
  }
  return before;
}
