/**
 * The World still: a picture of the default Seed's World, by Day and by
 * Night, shown in the World's place when the browser cannot draw it (no JS,
 * no WebGPU or WebGL 2). Captured at build time by the `worldStills`
 * integration (`src/integrations/worldStills.ts`) into `dist/stills/`. The
 * Day still, cut to 1.91:1, is also the default OG image (`OG_IMAGE`).
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

/**
 * The default OG image (link previews): the Day still, cropped to 1.91:1
 * at 1200×630 and saved as JPEG, which every preview service reads.
 */
export const OG_IMAGE = { src: '/stills/og-world-day.jpg', width: 1200, height: 630, type: 'image/jpeg' } as const;

/** The part of the still the OG image shows: its full width, cut to the OG image's shape across the middle. */
const ogCropHeight = Math.round((STILL_SIZE.width * OG_IMAGE.height) / OG_IMAGE.width);
export const OG_CROP = {
  x: 0,
  y: Math.round((STILL_SIZE.height - ogCropHeight) / 2),
  width: STILL_SIZE.width,
  height: ogCropHeight,
} as const;

/** A `<meta>` tag marked `data-og-still`: one that describes the OG still. */
const OG_STILL_TAG = /<meta\b[^>]*\bdata-og-still\b[^>]*>/g;

/**
 * A built page without the OG still's tags, for a build that could not
 * capture it: its preview then has no picture, so its Twitter card becomes
 * the small `summary`. A page with another image is left as it is.
 */
export function stripOgStill(html: string): string {
  const stripped = html.replace(OG_STILL_TAG, '');
  if (stripped === html) return html;
  return stripped.replace(/(<meta\b[^>]*name="twitter:card"[^>]*content=")summary_large_image"/, '$1summary"');
}
