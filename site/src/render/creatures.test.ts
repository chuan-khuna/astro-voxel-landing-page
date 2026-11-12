import { describe, expect, it } from 'vitest';
import { BIRD_ABOVE, BIRD_BELOW, BIRD_REACH, generateWorld, type World } from '@/world';
import { animalAt, birdAt, creaturesShown, walkingAnimals, ANIMAL_GAITS, FLIGHTS, type AnimalPose } from './creatures';

const counts = { projects: 6, clients: 5, partners: 3 };
const worlds: World[] = ['harbour', 'seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5'].map((s) => generateWorld(s, counts));
const withAnimals = worlds.filter((w) => w.animals.length > 0);

/** Distance from a point to the segment a–b across the ground. */
const toSegment = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - u * dx, p.z - a.z - u * dz);
};

describe('land animals on the move', () => {
  it('works out the same animals for the same World', () => {
    for (const w of withAnimals) expect(walkingAnimals(w)).toEqual(walkingAnimals(w));
  });

  it('keeps every animal on its route (cell middles joined in order) at all times, on its ground', () => {
    for (const w of withAnimals) {
      for (const [i, a] of walkingAnimals(w).entries()) {
        const route = w.animals[i]!.route.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
        for (let t = 0; t < 120; t += 0.37) {
          const pose = animalAt(a, t);
          const off = Math.min(...route.slice(1).map((c, k) => toSegment(pose, route[k]!, c)));
          expect(off, `${w.seed} animal ${i} at ${t}`).toBeLessThan(1e-6);
          expect(pose.y, `${w.seed} ${t}`).toBeGreaterThanOrEqual(w.animals[i]!.y - ANIMAL_GAITS[a.species].lieDown - 1e-9);
          expect(pose.y, `${w.seed} ${t}`).toBeLessThanOrEqual(w.animals[i]!.y + ANIMAL_GAITS[a.species].bob + 1e-9);
        }
      }
    }
  });

  it('walks to the end of its route and back to rest within one round, resting, grazing and looking round on the way', () => {
    for (const w of withAnimals) {
      for (const [i, a] of walkingAnimals(w).entries()) {
        const { route } = w.animals[i]!;
        const end = { x: route.at(-1)!.x + 0.5, z: route.at(-1)!.z + 0.5 };
        const seen = new Set<AnimalPose['action']>();
        let reached = false;
        for (let t = 0; t < a.period; t += 0.05) {
          const pose = animalAt(a, t);
          seen.add(pose.action);
          if (Math.hypot(pose.x - end.x, pose.z - end.z) < 1e-6) reached = true;
        }
        expect(reached, `${w.seed} ${i}`).toBe(true);
        expect([...seen].toSorted(), `${w.seed} ${i}`).toEqual(['graze', 'look', 'rest', 'walk']);
      }
    }
  });

  it('never jumps: a twentieth of a second moves it a little, all the way round and on into the next round', () => {
    for (const w of withAnimals) {
      for (const a of walkingAnimals(w)) {
        for (let t = 0; t < 2 * a.period; t += 0.05) {
          const p = animalAt(a, t);
          const q = animalAt(a, t + 0.05);
          expect(Math.hypot(q.x - p.x, q.z - p.z), `${w.seed} ${t}`).toBeLessThan(0.1);
          const turned = Math.abs(Math.atan2(Math.sin(q.yaw - p.yaw), Math.cos(q.yaw - p.yaw)));
          expect(turned, `${w.seed} ${t}`).toBeLessThan(0.5);
          expect(Math.abs(q.y - p.y), `${w.seed} ${t}`).toBeLessThan(0.1);
        }
      }
    }
  });

  it('faces the way it walks (0 is +z, turning towards +x)', () => {
    for (const w of withAnimals) {
      for (const a of walkingAnimals(w)) {
        for (let t = 0; t < a.period; t += 0.1) {
          const p = animalAt(a, t);
          if (p.action !== 'walk') continue;
          const q = animalAt(a, t + 0.01);
          if (q.action !== 'walk' || Math.hypot(q.x - p.x, q.z - p.z) < 1e-6) continue;
          expect(Math.cos(p.yaw - Math.atan2(q.x - p.x, q.z - p.z)), `${w.seed} ${t}`).toBeGreaterThan(0.99);
        }
      }
    }
  });

  it('dips its head to graze and turns it to look round, never while walking', () => {
    for (const w of withAnimals) {
      for (const a of walkingAnimals(w)) {
        let grazed = 0;
        let looked = 0;
        for (let t = 0; t < a.period; t += 0.05) {
          const p = animalAt(a, t);
          if (p.action === 'walk') {
            expect(Math.abs(p.headYaw) + Math.abs(p.headPitch), `${w.seed} ${t}`).toBeLessThan(0.25);
          }
          grazed = Math.max(grazed, p.headPitch);
          looked = Math.max(looked, Math.abs(p.headYaw));
        }
        expect(grazed, w.seed).toBeGreaterThan(0.4);
        expect(looked, w.seed).toBeGreaterThan(0.3);
      }
    }
  });
});

describe('birds and bats in flight', () => {
  const flights = worlds.flatMap((w) => w.birds);

  it('flies each one round its circle at its height, facing the way it flies', () => {
    expect(flights.length).toBeGreaterThan(5);
    for (const f of flights) {
      for (let t = 0; t < 30; t += 0.21) {
        const p = birdAt(f, t);
        const off = Math.hypot(p.x - f.centre.x, p.z - f.centre.z) - f.radius;
        expect(Math.abs(off)).toBeLessThanOrEqual(FLIGHTS[f.kind].flutter + 1e-9);
        expect(Math.abs(p.y - f.height)).toBeLessThanOrEqual(FLIGHTS[f.kind].bob + 1e-9);
        const q = birdAt(f, t + 0.01);
        expect(Math.cos(p.yaw - Math.atan2(q.x - p.x, q.z - p.z))).toBeGreaterThan(0.95);
      }
    }
  });

  it('beats its wings: a bird in bursts between glides, a bat all the time', () => {
    for (const f of flights) {
      const flaps = Array.from({ length: 400 }, (_, i) => birdAt(f, i * 0.05).flap);
      expect(Math.max(...flaps) - Math.min(...flaps)).toBeGreaterThan(0.5);
      for (const v of flaps) expect(Math.abs(v)).toBeLessThanOrEqual(FLIGHTS[f.kind].flap + 1e-9);
    }
  });

  it('keeps every wingtip inside the room the World gives a bird: never lower than `BIRD_BELOW`, higher than `BIRD_ABOVE` or wider than `BIRD_REACH` (plus a flutter the World checks for)', () => {
    for (const kind of ['bird', 'bat'] as const) {
      const { halfSpan, flap, bank, bob, flutter } = FLIGHTS[kind];
      const tilt = Math.sin(flap + bank);
      expect(halfSpan * tilt + bob + 1 / 8).toBeLessThanOrEqual(BIRD_ABOVE);
      expect(halfSpan * tilt + bob + 1 / 8).toBeLessThanOrEqual(BIRD_BELOW);
      expect(halfSpan + flutter).toBeLessThanOrEqual(BIRD_REACH + 0.1);
    }
  });

  it('holds still on a frozen clock: the same seconds give the same pose', () => {
    for (const f of flights) expect(birdAt(f, 12.5)).toEqual(birdAt(f, 12.5));
  });
});

describe('the life tier', () => {
  it('shows every creature at full, half (rounded up) at reduced and still', () => {
    expect(creaturesShown(7, 'full')).toBe(7);
    expect(creaturesShown(7, 'reduced')).toBe(4);
    expect(creaturesShown(7, 'still')).toBe(4);
    expect(creaturesShown(0, 'full')).toBe(0);
  });
});
