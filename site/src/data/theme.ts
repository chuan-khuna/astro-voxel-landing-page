/**
 * The Day and Night theme tokens: one set of OKLCH values that drives both
 * the page's CSS (custom properties, from `themeCss`, inlined in
 * `Base.astro`) and the three.js World (sky, lights, water, the House's
 * lights and the buoys' lamps, in `mountWorld.ts`). The theme never touches
 * the World's layout: only colours, light and glow.
 *
 * Which theme shows is `src/lib/theme.ts`. Edit the colours here.
 */
import type { Biome, Oklch } from '../world';
import { LOOK, oklchToLinear, shiftLightness } from '../render/palette';
import type { Theme } from '../lib/theme';

const oklch = (l: number, c: number, h: number): Oklch => ({ l, c, h });

/** Page colours. Every text pair meets WCAG AA (`theme.test.ts`). */
export interface UiTokens {
  /** Body text. */
  ink: Oklch;
  /** Cards and the page behind them. */
  paper: Oklch;
  /** Behind the World while it loads. */
  surface: Oklch;
  /** The brand colour as text on a card, and as a background under `onBrand` text. */
  brandInk: Oklch;
  /** `brandInk` under the pointer. */
  brandInkHover: Oklch;
  /** Text on `brandInk`. */
  onBrand: Oklch;
  /** The cards' soft shadow (drawn at `shadowAlpha`). */
  shadow: Oklch;
  shadowAlpha: number;
}

/** The World's light. Colours and strengths only: never the layout. */
export interface WorldTokens {
  /** The background behind the sea. */
  sky: Oklch;
  /** The directional light (the sun by Day, the moon by Night), always from the same direction. */
  sunLight: Oklch;
  sunIntensity: number;
  /** The hemisphere light: sky above, ground below. */
  skyLight: Oklch;
  groundLight: Oklch;
  skyIntensity: number;
  /** OKLCH lightness added to the Biome's water colours. */
  waterShift: number;
  /** The House's windows and the buoys' lamps glow. */
  lightsOn: boolean;
  /** The glow of the House's windows. */
  windowLight: Oklch;
  /** The glow of a buoy's lamp. */
  buoyLight: Oklch;
  /** The clouds' colour: white by Day, a dark grey-blue at Night. */
  cloud: Oklch;
  /** How much a cloud's shadow darkens the ground (0–1): none at Night. */
  cloudShadow: number;
  /** The shore's foam: white by Day, dimmed at Night. */
  foam: Oklch;
  /** The faint bioluminescent glow where waves break, and how strong it is (0 by Day). */
  surfGlow: Oklch;
  surfGlowStrength: number;
}

export interface ThemeTokens {
  ui: UiTokens;
  world: WorldTokens;
}

export const THEME_TOKENS: Record<Theme, ThemeTokens> = {
  day: {
    ui: {
      ink: oklch(0.28, 0.02, 250),
      paper: oklch(0.97, 0.01, 230),
      surface: oklch(0.92, 0.015, 230),
      // The brand colour (site data) darkened for text on the light cards.
      brandInk: oklch(0.44, 0.072, 235),
      brandInkHover: oklch(0.35, 0.058, 235),
      onBrand: oklch(0.98, 0.005, 230),
      shadow: oklch(0.2, 0.02, 250),
      shadowAlpha: 0.2,
    },
    world: {
      // The sky and light approved in ticket 01.
      sky: oklch(0.93, 0.02, 230),
      sunLight: oklch(0.98, 0.025, 85),
      sunIntensity: LOOK.sunIntensity,
      skyLight: oklch(0.93, 0.03, 235),
      groundLight: oklch(0.78, 0.04, 80),
      skyIntensity: LOOK.skyIntensity,
      waterShift: 0,
      lightsOn: false,
      windowLight: oklch(0.9, 0.09, 85),
      buoyLight: oklch(0.88, 0.1, 60),
      cloud: oklch(0.99, 0.008, 240),
      cloudShadow: 0.2,
      foam: oklch(0.97, 0.01, 220),
      surfGlow: oklch(0.8, 0.13, 190),
      surfGlowStrength: 0,
    },
  },
  night: {
    ui: {
      ink: oklch(0.94, 0.012, 240),
      paper: oklch(0.26, 0.025, 260),
      surface: oklch(0.22, 0.03, 260),
      // The brand colour lightened for text on the dark cards.
      brandInk: oklch(0.8, 0.08, 235),
      brandInkHover: oklch(0.87, 0.06, 235),
      onBrand: oklch(0.22, 0.03, 250),
      shadow: oklch(0.1, 0.02, 260),
      shadowAlpha: 0.5,
    },
    world: {
      sky: oklch(0.27, 0.045, 265),
      // Moonlight: cool and dim, from where the sun was, so shadows stay put.
      sunLight: oklch(0.82, 0.04, 250),
      sunIntensity: 1.2,
      skyLight: oklch(0.55, 0.06, 260),
      groundLight: oklch(0.3, 0.03, 270),
      skyIntensity: 0.95,
      waterShift: -0.12,
      lightsOn: true,
      windowLight: oklch(0.9, 0.09, 85),
      buoyLight: oklch(0.88, 0.1, 60),
      cloud: oklch(0.45, 0.03, 265),
      cloudShadow: 0,
      foam: oklch(0.72, 0.03, 240),
      surfGlow: oklch(0.8, 0.13, 190),
      surfGlowStrength: 0.8,
    },
  },
};

/** A Biome's water colour in a theme: darker at Night. */
export function seaColour(biome: Biome, role: 'waterShallow' | 'waterDeep', theme: Theme): Oklch {
  return shiftLightness(biome.colours[role], THEME_TOKENS[theme].world.waterShift);
}

const css = ({ l, c, h }: Oklch, alpha?: number) => `oklch(${l} ${c} ${h}${alpha === undefined ? '' : ` / ${alpha}`})`;

/** One theme's UI tokens as CSS custom property declarations. */
function declarations(theme: Theme): string {
  const ui = THEME_TOKENS[theme].ui;
  return [
    `color-scheme: ${theme === 'night' ? 'dark' : 'light'};`,
    `--ink: ${css(ui.ink)};`,
    `--paper: ${css(ui.paper)};`,
    `--surface: ${css(ui.surface)};`,
    `--brand-ink: ${css(ui.brandInk)};`,
    `--brand-ink-hover: ${css(ui.brandInkHover)};`,
    `--on-brand: ${css(ui.onBrand)};`,
    `--shadow: ${css(ui.shadow, ui.shadowAlpha)};`,
  ].join(' ');
}

/**
 * The tokens as CSS: Day by default; Night on `<html data-theme="night">`,
 * and, before any script has run (or without JS), whenever the system
 * prefers dark.
 */
export function themeCss(): string {
  return [
    `:root { ${declarations('day')} }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { ${declarations('night')} } }`,
    `:root[data-theme="night"] { ${declarations('night')} }`,
  ].join('\n');
}

/** WCAG relative luminance of an OKLCH colour (via linear sRGB). */
function luminance(colour: Oklch): number {
  const [r, g, b] = oklchToLinear(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
