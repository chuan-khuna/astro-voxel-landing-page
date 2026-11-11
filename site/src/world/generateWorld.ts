import { createRng, randInt, type Rng } from './prng';
import {
  PLACED_LANDMARK_IDS,
  type Cell,
  type ContentCounts,
  type Isle,
  type PlacedLandmark,
  type PlacedLandmarkId,
  type Terrain,
  type View,
  type World,
} from './types';

/** Sea margin, in cells, kept around the land on every side. */
const SEA_MARGIN = 4;
/** Height of the flat Isle, in voxels. */
const ISLE_HEIGHT = 1;
/** Minimum Chebyshev distance between two placed Landmarks, in cells. */
const LANDMARK_SPACING = 3;

/**
 * Generate the World for a Seed and content counts. Pure and deterministic:
 * the same Seed and counts always give a deep-equal World.
 *
 * Tracer-bullet version: one flat Isle with the five placed Landmarks and the
 * two derived views. Terrain noise, more Isles, Biomes and content-driven
 * features (trees, boats, ships) arrive in later tickets.
 */
export function generateWorld(seed: string, _counts: ContentCounts): World {
  const rng = createRng(seed);
  const { terrain, isle } = buildFlatIsle(rng);
  const landmarks = placeLandmarks(rng, terrain, isle);
  return {
    seed,
    terrain,
    isles: [isle],
    landmarks,
    views: deriveViews([isle], landmarks),
  };
}

function buildFlatIsle(rng: Rng): { terrain: Terrain; isle: Isle } {
  const isleWidth = randInt(rng, 14, 20);
  const isleDepth = randInt(rng, 14, 20);
  const width = isleWidth + SEA_MARGIN * 2;
  const depth = isleDepth + SEA_MARGIN * 2;
  const heights = new Array<number>(width * depth).fill(0);
  const isleIds = new Array<number>(width * depth).fill(-1);

  // Rounded-rectangle footprint: trim the corners so it reads as land, not a tile.
  const corner = randInt(rng, 2, 4);
  let cellCount = 0;
  for (let z = 0; z < isleDepth; z++) {
    for (let x = 0; x < isleWidth; x++) {
      const dx = Math.max(0, corner - x, x - (isleWidth - 1 - corner));
      const dz = Math.max(0, corner - z, z - (isleDepth - 1 - corner));
      if (dx * dx + dz * dz > corner * corner) continue;
      const i = (z + SEA_MARGIN) * width + (x + SEA_MARGIN);
      heights[i] = ISLE_HEIGHT;
      isleIds[i] = 0;
      cellCount++;
    }
  }

  return {
    terrain: { width, depth, heights, isle: isleIds },
    isle: {
      id: 0,
      bounds: {
        minX: SEA_MARGIN,
        maxX: SEA_MARGIN + isleWidth - 1,
        minZ: SEA_MARGIN,
        maxZ: SEA_MARGIN + isleDepth - 1,
      },
      cellCount,
    },
  };
}

function isLand(terrain: Terrain, x: number, z: number): boolean {
  if (x < 0 || z < 0 || x >= terrain.width || z >= terrain.depth) return false;
  return terrain.isle[z * terrain.width + x] !== -1;
}

/** A land cell with at least one sea cell beside it (4-neighbourhood). */
function isShore(terrain: Terrain, x: number, z: number): boolean {
  return (
    isLand(terrain, x, z) &&
    (!isLand(terrain, x + 1, z) || !isLand(terrain, x - 1, z) || !isLand(terrain, x, z + 1) || !isLand(terrain, x, z - 1))
  );
}

function landCells(terrain: Terrain, isle: Isle): Cell[] {
  const cells: Cell[] = [];
  for (let z = isle.bounds.minZ; z <= isle.bounds.maxZ; z++) {
    for (let x = isle.bounds.minX; x <= isle.bounds.maxX; x++) {
      if (terrain.isle[z * terrain.width + x] === isle.id) cells.push({ x, z });
    }
  }
  return cells;
}

function placeLandmarks(rng: Rng, terrain: Terrain, isle: Isle): PlacedLandmark[] {
  const cells = landCells(terrain, isle);
  const shore = cells.filter((c) => isShore(terrain, c.x, c.z));
  const inland = cells.filter((c) => !isShore(terrain, c.x, c.z));
  const taken: Cell[] = [];
  const farEnough = (c: Cell) =>
    taken.every((t) => Math.max(Math.abs(t.x - c.x), Math.abs(t.z - c.z)) >= LANDMARK_SPACING);

  const pick = (pool: Cell[]): Cell => {
    const free = pool.filter(farEnough);
    // The flat Isle is always large enough; fall back to any untaken cell just in case.
    const from = free.length > 0 ? free : pool.filter((c) => !taken.some((t) => t.x === c.x && t.z === c.z));
    const cell = from[Math.floor(rng() * from.length)]!;
    taken.push(cell);
    return cell;
  };

  // The Dock sits at the water's edge; everything else is inland.
  return PLACED_LANDMARK_IDS.map((id: PlacedLandmarkId) => {
    const cell = pick(id === 'dock' ? shore : inland);
    return {
      id,
      isle: isle.id,
      cell,
      y: terrain.heights[cell.z * terrain.width + cell.x]!,
      variant: 0,
    };
  });
}

/** Cell centre in world units: one terrain voxel is one unit. */
function cellCentre(cell: Cell, y: number) {
  return { x: cell.x + 0.5, y, z: cell.z + 0.5 };
}

function deriveViews(isles: Isle[], landmarks: PlacedLandmark[]): World['views'] {
  // Overview fits the World's bounds: the union of every Isle's footprint.
  const minX = Math.min(...isles.map((i) => i.bounds.minX));
  const maxX = Math.max(...isles.map((i) => i.bounds.maxX)) + 1;
  const minZ = Math.min(...isles.map((i) => i.bounds.minZ));
  const maxZ = Math.max(...isles.map((i) => i.bounds.maxZ)) + 1;
  const overview: View = {
    target: { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 },
    radius: Math.max(maxX - minX, maxZ - minZ) / 2 + 2,
  };
  // House Interior looks into the House from close up.
  const house = landmarks.find((l) => l.id === 'house')!;
  const houseInterior: View = { target: cellCentre(house.cell, house.y), radius: 2 };
  return { overview, 'house-interior': houseInterior };
}
