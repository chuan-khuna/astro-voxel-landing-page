/**
 * The render stats overlay, for developers: when it is available (in
 * `astro dev`, or in any build with `?stats` in the URL), whether it is on
 * (kept per browser), and keeping `?stats` on links to other routes.
 *
 * Plain functions over `URL`s and strings; no DOM. Ordinary visitors (a
 * build without `?stats`) never load the overlay at all.
 */

/** The query parameter that makes the overlay available in a build. */
export const STATS_PARAM = 'stats';

/** Where the toggle's on or off is kept. */
export const STATS_STORAGE_KEY = 'render-stats';

/** Is the stats toggle available: always in dev, otherwise only with `?stats` (any value)? */
export function statsAvailable(dev: boolean, url: URL): boolean {
  return dev || url.searchParams.has(STATS_PARAM);
}

/** A stored on or off, or `fallback` for nothing stored or anything unknown. */
export function parseStatsOn(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === 'on') return true;
  if (raw === 'off') return false;
  return fallback;
}

/**
 * `href` with `?stats` added (as a bare flag), keeping its path, other
 * parameters and hash; unchanged if it has it already. Returns a
 * path-relative string for same-origin links.
 */
export function withStats(href: string, base: string): string {
  const url = new URL(href, base);
  if (!url.searchParams.has(STATS_PARAM)) url.search = url.search ? `${url.search}&${STATS_PARAM}` : `?${STATS_PARAM}`;
  return url.origin === new URL(base).origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
}
