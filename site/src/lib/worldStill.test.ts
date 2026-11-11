import { describe, expect, it } from 'vitest';
import { OG_CROP, OG_IMAGE, STILL_WIDTHS, stillPath, stillSrcset, stripOgStill, stripStills } from './worldStill';

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

describe('OG_IMAGE', () => {
  it('is the Day still as a 1200×630 JPEG, under /stills', () => {
    expect(OG_IMAGE).toEqual({ src: '/stills/og-world-day.jpg', width: 1200, height: 630, type: 'image/jpeg' });
  });
});

describe('stripOgStill', () => {
  const head = [
    '<head><meta property="og:title" content="T">',
    '<meta property="og:image" content="https://x/stills/og-world-day.jpg" data-og-still>',
    '<meta property="og:image:alt" content="a" data-og-still="">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:image" data-og-still content="https://x/stills/og-world-day.jpg"></head>',
  ].join('');

  it('takes out the tags of the still and makes the Twitter card a small one', () => {
    expect(stripOgStill(head)).toBe(
      '<head><meta property="og:title" content="T"><meta name="twitter:card" content="summary"></head>',
    );
  });
  it('leaves a page whose image is not the still as it is', () => {
    const cover = '<meta property="og:image" content="https://x/c.png"><meta name="twitter:card" content="summary_large_image">';
    expect(stripOgStill(cover)).toBe(cover);
  });
});

describe('OG_CROP', () => {
  it('cuts the 1600×1000 still to 1.91:1 across its middle, full width', () => {
    expect(OG_CROP).toEqual({ x: 0, y: 80, width: 1600, height: 840 });
  });
});
