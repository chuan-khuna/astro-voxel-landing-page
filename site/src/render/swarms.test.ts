import { describe, expect, it } from 'vitest';
import { BIOME_IDS, generateWorld, PARTICLE_KINDS, type World } from '@/world';
import { particlesOut, swarmShown, swarms, SWARM_WOBBLE } from './swarms';

const counts = { projects: 8, clients: 5, partners: 3 };
const seeds = Array.from({ length: 40 }, (_, i) => `swarms-${i}`);
const worlds = seeds.map((seed) => generateWorld(seed, counts));

describe('swarms', () => {
  it('covers every Biome', () => {
    expect(new Set(worlds.map((w) => w.biome.id))).toEqual(new Set(BIOME_IDS));
  });

  it('is the same for the same World', () => {
    expect(swarms(generateWorld('harbour', counts))).toEqual(swarms(generateWorld('harbour', counts)));
  });

  it('puts out butterflies by Day and fireflies at Night in the tropics, ash Day and Night on volcanic Isles', () => {
    const of = (biome: string) => worlds.find((w) => w.biome.id === biome)!;
    expect(particlesOut(of('tropical'), 'day')).toEqual(['butterfly']);
    expect(particlesOut(of('tropical'), 'night')).toEqual(['firefly']);
    expect(particlesOut(of('northern'), 'day')).toEqual(['snow']);
    expect(particlesOut(of('autumn'), 'day')).toEqual([]);
    expect(particlesOut(of('volcanic'), 'night')).toEqual(['ash']);
  });

  it('fills each area with its own kind, and only the kinds the World has areas for', () => {
    for (const world of worlds) {
      const all = swarms(world);
      for (const kind of PARTICLE_KINDS) {
        const areas = world.particles.filter((a) => a.kind === kind);
        expect(all[kind].length > 0, `${world.seed} ${kind}`).toBe(areas.length > 0);
        for (const p of all[kind]) expect(areas[p.area]?.kind, world.seed).toBe(kind);
      }
    }
  });

  /** The box a particle's area allows, less what the shader adds to its path. */
  const inside = (world: World, kind: (typeof PARTICLE_KINDS)[number]) => {
    const areas = world.particles.filter((a) => a.kind === kind);
    return swarms(world)[kind].every((p) => {
      const a = areas[p.area]!;
      const w = SWARM_WOBBLE[kind];
      const fits = (centre: number, sweep: number, lo: number, hi: number, wobble: number) =>
        centre - Math.abs(sweep) - wobble >= lo - 1e-9 && centre + Math.abs(sweep) + wobble <= hi + 1e-9;
      return (
        fits(p.centre.x, p.sweep.x, a.centre.x - a.radius, a.centre.x + a.radius, w.across) &&
        fits(p.centre.z, p.sweep.z, a.centre.z - a.radius, a.centre.z + a.radius, w.across) &&
        fits(p.centre.y, p.sweep.y, a.floor, a.top, w.up)
      );
    });
  };

  it('keeps every particle inside its area’s box, the shader’s flutter and gusts included', () => {
    for (const world of worlds) for (const kind of PARTICLE_KINDS) expect(inside(world, kind), `${world.seed} ${kind}`).toBe(true);
  });

  it('drifts snow and ash down the wind as they fall', () => {
    for (const world of worlds) {
      const { direction } = world.wind;
      for (const p of [...swarms(world).snow, ...swarms(world).ash]) {
        // It goes from centre − sweep to centre + sweep: down, and along the wind.
        expect(p.sweep.y, world.seed).toBeLessThan(0);
        const along = p.sweep.x * direction.x + p.sweep.z * direction.z;
        const across = p.sweep.x * -direction.z + p.sweep.z * direction.x;
        expect(along, world.seed).toBeGreaterThan(0);
        expect(Math.abs(across), world.seed).toBeLessThan(1e-9);
      }
    }
  });

  it('shows the life tier’s share, and the first share reaches every area', () => {
    expect(swarmShown(10, 'full')).toBe(10);
    expect(swarmShown(10, 'reduced')).toBe(5);
    expect(swarmShown(9, 'still')).toBe(5);
    for (const world of worlds) {
      for (const kind of PARTICLE_KINDS) {
        const all = swarms(world)[kind];
        const areas = new Set(all.map((p) => p.area));
        const first = new Set(all.slice(0, swarmShown(all.length, 'reduced')).map((p) => p.area));
        expect(first, `${world.seed} ${kind}`).toEqual(areas);
      }
    }
  });
});
