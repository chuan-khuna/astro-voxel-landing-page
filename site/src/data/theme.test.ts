import { describe, expect, it } from 'vitest';
import { BIOMES } from '../world/biomes';
import { BIOME_IDS } from '../world';
import { THEME_TOKENS, contrastRatio, seaColour, themeCss, type UiTokens } from './theme';

const white = { l: 1, c: 0, h: 0 };
const black = { l: 0, c: 0, h: 0 };

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
    expect(contrastRatio(THEME_TOKENS.day.ui.ink, THEME_TOKENS.day.ui.ink)).toBeCloseTo(1, 5);
  });
  it('matches a known pair: mid grey #777 (L 0.5693) on white is 4.48', () => {
    expect(contrastRatio({ l: 0.5693, c: 0, h: 0 }, white)).toBeCloseTo(4.48, 1);
  });
});

describe('UI tokens', () => {
  for (const theme of ['day', 'night'] as const) {
    const ui: UiTokens = THEME_TOKENS[theme].ui;
    it(`meets WCAG AA (4.5:1) for every text pair at ${theme}`, () => {
      type Colour = Exclude<keyof UiTokens, 'shadowAlpha'>;
      const pairs: Array<[string, Colour, Colour]> = [
        ['body text on a card', 'ink', 'paper'],
        ['body text on the World frame', 'ink', 'surface'],
        ['brand text on a card', 'brandInk', 'paper'],
        ['text on a brand button', 'onBrand', 'brandInk'],
        ['text on a hovered brand button', 'onBrand', 'brandInkHover'],
      ];
      for (const [what, fg, bg] of pairs) {
        expect(contrastRatio(ui[fg], ui[bg]), `${theme}: ${what}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it('makes Night a dark theme and Day a light one', () => {
    expect(THEME_TOKENS.night.ui.paper.l).toBeLessThan(0.4);
    expect(THEME_TOKENS.day.ui.paper.l).toBeGreaterThan(0.9);
  });
});

describe('themeCss', () => {
  const css = themeCss();
  it('declares the Day tokens as CSS custom properties in OKLCH', () => {
    const { ink } = THEME_TOKENS.day.ui;
    expect(css).toContain(`--ink: oklch(${ink.l} ${ink.c} ${ink.h});`);
  });
  it('switches to the Night tokens on data-theme="night", and with no data-theme on a dark system', () => {
    const { paper } = THEME_TOKENS.night.ui;
    expect(css).toContain(':root[data-theme="night"]');
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme\]\)/);
    expect(css).toContain(`--paper: oklch(${paper.l} ${paper.c} ${paper.h});`);
  });
});

describe('World tokens', () => {
  it('darkens every Biome’s water at Night', () => {
    for (const id of BIOME_IDS) {
      for (const role of ['waterShallow', 'waterDeep'] as const) {
        const day = seaColour(BIOMES[id], role, 'day');
        const night = seaColour(BIOMES[id], role, 'night');
        expect(day).toEqual(BIOMES[id].colours[role]);
        expect(night.l, `${id} ${role}`).toBeLessThan(day.l - 0.05);
        expect(night.h).toBe(day.h);
      }
    }
  });
  it('lights the House and the buoys only at Night', () => {
    expect(THEME_TOKENS.day.world.lightsOn).toBe(false);
    expect(THEME_TOKENS.night.world.lightsOn).toBe(true);
  });
  it('dims the sky and the sun at Night', () => {
    const { day, night } = THEME_TOKENS;
    expect(night.world.sky.l).toBeLessThan(day.world.sky.l);
    expect(night.world.sunIntensity).toBeLessThan(day.world.sunIntensity);
  });
});
