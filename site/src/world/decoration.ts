/**
 * Decoration: scenery placed over the Isles once the layout is done.
 * Each Biome dresses its land with its own set (`DECORATION_KINDS`, drawn
 * per Biome in `structures/<kind>/`), deterministically from the Seed.
 *
 * Rules, every one held by `generateWorld`'s tests:
 * - one piece a land cell, never on or beside (8-neighbour) a footprint or
 *   the Dock's jetty, so the Garden stays clear; never on a path or a bridge end;
 * - never taller than the nearest Landmark (`LANDMARK_MIN_HEIGHT`);
 * - never between the camera and a Landmark: the same sight line as
 *   Landmark placement (`sightline.ts`);
 * - minor buildings face the camera (south or east) and keep apart.
 */
import { LANDMARK_MIN_HEIGHT } from './landmarks';
import { createRng } from './prng';
import { sightClearance } from './sightline';
import type { BiomeId, Bridge, Cell, Decoration, DecorationKind, Facing, Path, PlacedLandmark, Terrain } from './types';

/**
 * How tall each kind may stand, in units above its ground (⅛-unit voxels:
 * grass 4, a flower clump 4, rocks 4, a bush 6, a fence 8, a small tree, a
 * lamp and a shed 16, a windmill 20). Placement keeps every Landmark in view
 * past these columns, so no structure may be taller (the structure files'
 * tests hold them to it).
 */
export const DECORATION_HEIGHT: Record<DecorationKind, number> = {
  grass: 0.5,
  clump: 0.5,
  rocks: 0.5,
  bush: 0.75,
  fence: 1,
  sapling: 2,
  lamp: 2,
  shed: 2,
  windmill: 2.5,
};

/** The minor buildings: few in a World, turned to the camera, kept apart. */
export const MINOR_BUILDINGS: readonly DecorationKind[] = ['fence', 'lamp', 'shed', 'windmill'];
/** Most of each minor building in one World. */
const MOST: Partial<Record<DecorationKind, number>> = { fence: 5, lamp: 4, shed: 2, windmill: 1 };
/** Minor buildings keep at least this many cells (Chebyshev) apart. */
const BUILDING_GAP = 3;

/**
 * Each Biome's share of free land cells that get a piece, and how likely
 * each kind is: lush tropics and autumn, sparser snow, bare volcanic rock.
 */
const BIOME_DECORATION: Record<BiomeId, { density: number; weights: Record<DecorationKind, number> }> = {
  tropical: { density: 0.22, weights: { grass: 4, clump: 4, rocks: 1, bush: 3, sapling: 3, fence: 0.6, lamp: 0.5, shed: 0.4, windmill: 0.3 } },
  northern: { density: 0.17, weights: { grass: 3, clump: 1.5, rocks: 3, bush: 2, sapling: 3, fence: 0.6, lamp: 0.5, shed: 0.4, windmill: 0.3 } },
  autumn: { density: 0.22, weights: { grass: 4, clump: 2.5, rocks: 1.5, bush: 3, sapling: 3, fence: 0.6, lamp: 0.5, shed: 0.4, windmill: 0.3 } },
  volcanic: { density: 0.14, weights: { grass: 2, clump: 1, rocks: 4, bush: 1.5, sapling: 2, fence: 0.6, lamp: 0.5, shed: 0.4, windmill: 0.3 } },
};

const FACINGS: readonly Facing[] = ['north', 'east', 'south', 'west'];

/**
 * Scatter a Biome's Decoration over a finished layout. Draws from a
 * sequence of the Seed's own (`<seed>/decoration`), so it never moves the
 * layout, and the same layout always gets the same Decoration.
 */
export function placeDecoration(
  seed: string,
  biome: BiomeId,
  terrain: Terrain,
  bridges: Bridge[],
  paths: Path[],
  landmarks: PlacedLandmark[],
): Decoration[] {
  const { width, depth, heights, isle } = terrain;
  const index = (x: number, z: number) => z * width + x;
  const inGrid = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth;
  const covered = landmarks.map((l) => ({ landmark: l, cells: [...l.footprint.cells, ...l.jetty] }));

  // Cells no piece may take: beside any footprint or jetty, paths, and the land at bridges' ends.
  const blocked = new Uint8Array(width * depth);
  const block = (x: number, z: number) => {
    if (inGrid(x, z)) blocked[index(x, z)] = 1;
  };
  for (const { cells } of covered) for (const c of cells) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) block(c.x + dx, c.z + dz);
  for (const p of paths) for (const c of p.cells) block(c.x, c.z);
  for (const b of bridges) for (const c of b.cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) block(c.x + dx, c.z + dz);

  // How tall a column may stand over each cell and leave every Landmark in view: the lowest any
  // Landmark's sight line runs through it (the same check as Landmark placement).
  const tallest = Math.max(...Object.values(DECORATION_HEIGHT));
  const clearance = sightClearance(terrain, covered.map(({ landmark, cells }) => ({ y: landmark.y, cells })), Math.max(...heights) + tallest);

  /** How tall a piece may stand by the nearest Landmark (the lowest, if several are as near). */
  const capAt = (cell: Cell) => {
    let nearest = Infinity;
    let cap = Infinity;
    for (const { landmark, cells } of covered) {
      const distance = Math.min(...cells.map((c) => Math.hypot(c.x - cell.x, c.z - cell.z)));
      const height = LANDMARK_MIN_HEIGHT[landmark.id];
      if (distance < nearest) {
        nearest = distance;
        cap = height;
      } else if (distance === nearest) cap = Math.min(cap, height);
    }
    return cap;
  };

  const { density, weights } = BIOME_DECORATION[biome];
  const rng = createRng(`${seed}/decoration`);
  const placed: Decoration[] = [];
  const buildings: Cell[] = [];
  const used = new Map<DecorationKind, number>();
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const i = index(x, z);
      if (isle[i] === -1 || blocked[i] || rng() >= density) continue;
      const room = Math.min(capAt({ x, z }), clearance[i]! - heights[i]!);
      const nearBuilding = buildings.some((b) => Math.max(Math.abs(b.x - x), Math.abs(b.z - z)) < BUILDING_GAP);
      const fits = (Object.keys(weights) as DecorationKind[]).filter((kind) => {
        if (DECORATION_HEIGHT[kind] > room) return false;
        if (!MINOR_BUILDINGS.includes(kind)) return true;
        return !nearBuilding && (used.get(kind) ?? 0) < (MOST[kind] ?? Infinity);
      });
      const total = fits.reduce((sum, kind) => sum + weights[kind], 0);
      const roll = rng() * total;
      const turn = rng();
      if (fits.length === 0) continue;
      let acc = 0;
      const kind = fits.find((k) => (acc += weights[k]) > roll) ?? fits.at(-1)!;
      const building = MINOR_BUILDINGS.includes(kind);
      // A minor building's front faces the camera: south or east. Plants and rocks turn any way.
      const facing: Facing = building ? (turn < 0.5 ? 'south' : 'east') : FACINGS[Math.floor(turn * 4)]!;
      placed.push({ kind, cell: { x, z }, facing });
      used.set(kind, (used.get(kind) ?? 0) + 1);
      if (building) buildings.push({ x, z });
    }
  }
  return placed;
}
