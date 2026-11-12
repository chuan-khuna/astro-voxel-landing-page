/**
 * Land animals (ADR 0005): each Biome's animal, a few on every Isle, worked
 * out once the layout and Decoration are done, from a sequence of the Seed's
 * own (`<seed>/animals`), so it never moves the layout and the same layout
 * always gets the same animals. The renderer walks each one along its route
 * and back, grazing, looking round and resting (`render/creatures.ts`).
 *
 * Each animal gets a rest point and a short route from it: 2–5 steps to
 * neighbouring cells. Rules, every one held by `generateWorld`'s tests:
 * - every cell of a route is level land of one Isle, never on or beside
 *   (8-neighbour) a footprint or the Dock's jetty, so never in the Garden;
 *   never on a path, a bridge or a bridge's end;
 * - nothing stands on a route cell or beside it but grass or a flower
 *   clump, and every cell beside it is land no higher than it (no wall, no
 *   drop to the sea); for an animal that reaches past its cell
 *   (`ANIMAL_REACH`, a deer) its four neighbours are level with it, so its
 *   overhang never pokes through a step as it walks or lies down;
 * - no Landmark's sight line to the camera passes below the animal's top
 *   over any of those cells (`sightClearance`, the Decoration check);
 * - routes keep a cell apart, and an Isle has at most `MAX_ANIMALS_PER_ISLE`.
 */
import { createRng } from './prng';
import { sightClearance } from './sightline';
import type { AnimalSpecies, BiomeId, Bridge, Cell, CreatureKind, Decoration, Isle, LandAnimal, Path, PlacedLandmark, Terrain } from './types';

/** Each Biome's land animal. */
export const ANIMAL_SPECIES: Record<BiomeId, AnimalSpecies> = {
  tropical: 'junglefowl',
  northern: 'deer',
  autumn: 'squirrel',
  volcanic: 'goat',
};

/**
 * Which creatures are out in each Biome, by Day and at Night (the spec's
 * Biome × Day/Night table, with a land animal in every Biome and gulls in
 * the north added): the land animals go to rest out of sight at Night, the
 * birds by Day and the bats at Night share the same flights (`birds.ts`).
 */
export const CREATURE_SETS: Record<BiomeId, { day: readonly CreatureKind[]; night: readonly CreatureKind[] }> = {
  tropical: { day: ['animal', 'bird'], night: [] },
  northern: { day: ['animal', 'bird'], night: [] },
  autumn: { day: ['animal'], night: ['bat'] },
  volcanic: { day: ['animal'], night: ['bat'] },
};

/**
 * How high each animal reaches, in units above its ground: its model head
 * up (⅛-unit voxels: a junglefowl 6, a deer 10, a squirrel 5, a goat 9)
 * plus the bob or hop of its walk (`render/creatures.ts`). Placement keeps
 * every Landmark in view past it; the tests hold the models and gaits to it.
 */
export const ANIMAL_HEIGHT: Record<AnimalSpecies, number> = {
  junglefowl: 0.8,
  deer: 1.3,
  squirrel: 0.75,
  goat: 1.2,
};

/**
 * How far each animal reaches from its middle, nose or tail, in units (any
 * way it turns). A deer reaches past its cell (over ½), so it walks only
 * where the cells beside its route are level with it: its overhang never
 * pokes through a step's wall when it lies down. The others fit their cell.
 */
export const ANIMAL_REACH: Record<AnimalSpecies, number> = {
  junglefowl: 0.5,
  deer: 0.625,
  squirrel: 0.5,
  goat: 0.5,
};

/** Animals on one Isle at most (the life tier shows its share of them). */
export const MAX_ANIMALS_PER_ISLE = 3;
/** Steps a route takes from its rest point: fewest and most. */
const ROUTE_STEPS = { min: 2, max: 5 } as const;
/** Decoration an animal may walk through, or reach over beside its route. */
const UNDERFOOT: readonly string[] = ['grass', 'clump'];

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Place each Isle's animals: 2 or 3 where there is room, round-robin by Isle. */
export function placeAnimals(
  seed: string,
  biome: BiomeId,
  terrain: Terrain,
  isles: Isle[],
  bridges: Bridge[],
  paths: Path[],
  landmarks: PlacedLandmark[],
  decoration: Decoration[],
): LandAnimal[] {
  const { width, depth, heights, isle } = terrain;
  const index = (x: number, z: number) => z * width + x;
  const inGrid = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth;
  const species = ANIMAL_SPECIES[biome];
  const tall = ANIMAL_HEIGHT[species];
  const overhangs = ANIMAL_REACH[species] > 0.5;

  // Cells no route may take: on or beside a footprint or the jetty, paths, bridges and their ends.
  const blocked = new Uint8Array(width * depth);
  const block = (x: number, z: number) => {
    if (inGrid(x, z)) blocked[index(x, z)] = 1;
  };
  const covered = landmarks.map((l) => ({ y: l.y, cells: [...l.footprint.cells, ...l.jetty] }));
  for (const { cells } of covered) for (const c of cells) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) block(c.x + dx, c.z + dz);
  for (const p of paths) for (const c of p.cells) block(c.x, c.z);
  for (const b of bridges) for (const c of b.cells) for (const [dx, dz] of [[0, 0], ...STEPS] as const) block(c.x + dx, c.z + dz);
  const standing = new Map<number, Decoration>(decoration.map((d) => [index(d.cell.x, d.cell.z), d]));
  const clearance = sightClearance(terrain, covered, Math.max(...heights) + tall);

  /** Whether an animal at height `y` may stand on (`x`, `z`). */
  const fits = (x: number, z: number, y: number) => {
    if (!inGrid(x, z)) return false;
    const i = index(x, z);
    if (isle[i] === -1 || blocked[i] || heights[i] !== y) return false;
    const on = standing.get(i);
    if (on && !UNDERFOOT.includes(on.kind)) return false;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!inGrid(x + dx, z + dz)) return false;
        const n = index(x + dx, z + dz);
        // No higher anywhere beside it; level along its way where its body overhangs the next cell.
        if (isle[n] === -1 || heights[n]! > y || (overhangs && dx * dz === 0 && heights[n] !== y)) return false;
        const beside = standing.get(n);
        if (beside && !UNDERFOOT.includes(beside.kind)) return false;
        if (clearance[n]! < y + tall) return false;
      }
    }
    return true;
  };

  const rng = createRng(`${seed}/animals`);
  const shuffle = <T>(list: T[]): T[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };
  /** Cells taken by a route, and every cell beside them: no other route comes this close. */
  const near = new Set<string>();
  const key = (c: Cell) => `${c.x},${c.z}`;
  const free = (c: Cell, y: number) => fits(c.x, c.z, y) && !near.has(key(c));

  const perIsle: LandAnimal[][] = [];
  for (const each of isles) {
    const want = 2 + (rng() < 0.5 ? 1 : 0);
    const land: Cell[] = [];
    for (let z = each.bounds.minZ; z <= each.bounds.maxZ; z++) for (let x = each.bounds.minX; x <= each.bounds.maxX; x++) if (isle[index(x, z)] === each.id) land.push({ x, z });
    const placed: LandAnimal[] = [];
    for (const rest of shuffle(land)) {
      if (placed.length >= want) break;
      const y = heights[index(rest.x, rest.z)]!;
      if (!free(rest, y)) continue;
      // A short walk: keep on mostly straight, turn where it must.
      const steps = ROUTE_STEPS.min + Math.floor(rng() * (ROUTE_STEPS.max - ROUTE_STEPS.min + 1));
      const route: Cell[] = [rest];
      const on = new Set([key(rest)]);
      let heading = Math.floor(rng() * 4);
      while (route.length <= steps) {
        const last = route.at(-1)!;
        const turns = rng() < 0.65 ? [heading, ...shuffle([0, 1, 2, 3].filter((h) => h !== heading))] : shuffle([0, 1, 2, 3]);
        const next = turns
          .map((h) => ({ h, cell: { x: last.x + STEPS[h]![0], z: last.z + STEPS[h]![1] } }))
          .find(({ cell }) => !on.has(key(cell)) && free(cell, y));
        if (!next) break;
        heading = next.h;
        route.push(next.cell);
        on.add(key(next.cell));
      }
      if (route.length < ROUTE_STEPS.min + 1) continue;
      placed.push({ species, isle: each.id, rest: { ...rest }, route, y });
      for (const c of route) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) near.add(key({ x: c.x + dx, z: c.z + dz }));
    }
    perIsle.push(placed);
  }
  // Round-robin by Isle, so a tier that shows only the first few still has one on each Isle.
  const animals: LandAnimal[] = [];
  for (let round = 0; round < MAX_ANIMALS_PER_ISLE; round++) for (const placed of perIsle) if (placed[round]) animals.push(placed[round]!);
  return animals;
}
