import { describe, expect, it } from 'vitest';
import { LIFE_TIERS, TIER_WINDOW_MS, createLifeTierWatch, lifeTierShown, startingLifeTier } from './lifeTier';

/** Feed `seconds` of frames `ms` apart; returns the tier after the last. */
const run = (watch: ReturnType<typeof createLifeTierWatch>, ms: number, seconds: number) => {
  for (let t = 0; t < seconds * 1000; t += ms) watch.frame(ms);
  return watch.tier;
};

describe('startingLifeTier', () => {
  it('starts a desktop at full and a phone at reduced', () => {
    expect(startingLifeTier('full')).toBe('full');
    expect(startingLifeTier('reduced')).toBe('reduced');
  });
  it('takes `?life=full|reduced|still` whatever the device, and ignores anything else', () => {
    expect(startingLifeTier('full', 'still')).toBe('still');
    expect(startingLifeTier('reduced', 'full')).toBe('full');
    expect(startingLifeTier('full', 'fast')).toBe('full');
    expect(startingLifeTier('reduced', null)).toBe('reduced');
  });
});

describe('the life tier watch', () => {
  it('keeps the tier while frames keep up: 60 fps at full, 30 fps at reduced', () => {
    expect(run(createLifeTierWatch('full'), 1000 / 60, 30)).toBe('full');
    expect(run(createLifeTierWatch('reduced'), 1000 / 30, 30)).toBe('reduced');
  });

  it('drops one tier after a whole window of slow frames', () => {
    const watch = createLifeTierWatch('full');
    // 10 fps: slow for full. Not yet a whole window...
    expect(run(watch, 100, TIER_WINDOW_MS / 1000 - 0.5)).toBe('full');
    // ...then it is.
    expect(run(watch, 100, 1)).toBe('reduced');
  });

  it('steps down one tier at a time, full to reduced to still', () => {
    const watch = createLifeTierWatch('full');
    expect(run(watch, 100, TIER_WINDOW_MS / 1000)).toBe('reduced');
    expect(run(watch, 100, TIER_WINDOW_MS / 1000)).toBe('still');
    expect(run(watch, 100, 30)).toBe('still');
  });

  it('holds a tier that runs a little under its target: 45 fps stays full, 24 fps stays reduced', () => {
    expect(run(createLifeTierWatch('full'), 1000 / 45, 30)).toBe('full');
    expect(run(createLifeTierWatch('reduced'), 1000 / 24, 30)).toBe('reduced');
  });

  it('never climbs back during the visit, however fast frames come after a drop', () => {
    const watch = createLifeTierWatch('full');
    run(watch, 100, TIER_WINDOW_MS / 1000);
    expect(run(watch, 1000 / 120, 60)).toBe('reduced');
  });

  it('shrugs off a single hitch (a shader compiling) among fast frames', () => {
    const watch = createLifeTierWatch('full');
    watch.frame(900);
    expect(run(watch, 1000 / 60, 30)).toBe('full');
  });

  it('does not count a gap (a hidden tab, an idle World) as a frame', () => {
    const watch = createLifeTierWatch('full');
    for (let i = 0; i < 10; i++) watch.frame(60_000);
    expect(run(watch, 1000 / 60, 10)).toBe('full');
  });

  it('never drops a pinned tier (`?life=`, for measuring)', () => {
    expect(run(createLifeTierWatch('full', { pinned: true }), 200, 30)).toBe('full');
  });
});

describe('lifeTierShown', () => {
  it('is still under reduced motion, whatever the watch says', () => {
    expect(lifeTierShown('full', true)).toBe('still');
    expect(lifeTierShown('reduced', true)).toBe('still');
  });
  it('follows the watch once reduced motion is off again', () => {
    expect(lifeTierShown('full', false)).toBe('full');
    expect(lifeTierShown('reduced', false)).toBe('reduced');
  });
});

describe('the tiers', () => {
  it('cap ambient frames at 30 fps from the reduced tier down, and draw no ambient frames when still', () => {
    expect(LIFE_TIERS.full.ambientFps).toBe(0);
    expect(LIFE_TIERS.reduced.ambientFps).toBe(30);
    expect(LIFE_TIERS.still.moves).toBe(false);
    expect(LIFE_TIERS.full.moves && LIFE_TIERS.reduced.moves).toBe(true);
  });
  it('show fewer living things on the reduced tier than on full', () => {
    expect(LIFE_TIERS.reduced.share).toBeLessThan(LIFE_TIERS.full.share);
    expect(LIFE_TIERS.full.share).toBe(1);
  });
});
