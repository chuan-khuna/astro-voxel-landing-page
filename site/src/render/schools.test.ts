import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { SEA_BOB, SEA_LEVEL } from './seaModel';
import { FISH_REACH, FISH_THICKNESS, fishAt, fishShown, LEAP_TIME, schoolFish, sprayAt, sprayDrops, SPRAY_SIZE } from './schools';

const counts = { projects: 8, clients: 5, partners: 3 };
const worlds = Array.from({ length: 30 }, (_, i) => generateWorld(`schools-${i}`, counts));
/** Every tenth of a second over the first two minutes. */
const times = Array.from({ length: 1200 }, (_, i) => i / 10);

// Each check plays every fish of 30 Worlds over two minutes: give it time when files run in parallel.
describe('fish schools', { timeout: 20_000 }, () => {
  it('swims every fish of every school, school by school, the same for the same World', () => {
    for (const world of worlds) {
      const fish = schoolFish(world);
      expect(fish.map((f) => f.school), world.seed).toEqual(world.fish.flatMap((s, i) => Array.from({ length: s.size }, () => i)));
    }
    expect(schoolFish(generateWorld('harbour', counts))).toEqual(schoolFish(generateWorld('harbour', counts)));
  });

  it('keeps every fish\'s whole body inside its school\'s square at all times, leaping or not', () => {
    for (const world of worlds) {
      for (const f of schoolFish(world)) {
        const school = world.fish[f.school]!;
        for (const t of times) {
          const p = fishAt(f, t);
          expect(Math.abs(p.x - school.centre.x) + FISH_REACH, world.seed).toBeLessThanOrEqual(school.radius);
          expect(Math.abs(p.z - school.centre.z) + FISH_REACH, world.seed).toBeLessThanOrEqual(school.radius);
        }
      }
    }
  });

  it('keeps a swimming fish under the water at its lowest, and moving', () => {
    const f = schoolFish(worlds.find((w) => w.fish.length > 0)!)[0]!;
    let under = 0;
    for (const t of times) {
      const p = fishAt(f, t);
      if (!p.leaping) {
        under++;
        expect(p.y + FISH_THICKNESS).toBeLessThanOrEqual(SEA_LEVEL - SEA_BOB);
        expect(p.pitch).toBeCloseTo(0);
      }
    }
    expect(under).toBeGreaterThan(times.length * 0.8);
    const a = fishAt(f, 1);
    const b = fishAt(f, 2);
    const speed = Math.hypot(b.x - a.x, b.z - a.z);
    expect(speed).toBeGreaterThan(0.1);
    expect(speed).toBeLessThan(0.4);
  });

  it('now and then has one fish of a school leap clear of the water, nose up then nose down', () => {
    for (const world of worlds.slice(0, 10)) {
      const fish = schoolFish(world);
      for (const [i, school] of world.fish.entries()) {
        const own = fish.filter((f) => f.school === i);
        // Over two minutes each school leaps several times, never two fish at once.
        let leaps = 0;
        let was = false;
        for (const t of times) {
          const leaping = own.filter((f) => fishAt(f, t).leaping);
          expect(leaping.length, world.seed).toBeLessThanOrEqual(1);
          if (leaping.length && !was) leaps++;
          was = leaping.length > 0;
        }
        expect(leaps, `${world.seed} school ${i} of ${school.size}`).toBeGreaterThanOrEqual(6);
      }
      // At the top of a leap the fish is clear of the highest water; it rises nose up and falls nose down.
      const f = fish[0]!;
      // Its leap period starts (and it leaves the water) when its phase comes round to 0.
      const start = f.leapEvery * (1 - f.leapPhase);
      expect(fishAt(f, start + 0.01).leaping).toBe(true);
      expect(fishAt(f, start - 0.01).leaping).toBe(false);
      let top = { y: -1, pitch: 0 };
      for (let s = 0; s < LEAP_TIME; s += 0.01) {
        const p = fishAt(f, start + s);
        if (p.y > top.y) top = p;
      }
      expect(top.y, world.seed).toBeGreaterThan(SEA_LEVEL + SEA_BOB);
      expect(fishAt(f, start + LEAP_TIME * 0.25).pitch).toBeGreaterThan(0.3);
      expect(fishAt(f, start + LEAP_TIME * 0.75).pitch).toBeLessThan(-0.3);
    }
  });

  it('shows the life tier\'s share of the schools, whole schools', () => {
    const world = worlds.find((w) => w.fish.length >= 3)!;
    const total = world.fish.reduce((n, s) => n + s.size, 0);
    expect(fishShown(world.fish, 'full')).toBe(total);
    const half = world.fish.slice(0, Math.ceil(world.fish.length / 2)).reduce((n, s) => n + s.size, 0);
    expect(fishShown(world.fish, 'reduced')).toBe(half);
    expect(fishShown(world.fish, 'still')).toBe(half);
  });
});

describe('spray', { timeout: 20_000 }, () => {
  it('splashes up from the water as a fish leaps and as it falls back, and is gone between leaps', () => {
    for (const world of worlds.slice(0, 10)) {
      const fish = schoolFish(world);
      const drops = sprayDrops(fish, world.seed);
      expect(drops.length, world.seed).toBeGreaterThan(0);
      for (const drop of drops) {
        const f = fish[drop.fish]!;
        const school = world.fish[f.school]!;
        let seen = 0;
        for (const t of times) {
          const p = sprayAt(drop, f, t);
          if (!p) continue;
          seen++;
          // Only round a leap's start or end, above the water and inside its school's square.
          const leap = fishAt(f, t).leaping || fishAt(f, t - 0.5).leaping;
          expect(leap, world.seed).toBe(true);
          expect(p.y, world.seed).toBeGreaterThanOrEqual(SEA_LEVEL - SPRAY_SIZE);
          expect(Math.abs(p.x - school.centre.x) + SPRAY_SIZE, world.seed).toBeLessThanOrEqual(school.radius);
          expect(Math.abs(p.z - school.centre.z) + SPRAY_SIZE, world.seed).toBeLessThanOrEqual(school.radius);
        }
        expect(seen, world.seed).toBeGreaterThan(0);
        expect(seen, world.seed).toBeLessThan(times.length * 0.1);
      }
    }
  });
});
