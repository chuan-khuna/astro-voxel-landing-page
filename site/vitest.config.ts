import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { structurePlugin } from './src/structures/vitePlugin';

export default defineConfig({
  // Structure files (`*.structure`) are parsed into voxel arrays at build time.
  plugins: [structurePlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
