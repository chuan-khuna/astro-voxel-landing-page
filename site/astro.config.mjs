// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { worldStills } from './src/integrations/worldStills';
import { site } from './src/data/site';

export default defineConfig({
  output: 'static',
  // The published origin, from the site data module (canonical URLs, the sitemap, the OG image).
  site: site.url,
  // worldStills: after the build, capture the World still (Day and Night) and the OG image with Playwright.
  integrations: [mdx(), worldStills()],
});
