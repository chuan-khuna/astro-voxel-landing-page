/**
 * Browser tests (`bun run e2e`): the built site in real Chromium, on a
 * desktop and on a phone. `astro preview` serves the build on its own port,
 * never a second `astro dev` (Astro allows one dev server per project).
 * Chromium draws the World with SwiftShader (software WebGL), so it mounts
 * headless. Unit tests are Vitest's `*.test.ts` under `src/`; these are `e2e/*.spec.ts`.
 */
import { defineConfig } from '@playwright/test';

const PORT = 4329;

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  // The software renderer is slow: one World at a time, with room to mount.
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: `bun run build && bunx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
  },
});
