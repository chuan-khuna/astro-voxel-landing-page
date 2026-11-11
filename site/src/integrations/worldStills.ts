/**
 * The `worldStills` integration: after `astro build`, a headless Chromium
 * (Playwright) loads the built home page, lets the default Seed's World
 * draw, and saves a still of it by Day and by Night in `dist/stills/`
 * (`lib/worldStill.ts` names the files). Pages show the still in the
 * World's place when the browser cannot draw the World. The Day capture is
 * also cut to 1200×630 and saved as the default OG image (`OG_IMAGE`), the
 * picture a shared link previews.
 *
 * The capture serves `dist` itself on a free local port, with reduced motion
 * on so the Guide is simply there and the ships keep their starting places:
 * the same build gives the same still. Overlays (cards, hotspots, the
 * Guide's bubble) are hidden; only the canvas is captured.
 *
 * If Playwright or its Chromium is missing, or the World fails to draw, the
 * build still succeeds: it warns how to fix it and takes the still out of
 * every page, so none shows a broken image, and the OG image's tags out of
 * every page that uses it, so no preview points at a missing file. `WORLD_STILLS=off` skips the
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
import { OG_CROP, OG_IMAGE, STILL_SIZE, STILL_WIDTHS, stillPath, stripOgStill, stripStills } from '@/lib/worldStill';

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
      // Scale (and for the OG image crop) and encode in the page: Chromium does it, so no image library is needed.
      const jobs = [
        ...STILL_WIDTHS.map((width) => ({
          file: stillPath(theme, width),
          width,
          height: Math.round((STILL_SIZE.height * width) / STILL_SIZE.width),
          crop: { x: 0, y: 0, width: STILL_SIZE.width, height: STILL_SIZE.height },
          type: 'image/webp',
        })),
        // The OG image: the Day still cut to its 1.91:1 shape across the middle, as JPEG.
        ...(theme === 'day' ? [{ file: OG_IMAGE.src, width: OG_IMAGE.width, height: OG_IMAGE.height, crop: OG_CROP, type: OG_IMAGE.type }] : []),
      ];
      const encoded = await page.evaluate(
        async ({ data, jobs, quality }) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
          return Promise.all(
            jobs.map(async ({ width, height, crop, type }) => {
              const canvas = new OffscreenCanvas(width, height);
              const context = canvas.getContext('2d')!;
              context.imageSmoothingQuality = 'high';
              context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
              const bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality })).arrayBuffer());
              let binary = '';
              for (const byte of bytes) binary += String.fromCharCode(byte);
              return btoa(binary);
            }),
          );
        },
        { data: png.toString('base64'), jobs, quality: QUALITY },
      );
      for (const [i, job] of jobs.entries()) {
        await writeFile(join(root, ...job.file.split('/')), Buffer.from(encoded[i]!, 'base64'));
      }
      logger.info(`captured the ${theme} still (${STILL_WIDTHS.join(' and ')} px)${theme === 'day' ? ' and the OG image' : ''}`);
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
            `No World still this build (${reason}). Pages without WebGPU or WebGL will show only the Landmark menu, and shared links preview without a picture. ` +
              'To capture it, install Playwright\'s Chromium once: `bunx playwright install chromium` in site/ ' +
              '(see docs/documents/site-project.md, "World still").',
          );
          for (const file of await htmlFiles(root)) await writeFile(file, stripOgStill(stripStills(await readFile(file, 'utf8'))));
        }
      },
    },
  };
}
