import { describe, expect, it } from 'vitest';
import { STILL_WIDTHS, stillPath, stillSrcset, stripStills } from './worldStill';

describe('stillPath', () => {
  it('names a still by theme and width, under /stills', () => {
    expect(stillPath('day', 1600)).toBe('/stills/world-day-1600.webp');
    expect(stillPath('night', 800)).toBe('/stills/world-night-800.webp');
  });
});

describe('stillSrcset', () => {
  it('lists every width of one theme, narrowest first', () => {
    expect(STILL_WIDTHS).toEqual([800, 1600]);
    expect(stillSrcset('night')).toBe('/stills/world-night-800.webp 800w, /stills/world-night-1600.webp 1600w');
  });
});

describe('stripStills', () => {
  const page = [
    '<main><section>Intro</section>',
    '<figure class="world-still" data-world-still><img src="/stills/world-day-1600.webp" alt="a"><img alt="b"></figure>',
    '<div class="world"></div></main>',
  ].join('');

  it('takes the still out of a page, leaving the rest', () => {
    expect(stripStills(page)).toBe('<main><section>Intro</section><div class="world"></div></main>');
  });
  it('leaves a page without a still as it is', () => {
    expect(stripStills('<main><figure><img alt="x"></figure></main>')).toBe('<main><figure><img alt="x"></figure></main>');
  });
});
