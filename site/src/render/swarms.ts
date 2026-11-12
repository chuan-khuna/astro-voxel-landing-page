/**
 * The Biome's particles (ADR 0005): butterflies, fireflies, snow and ash,
 * each a single-colour ⅛-unit cube. This works out every particle's path,
 * colour and timing once a World, inside the spawn areas `generateWorld`
 * placed (`world/particles.ts`); `particles.ts` moves them in the shader on
 * the shared clock. Day or Night decides which kinds are out
 * (`particlesOut`); the life tier how many (`swarmShown`).
 *
 * Every particle moves about its `centre` by at most `sweep` on each axis,
 * plus what the shader adds (`SWARM_WOBBLE`), and never leaves its area:
 *
 * - butterflies and fireflies wander: a loose loop of `period` seconds,
 *   `centre + sweep × (sin a, sin(1.7a + 1), sin(0.6a + 2))`, `phase` of
 *   the way round at time 0. Butterflies flap fast and bob; fireflies
 *   drift slowly and blink every `beat` seconds;
 * - snow and ash fall: from `centre − sweep` (high, up the wind) to
 *   `centre + sweep` (low, down the wind) every `period` seconds, fading in
 *   and out at either end, swaying across the wind every `beat` seconds and
 *   pushed by its gusts.
 *
 * Seeded from the World's own sequence (`<seed>/swarms`). Pure: no three.js.
 */
import { PARTICLE_KINDS, PARTICLE_SETS, type ParticleArea, type ParticleKind, type World } from '@/world';
import { createRng } from '@/world/prng';
import { LIFE_TIERS, type LifeTierName } from '@/lib/lifeTier';
import type { Theme } from '@/lib/theme';
import { oklchToLinear, type Rgb } from './palette';
import type { Point } from './structureMeshes';
import { STRUCTURE } from './voxelTiers';

/** A particle's edge, in world units: one ⅛-unit voxel. */
export const PARTICLE_SIZE = 1 / STRUCTURE;

/** How the shader moves a kind: round a loop, or down and down the wind. */
export const SWARM_MOTION: Record<ParticleKind, 'wander' | 'fall'> = {
  butterfly: 'wander',
  firefly: 'wander',
  snow: 'fall',
  ash: 'fall',
};

/** World units a snowflake or ash flake sways across the wind at most (in `SWARM_WOBBLE`). */
export const FALL_SWAY = 0.1;
/** World units a gust at full strength pushes a falling flake off its way at most (in `SWARM_WOBBLE`). */
export const FALL_GUST = 0.15;
/** World units a butterfly bobs up and down as it flaps (in `SWARM_WOBBLE`). */
export const BUTTERFLY_BOB = 0.06;

/**
 * What the shader adds to a particle's path at most, in world units, across
 * the ground and upwards, plus the cube's whole edge (more than half of it,
 * so a turning cube stays in too), so the whole cube stays in its area: a butterfly's bob, a snowflake's sway and the gusts' push.
 */
export const SWARM_WOBBLE: Record<ParticleKind, { across: number; up: number }> = {
  butterfly: { across: PARTICLE_SIZE, up: BUTTERFLY_BOB + PARTICLE_SIZE },
  firefly: { across: PARTICLE_SIZE, up: PARTICLE_SIZE },
  snow: { across: FALL_SWAY + FALL_GUST + PARTICLE_SIZE, up: PARTICLE_SIZE },
  ash: { across: FALL_SWAY + FALL_GUST + PARTICLE_SIZE, up: PARTICLE_SIZE },
};

/** Particles in each area of a kind. */
const PER_AREA: Record<ParticleKind, number> = { butterfly: 3, firefly: 5, snow: 8, ash: 7 };
/** World units a flake falls a second: snow, ash. */
const FALL_SPEED = { snow: 0.35, ash: 0.25 };
/** World units a flake drifts down the wind per unit it falls: least and most. */
const DRIFT = { snow: [0.3, 0.6], ash: [0.5, 0.9] } as const;

/** Each kind's colours (OKLCH): every particle takes one. Bright butterflies, warm fireflies, white snow, grey ash with an odd ember. */
const COLOURS: Record<ParticleKind, Rgb[]> = {
  butterfly: [
    { l: 0.78, c: 0.16, h: 60 },
    { l: 0.85, c: 0.15, h: 95 },
    { l: 0.7, c: 0.15, h: 250 },
    { l: 0.72, c: 0.17, h: 340 },
    { l: 0.95, c: 0.03, h: 90 },
  ].map(oklchToLinear),
  firefly: [{ l: 0.93, c: 0.17, h: 115 }, { l: 0.9, c: 0.16, h: 95 }].map(oklchToLinear),
  snow: [{ l: 0.98, c: 0.01, h: 240 }, { l: 0.94, c: 0.02, h: 240 }].map(oklchToLinear),
  ash: [
    { l: 0.42, c: 0.01, h: 40 },
    { l: 0.55, c: 0.01, h: 40 },
    { l: 0.48, c: 0.01, h: 40 },
    { l: 0.7, c: 0.15, h: 45 },
  ].map(oklchToLinear),
};

export interface SwarmParticle {
  /** Which of the World's areas of its kind it lives in (its index among them). */
  area: number;
  /** The middle of its path. */
  centre: Point;
  /** How far it goes from `centre` on each axis: a fall's whole way is `centre − sweep` to `centre + sweep`. */
  sweep: Point;
  /** Seconds round its loop, or from one fall to the next. */
  period: number;
  /** How far into its period it is at time 0, 0–1. */
  phase: number;
  /** Seconds a flap, a blink or a sway takes. */
  beat: number;
  /** Linear RGB. */
  colour: Rgb;
}

/** The kinds of particle out in a World by Day or at Night. */
export const particlesOut = (world: Pick<World, 'biome'>, theme: Theme): readonly ParticleKind[] => PARTICLE_SETS[world.biome.id][theme];

/** How many of `total` particles of one kind a life tier shows: its share, rounded up (the first ones of `swarms`). */
export const swarmShown = (total: number, tier: LifeTierName): number => Math.ceil(total * LIFE_TIERS[tier].share);

/**
 * Every particle in a World, by kind, for every kind it has areas for (Day
 * and Night both). Ordered round the areas (the first particle of every
 * area, then the second…), so any first share of them reaches every area.
 */
export function swarms(world: Pick<World, 'seed' | 'particles' | 'wind'>): Record<ParticleKind, SwarmParticle[]> {
  const rng = createRng(`${world.seed}/swarms`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rng() * items.length)]!;
  const { direction } = world.wind;

  const particle = (kind: ParticleKind, area: ParticleArea, index: number): SwarmParticle => {
    const wobble = SWARM_WOBBLE[kind];
    const room = area.radius - wobble.across;
    const middle = (area.floor + area.top) / 2;
    const rise = (area.top - area.floor) / 2 - wobble.up;
    const colour = pick(COLOURS[kind]);
    if (SWARM_MOTION[kind] === 'wander') {
      // Off the middle by up to a third of the room, and round a loop in the rest of it.
      const off = { x: between(-1, 1) * room * 0.33, z: between(-1, 1) * room * 0.33 };
      const lift = between(-1, 1) * rise * 0.3;
      return {
        area: index,
        centre: { x: area.centre.x + off.x, y: middle + lift, z: area.centre.z + off.z },
        sweep: { x: (room - Math.abs(off.x)) * between(0.5, 1), y: (rise - Math.abs(lift)) * between(0.4, 1), z: (room - Math.abs(off.z)) * between(0.5, 1) },
        period: kind === 'butterfly' ? between(5, 9) : between(9, 15),
        phase: rng(),
        beat: kind === 'butterfly' ? between(0.18, 0.28) : between(2, 4.5),
        colour,
      };
    }
    // A fall: from the top to the floor, drifting down the wind as far as the box allows.
    const flake = kind === 'snow' ? 'snow' : 'ash';
    const drop = 2 * rise;
    const steepest = Math.max(Math.abs(direction.x), Math.abs(direction.z));
    const drift = Math.min(drop * between(DRIFT[flake][0], DRIFT[flake][1]), (2 * room * 0.9) / steepest);
    const sweep = { x: (direction.x * drift) / 2, y: -rise, z: (direction.z * drift) / 2 };
    const centre = {
      x: area.centre.x + between(-1, 1) * (room - Math.abs(sweep.x)),
      y: middle,
      z: area.centre.z + between(-1, 1) * (room - Math.abs(sweep.z)),
    };
    return { area: index, centre, sweep, period: drop / FALL_SPEED[flake], phase: rng(), beat: between(1.6, 3), colour };
  };

  const out = Object.fromEntries(PARTICLE_KINDS.map((k) => [k, [] as SwarmParticle[]])) as Record<ParticleKind, SwarmParticle[]>;
  for (const kind of PARTICLE_KINDS) {
    const areas = world.particles.filter((a) => a.kind === kind);
    const byArea = areas.map((area, i) => Array.from({ length: PER_AREA[kind] }, () => particle(kind, area, i)));
    for (let n = 0; n < PER_AREA[kind]; n++) for (const swarm of byArea) out[kind].push(swarm[n]!);
  }
  return out;
}
