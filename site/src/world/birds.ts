/**
 * Birds (ADR 0005): birds by Day, or bats at Night, whichever the Biome has
 * (`CREATURE_SETS`), circling over the Isles. Worked out once the layout is
 * done, from a sequence of the Seed's own (`<seed>/birds`), so they never
 * move the layout. The renderer flies each one round its circle, beating its
 * wings (`render/creatures.ts`).
 *
 * Rules, every one held by `generateWorld`'s tests:
 * - each circle is centred over an Isle's land, `BIRD_RADIUS` round;
 * - a bird's lowest wingtip (`BIRD_BELOW` under its middle) is above the
 *   tallest Landmark's top, and its highest (`BIRD_ABOVE` over it) below
 *   where the clouds float (`CLOUD_LIFT` over that top);
 * - all the way round its circle, its body (`BIRD_REACH` either way across
 *   the ground) is never between the camera and any part of a Landmark;
 * - an Isle has at most 2, a World at most `MAX_BIRDS`; birds at one height
 *   keep their circles apart.
 */
import { CLOUD_LIFT } from './clouds';
import { CREATURE_SETS } from './animals';
import { LANDMARK_HEIGHT } from './landmarks';
import { createRng } from './prng';
import type { BiomeId, BirdFlight, Cell, Isle, PlacedLandmark, Terrain } from './types';

/** Birds in a World at most (the life tier shows its share of them). */
export const MAX_BIRDS = 5;
/** Birds over one Isle at most. */
const PER_ISLE = 2;
/** How far a bird's body reaches from its middle across the ground, any way it turns (half a gull's wingspan, and a little). */
export const BIRD_REACH = 0.7;
/** How far a bird reaches below and above its middle as it beats its wings. */
export const BIRD_BELOW = 0.5;
export const BIRD_ABOVE = 0.6;
/** Units round a bird's circle: least and most. */
const BIRD_RADIUS = [1.5, 3] as const;
/** Units a second a bird flies round, and a bat (quicker, in a tighter flutter). */
const SPEED = { bird: [0.6, 0.95], bat: [0.9, 1.3] } as const;
/** Birds at heights closer than this keep their circles apart. */
const LAYER = 0.3;
/** Points checked round each circle. */
const SAMPLES = 96;
/** Placements tried per World. */
const TRIES = 200;

/** Place the World's birds (or bats) over its Isles. */
export function placeBirds(seed: string, biome: BiomeId, terrain: Terrain, isles: Isle[], landmarks: PlacedLandmark[]): BirdFlight[] {
  const sets = CREATURE_SETS[biome];
  const kind = [...sets.day, ...sets.night].find((k): k is 'bird' | 'bat' => k === 'bird' || k === 'bat');
  if (!kind) return [];
  const { width, isle } = terrain;
  const rng = createRng(`${seed}/birds`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const tallest = Math.max(...landmarks.map((l) => l.y + LANDMARK_HEIGHT[l.id]));
  // Heights a bird's middle may fly at, with a little to spare either side.
  const low = tallest + BIRD_BELOW + 0.1;
  const high = tallest + CLOUD_LIFT - BIRD_ABOVE - 0.1;

  // Each Landmark's ground (footprint and jetty) as rectangles, its ground and top.
  const boxes = landmarks.flatMap((l) =>
    [l.footprint.cells, l.jetty]
      .filter((cells) => cells.length > 0)
      .map((cells) => ({
        x0: Math.min(...cells.map((c) => c.x)),
        x1: Math.max(...cells.map((c) => c.x)) + 1,
        z0: Math.min(...cells.map((c) => c.z)),
        z1: Math.max(...cells.map((c) => c.z)) + 1,
        y: l.y,
        top: l.y + LANDMARK_HEIGHT[l.id],
      })),
  );
  /**
   * Whether a bird at (`bx`, `height`, `bz`) hides any part of a Landmark: a
   * sight line climbs (1, 1, 1) from each point of it, so it meets the bird's
   * body d units across from where it started, d from (bottom − the
   * Landmark's top) to (top − its ground); the bird hides it if, for some
   * such d, the point d back from the bird is over the Landmark (± the reach).
   */
  const hides = (bx: number, bz: number, height: number) =>
    boxes.some((b) => {
      // A tenth of a unit more: the circle is checked at points, a fifth of a unit apart at most.
      const r = BIRD_REACH + 0.1;
      const lo = Math.max(height - BIRD_BELOW - b.top, bx - b.x1 - r, bz - b.z1 - r);
      const hi = Math.min(height + BIRD_ABOVE - b.y, bx - b.x0 + r, bz - b.z0 + r);
      return lo <= hi;
    });

  const landOf = new Map<number, Cell[]>();
  for (const each of isles) {
    const cells: Cell[] = [];
    for (let z = each.bounds.minZ; z <= each.bounds.maxZ; z++) for (let x = each.bounds.minX; x <= each.bounds.maxX; x++) if (isle[z * width + x] === each.id) cells.push({ x, z });
    landOf.set(each.id, cells);
  }

  const birds: BirdFlight[] = [];
  const count = new Map<number, number>();
  for (let attempt = 0; attempt < TRIES && birds.length < MAX_BIRDS; attempt++) {
    const over = isles[attempt % isles.length]!;
    if ((count.get(over.id) ?? 0) >= PER_ISLE) continue;
    const land = landOf.get(over.id)!;
    const cell = land[Math.floor(rng() * land.length)]!;
    const centre = { x: cell.x + 0.5, z: cell.z + 0.5 };
    const radius = between(BIRD_RADIUS[0], BIRD_RADIUS[1]);
    const height = between(low, high);
    const speed = between(SPEED[kind][0], SPEED[kind][1]);
    const turn = ((rng() < 0.5 ? -1 : 1) * speed) / radius;
    const phase = rng() * 2 * Math.PI;
    const apart = birds.every((b) => Math.abs(b.height - height) >= LAYER || Math.hypot(b.centre.x - centre.x, b.centre.z - centre.z) >= b.radius + radius + 2 * BIRD_REACH);
    if (!apart) continue;
    let clear = true;
    for (let s = 0; s < SAMPLES && clear; s++) {
      const a = (s / SAMPLES) * 2 * Math.PI;
      if (hides(centre.x + radius * Math.cos(a), centre.z + radius * Math.sin(a), height)) clear = false;
    }
    if (!clear) continue;
    birds.push({ kind, centre, radius, height, turn, phase });
    count.set(over.id, (count.get(over.id) ?? 0) + 1);
  }
  return birds;
}
