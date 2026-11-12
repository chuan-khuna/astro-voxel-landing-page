/**
 * The approved soft-voxel look (ticket 01) and the fixed colours that never
 * change with the Biome. Plain data and maths, no three.js, so the mesher and
 * the World-to-voxels step stay testable without a GPU.
 */
import type { Oklch } from '@/world';

/** Linear sRGB, each channel 0–1. */
export type Rgb = readonly [number, number, number];

/**
 * The look the user approved in the ticket 01 prototype (`prototypes/look/main.js`,
 * commit 9580bec). Change these together with the record in ticket 01.
 */
export const LOOK = {
  /** Seam half-width, as a fraction of one voxel. */
  seamWidth: 0.035,
  /** 0 = no seam, 1 = black seam. */
  seamDarkness: 0.22,
  /** Width of the rounded rim, as a fraction of one voxel. */
  bevelWidth: 0.16,
  /** How far the rim normal tilts toward the edge. */
  bevelStrength: 0.55,
  /** Per-voxel lightness variation (±). */
  jitter: 0.035,
  /** Per-voxel warm/cool variation (±). */
  tintJitter: 0.015,
  /** 0 = no baked AO, 1 = fully dark corners. Baked into vertex colours by the mesher. */
  aoStrength: 0.55,
  roughness: 0.9,
  sunIntensity: 2.4,
  /** Degrees around Y. */
  sunAzimuth: 35,
  /** Degrees above the horizon. */
  sunElevation: 52,
  skyIntensity: 1.1,
  exposure: 1.0,
} as const;

const oklch = (l: number, c: number, h: number): Oklch => ({ l, c, h });

/**
 * Fixed colours, independent of the Biome. The House colours are the ones
 * approved in ticket 01. Every chroma is at most 0.10. The sky and the
 * lights follow the theme: they are in `data/theme.ts`.
 */
export const FIXED_COLOURS = {
  // House (approved in ticket 01).
  whitewash: oklch(0.955, 0.008, 90),
  roofWhite: oklch(0.925, 0.012, 85),
  plinth: oklch(0.82, 0.012, 80),
  blueTrim: oklch(0.54, 0.1, 248),
  blueDoor: oklch(0.46, 0.095, 252),
  glass: oklch(0.34, 0.035, 245),
  bougainvillea: oklch(0.6, 0.1, 352),
  bougainLight: oklch(0.69, 0.085, 348),
  // The House's room and its developer.
  floorWood: oklch(0.7, 0.05, 70),
  rug: oklch(0.62, 0.07, 30),
  desk: oklch(0.56, 0.05, 55),
  chair: oklch(0.5, 0.025, 250),
  screenDark: oklch(0.24, 0.025, 250),
  skin: oklch(0.72, 0.06, 55),
  hair: oklch(0.4, 0.05, 50),
  shirt: oklch(0.6, 0.08, 185),
  trousers: oklch(0.36, 0.04, 255),
  /** Fire in a hearth or brazier (the House Interior). */
  fire: oklch(0.76, 0.1, 62),
  // Landmark parts (Station, Garden, Dock, Mailbox).
  trunk: oklch(0.46, 0.035, 60),
  plank: oklch(0.62, 0.045, 62),
  metal: oklch(0.62, 0.02, 250),
  metalDark: oklch(0.48, 0.02, 250),
  concrete: oklch(0.76, 0.012, 80),
  flagRed: oklch(0.56, 0.1, 28),
  // Boats (Clients) and ships (Partners).
  hullRed: oklch(0.52, 0.09, 30),
  hullNavy: oklch(0.4, 0.06, 255),
  sail: oklch(0.94, 0.018, 85),
  // Buoys: a lamp on top, unlit by Day (it glows at Night; see `data/theme.ts`).
  lamp: oklch(0.86, 0.04, 85),
  // Building materials for the House Variants (structure roles, `structures/roles.ts`).
  bamboo: oklch(0.78, 0.07, 88),
  timber: oklch(0.55, 0.06, 55),
  brick: oklch(0.56, 0.09, 35),
  stone: oklch(0.5, 0.015, 260),
  thatch: oklch(0.72, 0.08, 80),
  shingle: oklch(0.42, 0.04, 220),
  tile: oklch(0.58, 0.1, 40),
  slate: oklch(0.36, 0.02, 265),
  snow: oklch(0.96, 0.01, 230),
  // The Garden's plants (polish 05): petals and leaves beside the Biome's foliage.
  /** Flower stems and leaves: one green in every Biome, so a flower never reads as a tree. */
  stem: oklch(0.58, 0.09, 140),
  petalWhite: oklch(0.94, 0.02, 95),
  petalYellow: oklch(0.86, 0.1, 95),
  petalOrange: oklch(0.74, 0.1, 58),
  petalRed: oklch(0.6, 0.1, 25),
  petalBlue: oklch(0.66, 0.09, 280),
  pollen: oklch(0.8, 0.1, 80),
  leafGold: oklch(0.74, 0.1, 75),
  // The fish (polish 13): bright, so they still show through the shallows.
  fishOrange: oklch(0.72, 0.17, 50),
  fishWhite: oklch(0.96, 0.01, 90),
  fishSilver: oklch(0.86, 0.02, 230),
  fishGold: oklch(0.84, 0.15, 85),
  fishDark: oklch(0.32, 0.02, 30),
  fishEmber: oklch(0.66, 0.2, 35),
  // The land animals, birds and bats (polish 14).
  furBrown: oklch(0.52, 0.07, 55),
  furDark: oklch(0.34, 0.04, 45),
  furCream: oklch(0.88, 0.03, 85),
  furRed: oklch(0.56, 0.12, 45),
  furGrey: oklch(0.6, 0.012, 250),
  antler: oklch(0.8, 0.03, 80),
  horn: oklch(0.42, 0.02, 60),
  eye: oklch(0.18, 0.01, 260),
  beak: oklch(0.8, 0.12, 85),
  comb: oklch(0.52, 0.16, 28),
  plumeGold: oklch(0.68, 0.12, 60),
  plumeDark: oklch(0.3, 0.04, 165),
  featherWhite: oklch(0.96, 0.005, 240),
  featherGrey: oklch(0.72, 0.015, 245),
  featherBlack: oklch(0.24, 0.01, 260),
  batBody: oklch(0.44, 0.04, 40),
  batWing: oklch(0.34, 0.03, 30),
} as const satisfies Record<string, Oklch>;

export type FixedColour = keyof typeof FIXED_COLOURS;

/** OKLCH to linear sRGB, clamped to gamut. */
export function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

/** The same colour with its OKLCH lightness shifted by `dl`. */
export function shiftLightness({ l, c, h }: Oklch, dl: number): Oklch {
  return { l: Math.min(1, Math.max(0, l + dl)), c, h };
}
