/**
 * The `worldStills` integration: after `astro build`, a headless Chromium
 * (Playwright) loads the built home page, lets the default Seed's World
 * draw, and saves a still of it by Day and by Night in `dist/stills/`
 * (`lib/worldStill.ts` names the files). Pages show the still in the
 * World's place when the browser cannot draw the World.
 *
 * The capture serves `dist` itself on a free local port, with reduced motion
 * on so the Guide is simply there and the ships keep their starting places:
 * the same build gives the same still. Overlays (cards, hotspots, the
 * Guide's bubble) are hidden; only the canvas is captured.
 *
 * If Playwright or its Chromium is missing, or the World fails to draw, the
 * build still succeeds: it warns how to fix it and takes the still out of
 * every page, so none shows a broken image. `WORLD_STILLS=off` skips the
 * capture the same way.
 */
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Theme } from '@/lib/theme';
import { STILL_SIZE, STILL_WIDTHS, stillPath, stripStills } from '@/lib/worldStill';

/** How long the World may take to draw before the capture gives up, ms. */
const DRAW_TIMEOUT_MS = 60_000;
/** WebP quality of the stills, 0–1. */
const QUALITY = 0.82;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Serve a built site from `root` on a free local port. */
async function serve(root: string): Promise<{ server: Server; origin: string }> {
  const server = createServer(async (request, response) => {
    const path = normalize(join(root, decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)));
    let file = path;
    try {
      if (!path.startsWith(root)) throw new Error('outside the site');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await stat(file);
    } catch {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

/** Every built page under `dir`. */
async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => join(e.parentPath, e.name));
}

/** Capture the World's still in both themes into `<root>/stills/`. */
async function capture(root: string, logger: AstroIntegrationLogger): Promise<void> {
  // Through Node, not Vite: the config's module runner is closed by the time the build is done.
  const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
  const { server, origin } = await serve(root);
  // SwiftShader lets WebGL 2 draw on machines (CI) without a GPU.
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await mkdir(join(root, 'stills'), { recursive: true });
    for (const theme of ['day', 'night'] as const satisfies readonly Theme[]) {
      const context = await browser.newContext({
        viewport: STILL_SIZE,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: theme === 'night' ? 'dark' : 'light',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => logger.warn(`page error while capturing: ${error.message}`));
      await page.goto(`${origin}/`);
      await page.waitForFunction(
        (want) => {
          const canvas = document.querySelector<HTMLCanvasElement>('#world-canvas');
          return Number(canvas?.dataset.frames ?? 0) > 0 && canvas?.dataset.theme === want;
        },
        theme,
        { timeout: DRAW_TIMEOUT_MS },
      );
      if (!(await page.evaluate(() => document.documentElement.dataset.world))) throw new Error('the World did not mount');
      // Only the World: no cards, hotspots, Data Cards or speech bubble over it.
      await page.addStyleTag({ content: '.hud-bar, .hud-main > :not(.world), .world > :not(canvas) { visibility: hidden !important; }' });
      const png = await page.locator('#world-canvas').screenshot({ type: 'png' });
      // Scale and encode as WebP in the page: Chromium does it, so no image library is needed.
      const encoded = await page.evaluate(
        async ({ data, widths, height, width, quality }) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          return Promise.all(
            widths.map(async (w) => {
              const h = Math.round((height * w) / width);
              const canvas = new OffscreenCanvas(w, h);
              const context = canvas.getContext('2d')!;
              context.imageSmoothingQuality = 'high';
              context.drawImage(bitmap, 0, 0, w, h);
              const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/webp', quality })).arrayBuffer());
              let binary = '';
              for (const byte of bytes) binary += String.fromCharCode(byte);
              return btoa(binary);
            }),
          );
        },
        { data: png.toString('base64'), widths: [...STILL_WIDTHS], quality: QUALITY, ...STILL_SIZE },
      );
      for (const [i, width] of STILL_WIDTHS.entries()) {
        const file = join(root, ...stillPath(theme, width).split('/'));
        await writeFile(file, Buffer.from(encoded[i]!, 'base64'));
      }
      logger.info(`captured the ${theme} still (${STILL_WIDTHS.join(' and ')} px)`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

export function worldStills(): AstroIntegration {
  return {
    name: 'world-stills',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir).replace(/[\\/]$/, '') + sep;
        try {
          if (process.env.WORLD_STILLS === 'off') throw new Error('WORLD_STILLS=off');
          await capture(root, logger);
        } catch (error) {
          const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
          logger.warn(
            `No World still this build (${reason}). Pages without WebGPU or WebGL will show only the Landmark menu. ` +
              'To capture it, install Playwright\'s Chromium once: `bunx playwright install chromium` in site/ ' +
              '(see docs/documents/site-project.md, "World still").',
          );
          for (const file of await htmlFiles(root)) await writeFile(file, stripStills(await readFile(file, 'utf8')));
        }
      },
    },
  };
}
