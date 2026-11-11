/**
 * The World still: a picture of the default Seed's World, by Day and by
 * Night, shown in the World's place when the browser cannot draw it (no JS,
 * no WebGPU or WebGL 2). Captured at build time by the `worldStills`
 * integration (`src/integrations/worldStills.ts`) into `dist/stills/`.
 *
 * Plain functions over strings; shared by the page and the integration.
 */
import type { Theme } from '@/lib/theme';

/** The widths each still is saved at, CSS px, narrowest first. */
export const STILL_WIDTHS = [800, 1600] as const;
/** The capture's viewport: the still's size and shape (16:10). */
export const STILL_SIZE = { width: 1600, height: 1000 } as const;

/** Where the still of one theme at one width is served. */
export function stillPath(theme: Theme, width: number): string {
  return `/stills/world-${theme}-${width}.webp`;
}

/** The `srcset` of one theme's still. */
export function stillSrcset(theme: Theme): string {
  return STILL_WIDTHS.map((width) => `${stillPath(theme, width)} ${width}w`).join(', ');
}

/** The still's `<figure>`, marked `data-world-still`. */
const STILL_FIGURE = /<figure\b[^>]*\bdata-world-still\b[^>]*>[\s\S]*?<\/figure>/g;

/** A built page without its still: for a build that could not capture one, so no page shows a broken image. */
export function stripStills(html: string): string {
  return html.replace(STILL_FIGURE, '');
}
