import { describe, expect, it } from 'vitest';
import { rollSeed, seedFromUrl, withSeed } from './seedUrl';

const BASE = 'https://example.test/';

describe('seedFromUrl', () => {
  it('reads ?seed=', () => {
    expect(seedFromUrl(new URL('/?seed=1234', BASE))).toBe('1234');
  });
  it('treats a missing or empty ?seed= as none', () => {
    expect(seedFromUrl(new URL('/', BASE))).toBeNull();
    expect(seedFromUrl(new URL('/?seed=', BASE))).toBeNull();
  });
});

describe('withSeed', () => {
  it('adds the Seed to a route link', () => {
    expect(withSeed('/garden', '1234', 'lighthouse', BASE)).toBe('/garden?seed=1234');
  });
  it('replaces an old Seed and keeps other parameters and the hash', () => {
    expect(withSeed('/dock?seed=1&tab=a#boats', '42', 'lighthouse', BASE)).toBe('/dock?seed=42&tab=a#boats');
  });
  it('leaves the default Seed out', () => {
    expect(withSeed('/garden?seed=1234', 'lighthouse', 'lighthouse', BASE)).toBe('/garden');
  });
});

describe('rollSeed', () => {
  it('rolls a numeric Seed', () => {
    expect(rollSeed(null, () => 0.5)).toBe('500000000');
  });
  it('never rolls the current Seed again', () => {
    const values = [0.5, 0.5, 0.25];
    expect(rollSeed('500000000', () => values.shift()!)).toBe('250000000');
  });
});
