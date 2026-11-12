/**
 * The `modelGallery` integration: the Model Gallery at `/dev/models`, a page
 * that shows every predefined structure (`src/structures/`) for review. It
 * is injected only while `astro dev` runs, so it is never part of a build.
 */
import type { AstroIntegration } from 'astro';

export function modelGallery(): AstroIntegration {
  return {
    name: 'model-gallery',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/dev/models', entrypoint: new URL('../dev/models.astro', import.meta.url) });
      },
    },
  };
}
