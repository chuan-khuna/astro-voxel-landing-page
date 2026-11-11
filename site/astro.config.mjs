// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { worldStills } from './src/integrations/worldStills';

export default defineConfig({
  output: 'static',
  // worldStills: after the build, capture the World still (Day and Night) with Playwright.
  integrations: [mdx(), worldStills()],
});
