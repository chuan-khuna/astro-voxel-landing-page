import type { Biome, BiomeId, Oklch } from './types';

/**
 * The four Biomes. Each colour is a swatch from one of the referenced Lospec
 * palettes, converted to OKLCH with L and h kept and chroma clamped to at most
 * 0.10 (lowered further where a swatch read too loud). The comment on each
 * line names the source: lnb = late night bath, co = Cryptic Ocean,
 * pun = Punolite Plus Remake, aq = Aquaverse.
 */
const oklch = (l: number, c: number, h: number): Oklch => ({ l, c, h });

export const BIOMES: Record<BiomeId, Biome> = {
  tropical: {
    id: 'tropical',
    colours: {
      sand: oklch(0.799, 0.085, 77.2), // pun e2b570
      grass: oklch(0.662, 0.09, 143.9), // pun 5da75d
      peak: oklch(0.514, 0.075, 164.4), // pun 39755c
      foliage: oklch(0.514, 0.075, 164.4), // pun 39755c
      soil: oklch(0.587, 0.08, 17.5), // pun bc5960
      rock: oklch(0.601, 0.022, 234.1), // lnb 74838c
      rockDark: oklch(0.484, 0.03, 280.5), // lnb 5b5d70
      path: oklch(0.918, 0.06, 105.9), // pun eee98a
      bridge: oklch(0.587, 0.07, 17.5), // pun bc5960
      waterShallow: oklch(0.691, 0.1, 195.0), // aq 31b0b0
      waterDeep: oklch(0.457, 0.096, 240.2), // aq 145d87
      accent: oklch(0.764, 0.1, 16.5), // lnb f69197
    },
  },
  northern: {
    id: 'northern',
    colours: {
      sand: oklch(0.723, 0.05, 206.1), // pun 81afb5
      grass: oklch(0.782, 0.062, 161.9), // co 95c5ac
      peak: oklch(0.956, 0.02, 181.1), // pun e3f5f1
      foliage: oklch(0.415, 0.049, 195.4), // pun 285454
      soil: oklch(0.482, 0.045, 232.9), // pun 446374
      rock: oklch(0.484, 0.03, 280.5), // lnb 5b5d70
      rockDark: oklch(0.299, 0.028, 270.3), // lnb 282d3c
      path: oklch(0.601, 0.022, 234.1), // lnb 74838c
      bridge: oklch(0.36, 0.08, 354.6), // pun 632240
      waterShallow: oklch(0.593, 0.053, 255.2), // co 69809e
      waterDeep: oklch(0.333, 0.048, 243.1), // pun 1f394d
      accent: oklch(0.87, 0.07, 31.6), // lnb ffc4b8
    },
  },
  autumn: {
    id: 'autumn',
    colours: {
      sand: oklch(0.87, 0.07, 31.6), // lnb ffc4b8
      grass: oklch(0.799, 0.095, 77.2), // pun e2b570
      peak: oklch(0.601, 0.022, 234.1), // lnb 74838c
      foliage: oklch(0.587, 0.1, 17.5), // pun bc5960
      soil: oklch(0.474, 0.09, 5.7), // pun 913a52
      rock: oklch(0.484, 0.03, 280.5), // lnb 5b5d70
      rockDark: oklch(0.396, 0.047, 248.0), // pun 32495f
      path: oklch(0.918, 0.08, 105.9), // pun eee98a
      bridge: oklch(0.36, 0.09, 354.6), // pun 632240
      waterShallow: oklch(0.651, 0.09, 199.0), // pun 3fa0a4
      waterDeep: oklch(0.467, 0.078, 236.9), // pun 286080
      accent: oklch(0.514, 0.075, 164.4), // pun 39755c
    },
  },
  volcanic: {
    id: 'volcanic',
    colours: {
      sand: oklch(0.484, 0.03, 280.5), // lnb 5b5d70
      grass: oklch(0.514, 0.075, 164.4), // pun 39755c
      peak: oklch(0.36, 0.1, 354.6), // pun 632240
      foliage: oklch(0.415, 0.049, 195.4), // pun 285454
      soil: oklch(0.341, 0.088, 298.9), // co 3f2c5f
      rock: oklch(0.299, 0.028, 270.3), // lnb 282d3c
      rockDark: oklch(0.16, 0.037, 268.9), // pun 070c1d
      path: oklch(0.601, 0.022, 234.1), // lnb 74838c
      bridge: oklch(0.48, 0.072, 268.0), // co 4c5c87
      waterShallow: oklch(0.566, 0.091, 216.9), // aq 228399
      waterDeep: oklch(0.324, 0.078, 247.4), // aq 093659
      accent: oklch(0.587, 0.1, 17.5), // pun bc5960
    },
  },
};

/** How a Biome shapes the land: the range of extra height steps an Isle's peak reaches. */
export const BIOME_RELIEF: Record<BiomeId, { minPeak: number; maxPeak: number }> = {
  tropical: { minPeak: 2, maxPeak: 4 },
  northern: { minPeak: 3, maxPeak: 5 },
  autumn: { minPeak: 2, maxPeak: 4 },
  volcanic: { minPeak: 4, maxPeak: 6 },
};
