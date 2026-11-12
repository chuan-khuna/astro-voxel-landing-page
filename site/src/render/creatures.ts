/**
 * Land animals, birds and bats on the move (ADR 0005): where each one is
 * and how it holds its head or wings at a time on the shared Ambient Life
 * clock. `generateWorld` places them (`World.animals`, `World.birds`); this
 * works out their timing once a World and their poses each frame, and
 * `creatureMeshes.ts` puts their parts there. Pure: no three.js.
 *
 * - A land animal rests at its rest point (lying down, looking about), stands
 *   and looks round, walks its route to the end (turning in place at each
 *   corner), grazes there, turns and walks back, and turns to face the way
 *   it set out, so a round ends where the next begins. Each one starts at
 *   its own point of its round (seeded from `<seed>/creatures`).
 * - A bird circles at its height, banking into the turn, gliding between
 *   bursts of wing beats; a bat beats its wings all the time and flutters in
 *   and out a little from its circle (within what the World checks).
 */
import type { AnimalSpecies, BirdFlight, World } from '@/world';
import { createRng } from '@/world/prng';
import { LIFE_TIERS, type LifeTierName } from '@/lib/lifeTier';

/**
 * How each species moves: units a second it walks, how high it bobs (or a
 * squirrel hops) as it goes and how many bobs a unit (whole, so a step ends
 * on the ground), how far it sinks lying down to rest, and how far (radians)
 * it dips its head to graze and turns it to look round.
 */
export const ANIMAL_GAITS: Record<AnimalSpecies, { speed: number; bob: number; bobs: number; lieDown: number; graze: number; look: number }> = {
  junglefowl: { speed: 0.45, bob: 0.03, bobs: 4, lieDown: 0.125, graze: 0.9, look: 0.8 },
  deer: { speed: 0.55, bob: 0.03, bobs: 2, lieDown: 0.375, graze: 1.1, look: 0.7 },
  squirrel: { speed: 0.9, bob: 0.12, bobs: 3, lieDown: 0, graze: 0.6, look: 0.9 },
  goat: { speed: 0.45, bob: 0.03, bobs: 2, lieDown: 0.375, graze: 1.1, look: 0.7 },
};

/**
 * How birds and bats fly: half their wingspan (units), the most their wings
 * beat up or down from level (radians) and how many beats a second, how far
 * they bank into the turn, bob up and down and flutter in and out from
 * their circle (units). The World keeps room for all of it (`BIRD_BELOW`,
 * `BIRD_ABOVE`, `BIRD_REACH`).
 */
export const FLIGHTS = {
  bird: { halfSpan: 0.625, flap: 0.45, beat: 2.5, bank: 0.12, bob: 0.03, flutter: 0 },
  bat: { halfSpan: 0.375, flap: 0.7, beat: 7, bank: 0.12, bob: 0.05, flutter: 0.15 },
} as const;

/** Radians a second an animal turns in place. */
const TURN_RATE = 4;
/** Seconds of a bird's wing-beat cycle: it beats in a burst for part of it, and glides the rest. */
const BURST_EVERY = 6;
/** How far a gliding bird holds its wings up. */
const GLIDE = 0.08;

export type AnimalAction = 'rest' | 'look' | 'walk' | 'graze';

/** Where an animal is and how it holds itself. `yaw` 0 faces +z, turning towards +x; a positive `headPitch` dips the head. */
export interface AnimalPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  headYaw: number;
  headPitch: number;
  action: AnimalAction;
}

interface Stage {
  action: AnimalAction;
  start: number;
  length: number;
  /** Where it goes from and to (the same while it stands), and the way it faces from and to. */
  from: { x: number; z: number };
  to: { x: number; z: number };
  yawFrom: number;
  yawTo: number;
}

/** One animal's round, worked out once a World. */
export interface WalkingAnimal {
  species: AnimalSpecies;
  ground: number;
  /** Seconds a round takes. */
  period: number;
  /** Seconds into its round it is at time 0. */
  offset: number;
  stages: Stage[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 at both ends of a stage, 1 through its middle: eased over its first and last `edge`. */
const envelope = (u: number, edge = 0.2) => smooth(clamp01(u / edge)) * smooth(clamp01((1 - u) / edge));
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Every animal of the World with its round (in `World.animals` order). */
export function walkingAnimals(world: Pick<World, 'seed' | 'animals'>): WalkingAnimal[] {
  const rng = createRng(`${world.seed}/creatures`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  return world.animals.map((animal) => {
    const gait = ANIMAL_GAITS[animal.species];
    const points = animal.route.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
    const stages: Stage[] = [];
    let clock = 0;
    const heading = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z);
    const start = heading(points[0]!, points[1]!);
    let yaw = start;
    const add = (action: AnimalAction, length: number, from: { x: number; z: number }, to = from, yawTo = yaw) => {
      stages.push({ action, start: clock, length, from, to, yawFrom: yaw, yawTo });
      clock += length;
      yaw = yawTo;
    };
    const turnTo = (at: { x: number; z: number }, target: number) => {
      const by = wrapAngle(target - yaw);
      if (Math.abs(by) > 1e-9) add('walk', Math.abs(by) / TURN_RATE, at, at, yaw + by);
    };
    const walk = (path: Array<{ x: number; z: number }>) => {
      for (let k = 1; k < path.length; k++) {
        turnTo(path[k - 1]!, heading(path[k - 1]!, path[k]!));
        add('walk', 1 / gait.speed, path[k - 1]!, path[k]!);
      }
    };
    add('rest', between(5, 9), points[0]!);
    add('look', between(2, 3.5), points[0]!);
    walk(points);
    add('graze', between(4, 7), points.at(-1)!);
    walk(points.toReversed());
    turnTo(points[0]!, start);
    return { species: animal.species, ground: animal.y, period: clock, offset: rng() * clock, stages };
  });
}

/** Where an animal is at `seconds` on the shared clock, and its pose. */
export function animalAt(animal: WalkingAnimal, seconds: number): AnimalPose {
  const gait = ANIMAL_GAITS[animal.species];
  const t = (((seconds + animal.offset) % animal.period) + animal.period) % animal.period;
  const stage = animal.stages.find((s) => t < s.start + s.length) ?? animal.stages.at(-1)!;
  const u = clamp01((t - stage.start) / stage.length);
  const x = stage.from.x + (stage.to.x - stage.from.x) * u;
  const z = stage.from.z + (stage.to.z - stage.from.z) * u;
  const yaw = stage.yawFrom + (stage.yawTo - stage.yawFrom) * smooth(u);
  const moved = Math.hypot(stage.to.x - stage.from.x, stage.to.z - stage.from.z) * u;
  const pose: AnimalPose = { x, y: animal.ground, z, yaw, headYaw: 0, headPitch: 0, action: stage.action };
  switch (stage.action) {
    case 'walk':
      pose.y += gait.bob * Math.abs(Math.sin(Math.PI * gait.bobs * moved));
      break;
    case 'rest': {
      // Lies down, glances about now and then, and gets up again.
      pose.y -= gait.lieDown * envelope(u, 0.15);
      pose.headYaw = 0.35 * gait.look * Math.sin(2 * Math.PI * u * 2) * envelope(u, 0.15);
      break;
    }
    case 'look':
      pose.headYaw = gait.look * Math.sin(2 * Math.PI * u) * envelope(u, 0.15);
      break;
    case 'graze': {
      // Head down, nibbling, and up again.
      const down = envelope(u, 0.15);
      pose.headPitch = down * (gait.graze - 0.12 + 0.12 * Math.sin(2 * Math.PI * (t - stage.start) * 1.5));
      pose.headYaw = 0.15 * Math.sin(2 * Math.PI * u) * down;
      break;
    }
  }
  return pose;
}

/** Where a bird (or bat) is: its middle, the way it flies (`yaw`, as an animal's), how far it banks (radians, rolling about its length) and its wings' beat (radians up from level). */
export interface BirdPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  bank: number;
  flap: number;
}

/** Where a bird or bat is at `seconds` on the shared clock. */
export function birdAt(flight: BirdFlight, seconds: number): BirdPose {
  const style = FLIGHTS[flight.kind];
  const a = flight.phase + flight.turn * seconds;
  const wobble = 1.7;
  const r = flight.radius + style.flutter * Math.sin(wobble * seconds + flight.phase);
  const dr = style.flutter * wobble * Math.cos(wobble * seconds + flight.phase);
  // Its velocity: along the circle, and in or out as it flutters.
  const vx = dr * Math.cos(a) - r * Math.sin(a) * flight.turn;
  const vz = dr * Math.sin(a) + r * Math.cos(a) * flight.turn;
  const beat = Math.sin(2 * Math.PI * style.beat * seconds + flight.phase);
  let flap: number;
  if (flight.kind === 'bat') flap = style.flap * beat;
  else {
    // A burst of beats for part of each cycle, a glide the rest.
    const burst = smooth(clamp01((Math.sin((2 * Math.PI * seconds) / BURST_EVERY + flight.phase * 3) - 0.1) / 0.3));
    flap = GLIDE * (1 - burst) + style.flap * beat * burst;
  }
  return {
    x: flight.centre.x + r * Math.cos(a),
    y: flight.height + style.bob * Math.sin(1.1 * seconds + flight.phase),
    z: flight.centre.z + r * Math.sin(a),
    yaw: Math.atan2(vx, vz),
    bank: -Math.sign(flight.turn) * style.bank,
    flap,
  };
}

/** How many of a kind of creature a life tier shows: its share, rounded up (the first ones). */
export const creaturesShown = (total: number, tier: LifeTierName): number => Math.ceil(total * LIFE_TIERS[tier].share);
