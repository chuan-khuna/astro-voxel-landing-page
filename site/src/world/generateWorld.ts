import { BIOMES, BIOME_RELIEF } from './biomes';
import { buildBridges } from './bridges';
import { findPath, stairsAlong } from './paths';
import { createRng } from './prng';
import { placeLandmarks } from './landmarks';
import { sailingRoutes } from './ships';
import { placeBuoys } from './buoys';
import { buildStrata, buildTerrain } from './terrain';
import { site } from '../data/site';
import {
  BIOME_IDS,
  type BiomeId,
  type Boat,
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

/** Noise layouts tried before the safe layout. */
const MAX_NOISE_ATTEMPTS = 8;
/** The four neighbours of a cell. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Longest Seed accepted; a longer or empty Seed falls back to the default Seed. */
export const MAX_SEED_LENGTH = 32;

/**
 * Generate the World for a Seed and content counts. Pure and deterministic:
 * the same Seed and counts always give a deep-equal World.
 */
export function generateWorld(givenSeed: string, counts: ContentCounts): World {
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
    const { isles } = built;
    const bridges = buildBridges(rng, built.terrain, isles);
    if (!bridges) continue;
    const placement = placeLandmarks(rng, built.terrain, isles, bridges, { trees: counts.projects, boats: counts.clients });
    if (!placement) continue;
    const { landmarks, boats, terrain } = placement;
    const route = dockToHouse(terrain, bridges, landmarks);
    if (!route) continue;
    const ships = sailingRoutes(terrain, isles, bridges, [...landmarks.flatMap((l) => l.jetty), ...boats.map((b) => b.cell)], counts.partners);
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
      boats,
      ships,
      buoys: placeBuoys(terrain, bridges, landmarks.find((l) => l.id === 'dock'), boats.map((b) => b.cell), ships),
      views: deriveViews(isles, landmarks, boats),
    };
  }
  throw new Error(`generateWorld: the safe layout broke a rule for Seed "${seed}"`);
}

/**
 * The path from the Dock to the House: from a cell beside the Dock's
 * footprint to a cell beside the House's, each at most one voxel above or
 * below the Landmark, never through any footprint.
 */
function dockToHouse(terrain: Terrain, bridges: Bridge[], landmarks: PlacedLandmark[]): Cell[] | null {
  const of = (id: PlacedLandmarkId) => landmarks.find((l) => l.id === id)!;
  const beside = (l: PlacedLandmark) =>
    l.footprint.cells
      .flatMap((c) => SIDES.map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz })))
      .filter((c) => {
        const i = c.z * terrain.width + c.x;
        return terrain.isle[i] !== -1 && Math.abs(terrain.heights[i]! - l.y) <= 1;
      });
  const covered = landmarks.flatMap((l) => [...l.footprint.cells, ...l.jetty]);
  return findPath(terrain, bridges, beside(of('dock')), beside(of('house')), covered);
}

/** The default Seed gets the brand Biome; any other Seed picks one from its own hash. */
function pickBiome(seed: string): BiomeId {
  if (seed === site.defaultSeed) return site.brandBiome;
  return BIOME_IDS[Math.floor(createRng(`${seed}/biome`)() * BIOME_IDS.length)]!;
}

function deriveViews(isles: Isle[], landmarks: PlacedLandmark[], boats: Boat[]): World['views'] {
  // Overview fits the World's bounds: the union of every Isle's footprint, the Dock's jetty and its boats.
  const jetty = [...landmarks.flatMap((l) => l.jetty), ...boats.map((b) => b.cell)];
  const minX = Math.min(...isles.map((i) => i.bounds.minX), ...jetty.map((c) => c.x));
  const maxX = Math.max(...isles.map((i) => i.bounds.maxX), ...jetty.map((c) => c.x)) + 1;
  const minZ = Math.min(...isles.map((i) => i.bounds.minZ), ...jetty.map((c) => c.z));
  const maxZ = Math.max(...isles.map((i) => i.bounds.maxZ), ...jetty.map((c) => c.z)) + 1;
  const overview: View = {
    target: { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 },
    radius: Math.max(maxX - minX, maxZ - minZ) / 2 + 2,
  };
  // House Interior looks into the House from close up: the middle of its footprint.
  const house = landmarks.find((l) => l.id === 'house')!;
  const { origin, width, depth } = house.footprint;
  const houseInterior: View = {
    target: { x: origin.x + width / 2, y: house.y, z: origin.z + depth / 2 },
    radius: Math.max(width, depth),
  };
  return { overview, 'house-interior': houseInterior };
}
