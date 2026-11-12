/**
 * Fish schools (ADR 0005): where the Biome's fish swim, worked out once the
 * layout, the vessels and the buoys are done, from a sequence of the Seed's
 * own (`<seed>/fish`), so it never moves the layout and the same layout
 * always gets the same schools. The renderer swims each school's 3–5 fish
 * round a loop inside its square and now and then one leaps
 * (`render/schools.ts`).
 *
 * A school keeps to a square of water `FISH_AREA` either side of its centre,
 * a corner of the grid, so it covers 2×2 cells. Rules, every one held by
 * `generateWorld`'s tests:
 * - every cell under it is sea in the shallows: within `SHALLOWS` cells of
 *   the land (centre to centre), where the water is translucent and the
 *   seabed shows, so the fish are seen through it;
 * - none is on or next to the Dock's jetty or a moored boat (their hulls and
 *   posts stand in the water), on a bridge, a buoy or a ship's loop;
 * - schools keep `SCHOOL_GAP` apart, and a World has `MAX_SCHOOLS` at most.
 */
import { coastDistance } from './coast';
import { createRng } from './prng';
import type { Bridge, Cell, FishSchool, PlacedLandmark, ShipRoute, Terrain } from './types';

/** Schools in a World at most (the life tier shows its share of them). */
export const MAX_SCHOOLS = 6;
/** Half the side of a school's square of water, in units: 2×2 cells round a grid corner. */
export const FISH_AREA = 1;
/** Water this far from the land (cells, centre to centre) or nearer is the shallows. */
const SHALLOWS = 2;
/** Schools keep at least this far apart, centre to centre, in units. */
const SCHOOL_GAP = 3;
/** Fish in a school: fewest and most. */
const SCHOOL_SIZE = { min: 3, max: 5 } as const;

/** Place the World's fish schools in its shallows. */
export function placeFish(
  seed: string,
  terrain: Terrain,
  bridges: Bridge[],
  landmarks: PlacedLandmark[],
  boats: Cell[],
  buoys: Cell[],
  ships: ShipRoute[],
): FishSchool[] {
  const { width, depth } = terrain;
  const { distance } = coastDistance(terrain);
  const key = (c: Cell) => `${c.x},${c.z}`;
  const banned = new Set<string>();
  // The jetty's posts and the boats' hulls stand in the water: keep a cell clear of them.
  for (const c of [...landmarks.flatMap((l) => l.jetty), ...boats]) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) banned.add(key({ x: c.x + dx, z: c.z + dz }));
  for (const c of [...bridges.flatMap((b) => b.cells), ...buoys, ...ships.flatMap((s) => s.cells)]) banned.add(key(c));

  /** Whether the 2×2 cells round the grid corner (`x`, `z`) are all open shallows. */
  const fits = (x: number, z: number) => {
    for (let cz = z - FISH_AREA; cz < z + FISH_AREA; cz++) {
      for (let cx = x - FISH_AREA; cx < x + FISH_AREA; cx++) {
        if (cx < 0 || cz < 0 || cx >= width || cz >= depth) return false;
        const d = distance[cz * width + cx]!;
        if (d === 0 || d > SHALLOWS || banned.has(key({ x: cx, z: cz }))) return false;
      }
    }
    return true;
  };

  const rng = createRng(`${seed}/fish`);
  const corners: Cell[] = [];
  for (let z = FISH_AREA; z <= depth - FISH_AREA; z++) for (let x = FISH_AREA; x <= width - FISH_AREA; x++) if (fits(x, z)) corners.push({ x, z });
  // Shuffle (Fisher–Yates), so the schools spread round the coasts.
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [corners[i], corners[j]] = [corners[j]!, corners[i]!];
  }
  const schools: FishSchool[] = [];
  for (const c of corners) {
    if (schools.length >= MAX_SCHOOLS) break;
    if (schools.some((s) => Math.hypot(s.centre.x - c.x, s.centre.z - c.z) < SCHOOL_GAP)) continue;
    schools.push({ centre: { x: c.x, z: c.z }, radius: FISH_AREA, size: SCHOOL_SIZE.min + Math.floor(rng() * (SCHOOL_SIZE.max - SCHOOL_SIZE.min + 1)) });
  }
  return schools;
}
