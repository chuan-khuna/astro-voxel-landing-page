// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { worldStills } from './src/integrations/worldStills';
import { modelGallery } from './src/integrations/modelGallery';
import { structurePlugin } from './src/structures/vitePlugin';
import { site } from './src/data/site';

export default defineConfig({
  output: 'static',
  // The published origin, from the site data module (canonical URLs, the sitemap, the OG image).
  site: site.url,
  // worldStills: after the build, capture the World still (Day and Night) and the OG image with Playwright.
  // modelGallery: the dev-only Model Gallery at /dev/models (never in a build).
  integrations: [mdx(), worldStills(), modelGallery()],
  vite: {
    // Structure files (`*.structure`) are parsed into voxel arrays at build time, in pages and in the World Web Worker.
    plugins: [structurePlugin()],
    worker: { plugins: () => [structurePlugin()] },
  },
});
