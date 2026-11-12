import { BIOMES, BIOME_RELIEF } from './biomes';
import { buildBridges } from './bridges';
import { findPath, stairsAlong } from './paths';
import { createRng } from './prng';
import { LANDMARK_VARIANTS, houseYard, placeLandmarks } from './landmarks';
import { sailingRoutes } from './ships';
import { BOAT_KINDS, SHIP_KINDS, vesselIds, vesselKind } from './vessels';
import { placeBuoys } from './buoys';
import { placeDecoration } from './decoration';
import { windFor } from './wind';
import { placeParticles } from './particles';
import { placeClouds } from './clouds';
import { buildStrata, buildTerrain } from './terrain';
import { site } from '@/data/site';
import {
  BIOME_IDS,
  PLACED_LANDMARK_IDS,
  type BiomeId,
  type Boat,
  type Bridge,
  type Cell,
  type ContentCounts,
  type Isle,
  type Path,
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
    const placement = placeLandmarks(rng, built.terrain, isles, bridges, { projects: counts.projects, pinned: counts.pinned ?? 0, boats: counts.clients });
    if (!placement) continue;
    const { terrain } = placement;
    const boats = withKinds(placement.boats, counts.clientIds, 'client', BOAT_KINDS);
    const found = dockToHouse(terrain, bridges, placement.landmarks);
    if (!found) continue;
    const landmarks = pickVariants(seed, biome.id, found.landmarks);
    const { route } = found;
    const paths: Path[] = [{ from: 'dock', to: 'house', cells: route }];
    const routes = sailingRoutes(terrain, isles, bridges, [...landmarks.flatMap((l) => l.jetty), ...boats.map((b) => b.cell)], counts.partners);
    const ships = withKinds(routes, counts.partnerIds, 'partner', SHIP_KINDS);
    const decoration = placeDecoration(seed, biome.id, terrain, bridges, paths, landmarks);
    const views = deriveViews(isles, landmarks, boats);
    const wind = windFor(seed);
    return {
      seed,
      attempts: attempt + 1,
      biome,
      terrain,
      strata: buildStrata(rng, Math.max(...terrain.heights)),
      isles,
      bridges,
      paths,
      stairs: stairsAlong(terrain, bridges, route),
      landmarks,
      boats,
      ships,
      buoys: placeBuoys(terrain, bridges, landmarks.find((l) => l.id === 'dock'), boats.map((b) => b.cell), ships),
      decoration,
      particles: placeParticles(seed, biome.id, terrain, bridges, landmarks, decoration),
      clouds: placeClouds(seed, terrain, landmarks, views.overview, wind),
      views,
      wind,
    };
  }
  throw new Error(`generateWorld: the safe layout broke a rule for Seed "${seed}"`);
}

/**
 * The path from the Dock to the House's door: from a cell beside the Dock's
 * footprint to the cell just outside the House's plot in line with its door
 * (`houseYard`), each at most one voxel above or below its Landmark, never
 * through any footprint. The door faces the way the Seed chose if the path
 * can reach it, else the other way (the House's `door` is updated). Null if
 * neither can.
 */
function dockToHouse(
  terrain: Terrain,
  bridges: Bridge[],
  landmarks: PlacedLandmark[],
): { route: Cell[]; landmarks: PlacedLandmark[] } | null {
  const of = (id: PlacedLandmarkId) => landmarks.find((l) => l.id === id)!;
  const near = (l: PlacedLandmark) => (c: Cell) => {
    if (c.x < 0 || c.z < 0 || c.x >= terrain.width || c.z >= terrain.depth) return false;
    const i = c.z * terrain.width + c.x;
    return terrain.isle[i] !== -1 && Math.abs(terrain.heights[i]! - l.y) <= 1;
  };
  const dock = of('dock');
  const house = of('house');
  const start = dock.footprint.cells.flatMap((c) => SIDES.map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz }))).filter(near(dock));
  const covered = landmarks.flatMap((l) => [...l.footprint.cells, ...l.jetty]);
  const preferred = house.door ?? 'south';
  for (const door of [preferred, preferred === 'south' ? 'east' : 'south'] as const) {
    const goal = [houseYard(house, door).approach].filter(near(house));
    const route = findPath(terrain, bridges, start, goal, covered);
    if (route) return { route, landmarks: landmarks.map((l) => (l === house ? { ...l, door } : l)) };
  }
  return null;
}

/**
 * Give each boat (or ship) the kind of its Client (or Partner), in order:
 * from the id alone, never the Seed, so it keeps its kind in every World.
 */
function withKinds<T>(vessels: T[], ids: readonly string[] | undefined, prefix: string, kinds: number): Array<T & { kind: number }> {
  const owners = vesselIds(vessels.length, ids, prefix);
  return vessels.map((v, i) => ({ ...v, kind: vesselKind(owners[i]!, kinds) }));
}

/**
 * Each Landmark's Variant, from 1 to its count in the Biome's style
 * (`LANDMARK_VARIANTS`). Drawn from a sequence of the Seed's own, never the
 * layout's: the same Seed always gives the same Variants, whatever the
 * content counts or retries, and adding Variants never moves the layout.
 */
function pickVariants(seed: string, biome: BiomeId, landmarks: PlacedLandmark[]): PlacedLandmark[] {
  const rng = createRng(`${seed}/variants`);
  const picks = new Map(PLACED_LANDMARK_IDS.map((id) => [id, 1 + Math.floor(rng() * LANDMARK_VARIANTS[biome][id])]));
  return landmarks.map((l) => ({ ...l, variant: picks.get(l.id)! }));
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
  // House Interior looks into the House from close up: the middle of the House (not its yard).
  const house = landmarks.find((l) => l.id === 'house')!;
  const { origin, width, depth } = houseYard(house).house;
  const houseInterior: View = {
    target: { x: origin.x + width / 2, y: house.y, z: origin.z + depth / 2 },
    radius: Math.max(width, depth),
  };
  return { overview, 'house-interior': houseInterior };
}
