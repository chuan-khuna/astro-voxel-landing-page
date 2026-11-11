/**
 * The Seed in the URL: read `?seed=`, roll a new numeric Seed, and keep a
 * rolled Seed on links to other routes (e.g. `/garden?seed=1234`).
 *
 * Plain functions over `URL`s; no DOM. Normalising the Seed (empty or too
 * long falls back to the default) stays in the World generator.
 */

/** The query parameter that carries the Seed. */
export const SEED_PARAM = 'seed';

/** The Seed in `?seed=`, or `null` when the URL has none. An empty value counts as none. */
export function seedFromUrl(url: URL): string | null {
  const seed = url.searchParams.get(SEED_PARAM);
  return seed ? seed : null;
}

/**
 * `href` with the Seed set as `?seed=`, keeping its path, other parameters and
 * hash. The default Seed is left out, so links stay clean until a visitor rolls.
 * Returns a path-relative string (`/garden?seed=1234#x`) for same-origin links.
 */
export function withSeed(href: string, seed: string, defaultSeed: string, base: string): string {
  const url = new URL(href, base);
  if (seed && seed !== defaultSeed) url.searchParams.set(SEED_PARAM, seed);
  else url.searchParams.delete(SEED_PARAM);
  return url.origin === new URL(base).origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

/** Largest rolled Seed + 1: short enough to share, wide enough to rarely repeat. */
const ROLL_RANGE = 1_000_000_000;

/**
 * Roll a new numeric Seed, different from `current`. `random` returns a
 * number in [0, 1); it defaults to `Math.random` (the World generator itself
 * never uses `Math.random`; only the roll does).
 */
export function rollSeed(current: string | null, random: () => number = Math.random): string {
  for (;;) {
    const seed = String(Math.floor(random() * ROLL_RANGE));
    if (seed !== current) return seed;
  }
}
