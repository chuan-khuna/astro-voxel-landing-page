import { describe, expect, it } from 'vitest';
import { STATS_PARAM, parseStatsOn, statsAvailable, withStats } from './renderStats';

const url = (href: string) => new URL(href, 'https://example.test');

describe('statsAvailable', () => {
  it('is on in astro dev, with or without ?stats', () => {
    expect(statsAvailable(true, url('/'))).toBe(true);
    expect(statsAvailable(true, url('/garden?seed=12'))).toBe(true);
  });
  it('is on in a build only when the URL has ?stats, with or without a value', () => {
    expect(statsAvailable(false, url('/?stats'))).toBe(true);
    expect(statsAvailable(false, url('/garden?seed=12&stats=1'))).toBe(true);
  });
  it('is off in a build without ?stats', () => {
    expect(statsAvailable(false, url('/'))).toBe(false);
    expect(statsAvailable(false, url('/garden?seed=12'))).toBe(false);
    expect(statsAvailable(false, url('/?statistics'))).toBe(false);
  });
});

describe('parseStatsOn', () => {
  it('reads a stored on or off', () => {
    expect(parseStatsOn('on', false)).toBe(true);
    expect(parseStatsOn('off', true)).toBe(false);
  });
  it('falls back to the default for nothing stored or anything else', () => {
    expect(parseStatsOn(null, true)).toBe(true);
    expect(parseStatsOn(null, false)).toBe(false);
    expect(parseStatsOn('yes', false)).toBe(false);
  });
});

describe('withStats', () => {
  it('adds ?stats to a link, keeping its path, other parameters and hash', () => {
    expect(withStats('/garden?seed=12#top', 'https://example.test/')).toBe(`/garden?seed=12&${STATS_PARAM}#top`);
    expect(withStats('/', 'https://example.test/dock')).toBe(`/?${STATS_PARAM}`);
  });
  it('leaves a link that already has it alone', () => {
    expect(withStats('/garden?stats', 'https://example.test/')).toBe('/garden?stats');
  });
});
