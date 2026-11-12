/**
 * The shore's surf, pure (no three.js): how much foam a wave leaves at a
 * distance from the coastline (`d`, units, from the sea model's `coast`
 * data) at `u` of the way through the wave (0–1). The sea's shader
 * (`seaMaterial.ts`) does the same sums per ⅛-unit square of the water's
 * top, turning the amount into a chance that square is foam.
 *
 * - Run in (u < `SURF_BREAK`): a crest of foam runs in from `SURF_RUN`
 *   units out to the coast's edge, speeding up, thickening as it comes.
 * - Break and draw back: the foam lies thick along the edge, then spreads
 *   out to sea as it draws back, thinning to nothing by the next wave.
 * - A thin rim always laps the edge.
 *
 * `surfGlow`: where the wave breaks, a soft glow (the bioluminescent surf at
 * Night), brightest as it breaks and fading as it draws back.
 */

/** Units out from the coastline a wave's crest starts. */
export const SURF_RUN = 2;
/** The share of a wave spent running in; it breaks then. */
export const SURF_BREAK = 0.55;
/** Seconds from one wave to the next. */
export const SURF_PERIOD = 7;
/** Half the width of a running crest, in units. */
export const SURF_CREST = 0.16;
/** How far out the foam spreads as it draws back, in units. */
export const SURF_WASH = 0.85;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** GLSL's smoothstep, edges in order. */
const smoothstep = (lo: number, hi: number, x: number) => {
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};

/** Where the crest is while running in, units from the coastline: it starts slow far out and speeds up. */
export const surfFront = (u: number) => SURF_RUN * (1 - clamp01(u / SURF_BREAK) ** 2);

/** How far through drawing back the wave is (0 as it breaks, 1 at its end); 0 while running in. */
const back = (u: number) => clamp01((u - SURF_BREAK) / (1 - SURF_BREAK));

/** The foam (0–1) at `d` units from the coastline, `u` of the way through a wave. */
export function surfFoam(d: number, u: number): number {
  const running = u < SURF_BREAK ? 1 : 0;
  const run = clamp01(u / SURF_BREAK);
  const crest = running * (1 - smoothstep(0, SURF_CREST, Math.abs(d - surfFront(u)))) * (0.35 + 0.55 * run);
  const v = back(u);
  const reach = 0.1 + SURF_WASH * v;
  const wash = (1 - running) * (1 - v) ** 1.5 * 0.95 * (1 - smoothstep(reach, reach + 0.15, d));
  const rim = 0.25 * (1 - smoothstep(0.05, 0.2, d));
  return clamp01(Math.max(crest, wash, rim));
}

/** The breaking wave's glow (0–1) at `d` units from the coastline, `u` of the way through a wave. */
export function surfGlow(d: number, u: number): number {
  if (u < SURF_BREAK) return 0;
  return (1 - back(u)) ** 2 * (1 - smoothstep(0.2, 0.6, d));
}
