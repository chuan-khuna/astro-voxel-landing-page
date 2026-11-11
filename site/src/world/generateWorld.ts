import { BIOMES, BIOME_RELIEF } from './biomes';
import { buildBridges } from './bridges';
import { findPath, stairsAlong } from './paths';
import { createRng, type Rng } from './prng';
import { buildStrata, buildTerrain, isShore } from './terrain';
import { site } from '../data/site';
import {
  BIOME_IDS,
  type BiomeId,
  type Bridge,
  type Cell,
  type ContentCounts,
  type Isle,
  type PlacedLandmark,
  type PlacedLandmarkId,
  type Terrain,
  type View,
  type World,
} from './types';

/** Minimum Chebyshev distance between two placed Landmarks, in cells. */
const LANDMARK_SPACING = 3;
/** Noise layouts tried before the safe layout. */
const MAX_NOISE_ATTEMPTS = 8;
/** Longest Seed accepted; a longer or empty Seed falls back to the default Seed. */
export const MAX_SEED_LENGTH = 32;

/**
 * Generate the World for a Seed and content counts. Pure and deterministic:
 * the same Seed and counts always give a deep-equal World.
 */
export function generateWorld(givenSeed: string, _counts: ContentCounts): World {
  const seed = givenSeed.length === 0 || givenSeed.length > MAX_SEED_LENGTH ? site.defaultSeed : givenSeed;
  const biome = BIOMES[pickBiome(seed)];
  // Retry: a layout that breaks a rule is redone from a Seed derived from the
  // given one, so the same input always ends on the same World. After the
  // noise attempts, the safe layout always keeps every rule, so retry ends.
  for (let attempt = 0; attempt <= MAX_NOISE_ATTEMPTS; attempt++) {
    const safe = attempt === MAX_NOISE_ATTEMPTS;
    const rng = createRng(attempt === 0 ? seed : `${seed}#retry${attempt}`);
    const built = buildTerrain(rng, { relief: BIOME_RELIEF[biome.id], safe });
    if (!built) continue;
    const { terrain, isles } = built;
    const bridges = buildBridges(rng, terrain, isles);
    if (!bridges) continue;
    const landmarks = placeLandmarks(rng, terrain, isles, bridges);
    if (!landmarks) continue;
    const cellOf = (id: PlacedLandmarkId) => landmarks.find((l) => l.id === id)!.cell;
    const others = landmarks.filter((l) => l.id !== 'dock' && l.id !== 'house').map((l) => l.cell);
    const route = findPath(terrain, bridges, cellOf('dock'), cellOf('house'), others);
    if (!route) continue;
    return {
      seed,
      attempts: attempt + 1,
      biome,
      terrain,
      strata: buildStrata(rng, Math.max(...terrain.heights)),
      isles,
      bridges,
      paths: [{ from: 'dock', to: 'house', cells: route }],
      stairs: stairsAlong(terrain, bridges, route),
      landmarks,
      views: deriveViews(isles, landmarks),
    };
  }
  throw new Error(`generateWorld: the safe layout broke a rule for Seed "${seed}"`);
}

/** The default Seed gets the brand Biome; any other Seed picks one from its own hash. */
function pickBiome(seed: string): BiomeId {
  if (seed === site.defaultSeed) return site.brandBiome;
  return BIOME_IDS[Math.floor(createRng(`${seed}/biome`)() * BIOME_IDS.length)]!;
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

/**
 * Place the five Landmarks by rule: the Station on its Isle's high ground,
 * the House and Garden on one Isle, the Dock on the shoreline (low shore if
 * there is any), the Mailbox near the House. No Landmark stands at a bridge
 * end, and Landmarks keep apart. Returns null if a rule cannot be met.
 */
function placeLandmarks(rng: Rng, terrain: Terrain, isles: Isle[], bridges: Bridge[]): PlacedLandmark[] | null {
  const { width, heights } = terrain;
  const height = (c: Cell) => heights[c.z * width + c.x]!;
  const bridgeCells = new Set(bridges.flatMap((b) => b.cells.map((c) => c.z * width + c.x)));
  const nextToBridge = (c: Cell) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => bridgeCells.has((c.z + dz!) * width + c.x + dx!));

  const taken: Cell[] = [];
  const farEnough = (c: Cell) =>
    taken.every((t) => Math.max(Math.abs(t.x - c.x), Math.abs(t.z - c.z)) >= LANDMARK_SPACING);
  const pickIsle = () => isles[Math.floor(rng() * isles.length)]!;
  const place = (id: PlacedLandmarkId, isle: Isle, pool: Cell[]): PlacedLandmark | null => {
    const free = pool.filter((c) => farEnough(c) && !nextToBridge(c));
    if (free.length === 0) return null;
    const cell = free[Math.floor(rng() * free.length)]!;
    taken.push(cell);
    return { id, isle: isle.id, cell, y: height(cell), variant: 0 };
  };
  const cellsOf = (isle: Isle) => landCells(terrain, isle);
  const inland = (isle: Isle) => cellsOf(isle).filter((c) => !isShore(terrain, c.x, c.z));

  const stationIsle = pickIsle();
  const top = Math.max(...cellsOf(stationIsle).map(height));
  const station = place('station', stationIsle, cellsOf(stationIsle).filter((c) => height(c) === top));
  if (!station) return null;

  const home = pickIsle();
  const house = place('house', home, inland(home));
  if (!house) return null;
  const garden = place('garden', home, inland(home));

  const dockIsle = pickIsle();
  const shore = cellsOf(dockIsle).filter((c) => isShore(terrain, c.x, c.z));
  const lowShore = shore.filter((c) => height(c) === 1);
  const dock = place('dock', dockIsle, lowShore.some(farEnough) ? lowShore : shore);

  const near = (c: Cell) => Math.max(Math.abs(c.x - house.cell.x), Math.abs(c.z - house.cell.z)) <= 5;
  const nearHouse = inland(home).filter(near);
  const mailbox = place('mailbox', home, nearHouse.some(farEnough) ? nearHouse : inland(home));

  const placed = [station, house, garden, dock, mailbox];
  return placed.every((l) => l !== null) ? (placed as PlacedLandmark[]) : null;
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
