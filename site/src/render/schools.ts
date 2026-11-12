/**
 * The fish (ADR 0005): every fish of every school `generateWorld` placed in
 * the shallows (`World.fish`, `world/fish.ts`), its path, its leaps and the
 * spray they throw up. This works out each fish's numbers once a World;
 * `fish.ts` plays them in the vertex shader on the shared clock, by the same
 * sums as `fishAt` and `sprayAt` here (which the tests check). Pure: no
 * three.js.
 *
 * - A school swims round a loop about its centre, its fish one behind the
 *   other (`SCHOOL_GAP` apart) in three lanes (`LANE` apart), under the
 *   water (`FISH_Y`), wiggling.
 * - Now and then one fish of a school leaps: it rises nose up out of the
 *   water, arcs `LEAP_HEIGHT` and falls nose down `LEAP_FORWARD` ahead,
 *   then drifts back to its place under the water. The fish take turns, so
 *   a school leaps once every `leapEvery / size` seconds, never two at once.
 * - As it leaves the water and as it falls back, a few ⅛-unit drops of
 *   spray fly up from where it broke the surface and fall back.
 *
 * Everything keeps inside the school's square: loop, lane, leap, the
 * fish's turning body (`FISH_REACH`) and the spray.
 *
 * Seeded from the World's own sequence (`<seed>/schools`).
 */
import type { FishSchool, World } from '@/world';
import { createRng } from '@/world/prng';
import { LIFE_TIERS, type LifeTierName } from '@/lib/lifeTier';
import { SEA_LEVEL } from './seaModel';
import { STRUCTURE } from './voxelTiers';

/** How far a fish's body reaches from its middle across the water, in units, any way it turns (its structure's farthest corner). */
export const FISH_REACH = 0.36;
/** A fish's thickness: one ⅛-unit voxel. */
export const FISH_THICKNESS = 1 / STRUCTURE;
/** The underside of a swimming fish, in units: its back stays under the lowest the water sinks to (the seabed, y = 0, hides its belly). */
export const FISH_Y = -0.02;
/** Seconds a leap takes, out of the water and back in. */
export const LEAP_TIME = 0.9;
/** How high a leap rises, in units. */
export const LEAP_HEIGHT = 0.45;
/** How far ahead of its place a leaping fish lands, in units. */
export const LEAP_FORWARD = 0.3;
/** Seconds a fish takes after a leap to drift back to its place in the school, under the water. */
export const LEAP_BACK = 2;
/** Radians a fish's heading wiggles either way as it swims, and how many wiggles a second. */
export const WIGGLE = 0.15;
export const WIGGLE_RATE = 1.6;
/** A drop of spray's edge, in units: one ⅛-unit voxel. */
export const SPRAY_SIZE = 1 / STRUCTURE;
/** How fast spray falls back, in units a second a second. */
export const SPRAY_GRAVITY = 6;
/** Units from one fish of a school to the next, along the loop. */
const SCHOOL_GAP = 0.28;
/** Units between a school's lanes across the loop. */
const LANE = 0.1;
/** Drops of spray thrown up as a fish leaves the water, and again as it falls back in. */
const DROPS = 3;

/** One fish's numbers: the shader's per-instance attributes. */
export interface SwimmingFish {
  /** Which of the World's schools it swims in (its index). */
  school: number;
  /** The middle of its school's loop. */
  centre: { x: number; z: number };
  /** Its distance from the centre, in units: the school's loop plus its lane. */
  ring: number;
  /** Radians a second it goes round (its sign, which way). */
  turn: number;
  /** Where round the loop it is at time 0, radians. */
  angle: number;
  /** Seconds between two of its own leaps. */
  leapEvery: number;
  /** How far into its leap period it is at time 0, 0–1. */
  leapPhase: number;
  /** Its wiggle's phase, radians. */
  wiggle: number;
}

/** Where a fish is: its middle across the water (x, z), its underside (y), its heading (yaw: 0 faces +z, turning towards +x) and its pitch (nose up). */
export interface FishPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  leaping: boolean;
}

/** One drop of spray: thrown up as its fish leaves the water (`at` 0) or falls back in (`at` 1). */
export interface SprayDrop {
  /** Its fish (an index into `schoolFish`). */
  fish: number;
  at: 0 | 1;
  /** Which way across the water it flies, radians (0 is +z, turning towards +x). */
  heading: number;
  /** Units a second across the water, and up as it leaves the surface. */
  out: number;
  up: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const fract = (v: number) => v - Math.floor(v);

/** Every fish of the World's schools, school by school (so the first schools' fish come first). */
export function schoolFish(world: Pick<World, 'seed' | 'fish'>): SwimmingFish[] {
  const rng = createRng(`${world.seed}/schools`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  return world.fish.flatMap((school, index) => {
    const loop = between(0.35, 0.42);
    const way = rng() < 0.5 ? -1 : 1;
    const turn = (way * between(0.18, 0.28)) / loop;
    const lead = rng() * 2 * Math.PI;
    // The school leaps once every 7–14 s: each fish in turn.
    const every = between(7, 14) * school.size;
    const phase = rng();
    return Array.from({ length: school.size }, (_, i) => ({
      school: index,
      centre: { ...school.centre },
      // Lanes: middle, outside, inside, and round again.
      ring: loop + [0, 1, -1][i % 3]! * LANE + between(-0.02, 0.02),
      turn,
      // Each one behind the one before, the way it swims.
      angle: lead - (way * i * SCHOOL_GAP) / loop,
      leapEvery: every,
      leapPhase: fract(phase + i / school.size),
      wiggle: rng() * 2 * Math.PI,
    }));
  });
}

/** Where a fish is round its loop at `seconds`, without its leap: the point and which way it swims (a unit vector). */
function onLoop(f: SwimmingFish, seconds: number) {
  const a = f.angle + f.turn * seconds;
  const way = Math.sign(f.turn);
  return {
    x: f.centre.x + f.ring * Math.cos(a),
    z: f.centre.z + f.ring * Math.sin(a),
    tx: -way * Math.sin(a),
    tz: way * Math.cos(a),
  };
}

/** Seconds into the fish's current leap period: it is in the air for the first `LEAP_TIME` of them. */
const leapClock = (f: SwimmingFish, seconds: number) => fract(seconds / f.leapEvery + f.leapPhase) * f.leapEvery;

/** How far ahead of its place on the loop a fish is, `s` seconds into its leap period. */
const ahead = (s: number) => LEAP_FORWARD * clamp01(s / LEAP_TIME) * (1 - smooth(clamp01((s - LEAP_TIME) / LEAP_BACK)));

/** Where a fish is at `seconds` on the shared clock. */
export function fishAt(f: SwimmingFish, seconds: number): FishPose {
  const loop = onLoop(f, seconds);
  const s = leapClock(f, seconds);
  const u = clamp01(s / LEAP_TIME);
  const forward = ahead(s);
  // Nose up as it leaves the water, nose down as it falls back, level under it.
  const envelope = smooth(clamp01(u / 0.15)) * (1 - smooth(clamp01((u - 0.85) / 0.15)));
  const pitch = Math.atan2(4 * LEAP_HEIGHT * (1 - 2 * u), LEAP_FORWARD) * envelope;
  return {
    x: loop.x + loop.tx * forward,
    z: loop.z + loop.tz * forward,
    y: FISH_Y + LEAP_HEIGHT * 4 * u * (1 - u),
    yaw: Math.atan2(loop.tx, loop.tz) + WIGGLE * Math.sin(seconds * WIGGLE_RATE * 2 * Math.PI + f.wiggle),
    pitch,
    leaping: s < LEAP_TIME,
  };
}

/** The spray of every fish's leaps (seeded from the World's own `<seed>/spray`): `DROPS` as it leaves the water and as many as it falls back, each its own way. */
export function sprayDrops(fish: readonly SwimmingFish[], seed: string): SprayDrop[] {
  const rng = createRng(`${seed}/spray`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  return fish.flatMap((_, i) =>
    ([0, 1] as const).flatMap((at) =>
      Array.from({ length: DROPS }, (_, k) => ({
        fish: i,
        at,
        heading: ((k + rng()) / DROPS) * 2 * Math.PI,
        out: between(0.2, 0.4),
        up: between(0.8, 1.3),
      })),
    ),
  );
}

/** Where a drop of spray is at `seconds` (its middle), or null while it is not flying. */
export function sprayAt(drop: SprayDrop, f: SwimmingFish, seconds: number): { x: number; y: number; z: number } | null {
  const s = leapClock(f, seconds);
  const tau = s - drop.at * LEAP_TIME;
  const life = (2 * drop.up) / SPRAY_GRAVITY;
  if (tau < 0 || tau >= life) return null;
  // Where the fish broke the surface: its place on the loop then, and as far ahead as it was.
  const loop = onLoop(f, seconds - tau);
  const forward = drop.at * LEAP_FORWARD;
  return {
    x: loop.x + loop.tx * forward + Math.sin(drop.heading) * drop.out * tau,
    y: SEA_LEVEL + drop.up * tau - (SPRAY_GRAVITY * tau * tau) / 2,
    z: loop.z + loop.tz * forward + Math.cos(drop.heading) * drop.out * tau,
  };
}

/** How many fish a life tier shows: the fish of its share of the schools, rounded up (the first ones). */
export function fishShown(schools: readonly FishSchool[], tier: LifeTierName): number {
  const shown = Math.ceil(schools.length * LIFE_TIERS[tier].share);
  return schools.slice(0, shown).reduce((n, s) => n + s.size, 0);
}

/** How many drops of spray a life tier shows: those of the fish it shows. */
export const sprayShown = (schools: readonly FishSchool[], tier: LifeTierName): number => fishShown(schools, tier) * DROPS * 2;
