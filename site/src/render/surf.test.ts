import { describe, expect, it } from 'vitest';
import { SURF_BREAK, SURF_RUN, surfFoam, surfGlow } from './surf';

/** The distance from the coastline (units) where a wave's foam is thickest at `u` of the way through it. */
const crest = (u: number) => {
  let best = { d: 0, foam: -1 };
  for (let d = 0; d <= 3; d += 0.01) if (surfFoam(d, u) > best.foam) best = { d, foam: surfFoam(d, u) };
  return best;
};

describe('surf', () => {
  it('runs a crest of foam in towards the coast', () => {
    let last = Infinity;
    for (let u = 0.05; u < SURF_BREAK; u += 0.05) {
      const { d, foam } = crest(u);
      expect(d, `u ${u}`).toBeLessThan(last);
      expect(foam, `u ${u}`).toBeGreaterThan(0.2);
      last = d;
    }
    expect(crest(0.05).d).toBeGreaterThan(SURF_RUN * 0.8);
  });

  it('breaks thick along the coast\'s edge, then washes back thinning to nothing', () => {
    expect(surfFoam(0.05, SURF_BREAK + 0.01)).toBeGreaterThan(0.85);
    let last = Infinity;
    for (let u = SURF_BREAK + 0.05; u < 1; u += 0.05) {
      // Its thickest foam thins as it washes back out to sea.
      const thickest = crest(u).foam;
      expect(thickest, `u ${u}`).toBeLessThanOrEqual(last);
      last = thickest;
    }
    // Only the thin rim that always laps the edge is left.
    for (let d = 0.3; d <= 3; d += 0.1) expect(surfFoam(d, 0.999), `d ${d}`).toBeLessThan(0.05);
  });

  it('never foams far out', () => {
    for (let u = 0; u < 1; u += 0.01) for (let d = SURF_RUN + 0.3; d <= 8; d += 0.25) expect(surfFoam(d, u)).toBe(0);
  });

  it('glows where the wave breaks and nowhere else', () => {
    expect(surfGlow(0.1, SURF_BREAK + 0.01)).toBeGreaterThan(0.8);
    expect(surfGlow(1, SURF_BREAK + 0.01)).toBe(0);
    expect(surfGlow(0.1, SURF_BREAK / 2)).toBe(0);
    expect(surfGlow(0.1, 0.99)).toBeLessThan(0.05);
  });
});
