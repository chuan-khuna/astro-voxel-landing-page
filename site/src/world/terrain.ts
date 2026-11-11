import { createSimplex2D, fbm } from './noise';
import { randInt, type Rng } from './prng';
import type { Isle, StratumKind, SurfaceKind, Terrain } from './types';

/** Sea margin, in cells, kept around the land on every side. */
const SEA_MARGIN = 4;
/** Smallest Isle, in cells, that a layout may keep. */
const MIN_ISLE_CELLS = 30;
/** How far noise pushes the coast in or out, as a share of an Isle's radius. */
const COAST_NOISE = 0.3;
/** How much noise roughens the heights. */
const RELIEF_NOISE = 0.2;

export interface TerrainOptions {
  /** Range of extra height steps an Isle's peak reaches above the shore. */
  relief: { minPeak: number; maxPeak: number };
  /**
   * The safe layout: one round Isle with no noise and concentric terraces,
   * which always keeps every rule. Used as the last retry.
   */
  safe: boolean;
}

interface IsleSpec {
  cx: number;
  cz: number;
  radius: number;
  peak: number;
}

/**
 * Shape 1–4 Isles: each is a radial falloff around its centre, pushed in and
 * out by FBM noise, with heights quantised to whole voxel steps. Returns null
 * if the layout breaks a rule (two Isles touching, or an Isle too small).
 */
export function buildTerrain(rng: Rng, options: TerrainOptions): { terrain: Terrain; isles: Isle[] } | null {
  const specs = placeIsleSpecs(rng, options);
  if (!specs) return null;
  const coast = createSimplex2D(rng);
  const relief = createSimplex2D(rng);
  const coastNoise = options.safe ? 0 : COAST_NOISE;
  const reliefNoise = options.safe ? 0 : RELIEF_NOISE;

  // Grid that fits every Isle at its widest, plus the sea margin.
  const reach = (s: IsleSpec) => s.radius * (1 + coastNoise) + 1;
  const minX = Math.floor(Math.min(...specs.map((s) => s.cx - reach(s))));
  const maxX = Math.ceil(Math.max(...specs.map((s) => s.cx + reach(s))));
  const minZ = Math.floor(Math.min(...specs.map((s) => s.cz - reach(s))));
  const maxZ = Math.ceil(Math.max(...specs.map((s) => s.cz + reach(s))));
  const width = maxX - minX + 1 + SEA_MARGIN * 2;
  const depth = maxZ - minZ + 1 + SEA_MARGIN * 2;
  const offsetX = SEA_MARGIN - minX;
  const offsetZ = SEA_MARGIN - minZ;

  const heights = new Array<number>(width * depth).fill(0);
  const isle = new Array<number>(width * depth).fill(-1);
  const strength = new Array<number>(width * depth).fill(0);

  for (let z = SEA_MARGIN; z < depth - SEA_MARGIN; z++) {
    for (let x = SEA_MARGIN; x < width - SEA_MARGIN; x++) {
      const wx = x - offsetX + 0.5;
      const wz = z - offsetZ + 0.5;
      const n = fbm(coast, wx / 7, wz / 7);
      let best = 0;
      let owner = -1;
      specs.forEach((s, id) => {
        // Island falloff: 1 at the centre, 0 at the radius, noise moves the coast.
        const v = 1 - Math.hypot(wx - s.cx, wz - s.cz) / s.radius + coastNoise * n;
        if (v > best) {
          best = v;
          owner = id;
        }
      });
      if (owner === -1) continue;
      const i = z * width + x;
      isle[i] = owner;
      strength[i] = best;
    }
  }

  keepLargestComponents(width, depth, isle, specs.length);
  if (isleTouchesAnother(width, depth, isle)) return null;

  for (let i = 0; i < heights.length; i++) {
    const id = isle[i]!;
    if (id === -1) continue;
    const x = i % width;
    const z = Math.floor(i / width);
    const t = Math.min(0.999, Math.max(0, strength[i]! + reliefNoise * fbm(relief, x / 5, z / 5, 3)));
    heights[i] = 1 + Math.floor(t * (specs[id]!.peak + 1));
  }

  const isles: Isle[] = specs.map((_, id) => ({
    id,
    bounds: { minX: width, maxX: -1, minZ: depth, maxZ: -1 },
    cellCount: 0,
  }));
  for (let i = 0; i < isle.length; i++) {
    const id = isle[i]!;
    if (id === -1) continue;
    const x = i % width;
    const z = Math.floor(i / width);
    const b = isles[id]!.bounds;
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minZ = Math.min(b.minZ, z);
    b.maxZ = Math.max(b.maxZ, z);
    isles[id]!.cellCount++;
  }
  if (isles.some((s) => s.cellCount < MIN_ISLE_CELLS)) return null;

  const terrain: Terrain = { width, depth, heights, isle, surface: [] };
  terrain.surface = surfaceOf(terrain, isles);
  return { terrain, isles };
}

function placeIsleSpecs(rng: Rng, options: TerrainOptions): IsleSpec[] | null {
  const { minPeak, maxPeak } = options.relief;
  if (options.safe) return [{ cx: 0, cz: 0, radius: 9, peak: minPeak }];

  // Weighted: two and three Isles are the most common.
  const roll = rng();
  const count = roll < 0.2 ? 1 : roll < 0.5 ? 2 : roll < 0.8 ? 3 : 4;
  const [minR, maxR] = count === 1 ? [9, 12] : count === 4 ? [6, 8] : [7, 10];

  const specs: IsleSpec[] = [];
  for (let k = 0; k < count; k++) {
    const radius = randInt(rng, minR, maxR);
    const peak = randInt(rng, minPeak, maxPeak);
    if (k === 0) {
      specs.push({ cx: 0, cz: 0, radius, peak });
      continue;
    }
    // Set each new Isle beside an earlier one, a short sea gap away.
    let placed = false;
    for (let tries = 0; tries < 12 && !placed; tries++) {
      const anchor = specs[Math.floor(rng() * specs.length)]!;
      const angle = rng() * Math.PI * 2;
      const distance = anchor.radius + radius + randInt(rng, 4, 7);
      const cx = anchor.cx + Math.cos(angle) * distance;
      const cz = anchor.cz + Math.sin(angle) * distance;
      if (specs.every((s) => Math.hypot(s.cx - cx, s.cz - cz) >= s.radius + radius + 4)) {
        specs.push({ cx, cz, radius, peak });
        placed = true;
      }
    }
    if (!placed) return null;
  }
  return specs;
}

const NEIGHBOURS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Drop every stray piece of an Isle except its largest connected piece. */
function keepLargestComponents(width: number, depth: number, isle: number[], count: number): void {
  const component = new Array<number>(isle.length).fill(-1);
  const best = new Array<{ label: number; size: number }>(count).fill({ label: -1, size: 0 });
  let label = 0;
  for (let start = 0; start < isle.length; start++) {
    if (isle[start] === -1 || component[start] !== -1) continue;
    const id = isle[start]!;
    const stack = [start];
    component[start] = label;
    let size = 0;
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % width;
      const z = Math.floor(i / width);
      for (const [dx, dz] of NEIGHBOURS_4) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
        const j = nz * width + nx;
        if (isle[j] === id && component[j] === -1) {
          component[j] = label;
          stack.push(j);
        }
      }
    }
    if (size > best[id]!.size) best[id] = { label, size };
    label++;
  }
  for (let i = 0; i < isle.length; i++) {
    if (isle[i] !== -1 && component[i] !== best[isle[i]!]!.label) isle[i] = -1;
  }
}

/** True if land of two different Isles meets, even corner to corner. */
function isleTouchesAnother(width: number, depth: number, isle: number[]): boolean {
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const id = isle[z * width + x]!;
      if (id === -1) continue;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
          const other = isle[nz * width + nx]!;
          if (other !== -1 && other !== id) return true;
        }
      }
    }
  }
  return false;
}

/** True if the cell is land with sea on at least one of its four sides. */
export function isShore(terrain: Terrain, x: number, z: number): boolean {
  const { width, depth, isle } = terrain;
  if (isle[z * width + x] === -1) return false;
  return NEIGHBOURS_4.some(([dx, dz]) => {
    const nx = x + dx;
    const nz = z + dz;
    return nx < 0 || nz < 0 || nx >= width || nz >= depth || isle[nz * width + nx] === -1;
  });
}

function surfaceOf(terrain: Terrain, isles: Isle[]): SurfaceKind[] {
  const { width, heights, isle } = terrain;
  const top = isles.map(() => 0);
  heights.forEach((h, i) => {
    if (isle[i] !== -1) top[isle[i]!] = Math.max(top[isle[i]!]!, h);
  });
  return heights.map((h, i) => {
    const id = isle[i]!;
    if (id === -1) return 'sea';
    if (h === 1 && isShore(terrain, i % width, Math.floor(i / width))) return 'sand';
    if (h === top[id] && h >= 4) return 'peak';
    return 'grass';
  });
}

/**
 * Cliff layering: the rock layer of buried voxels by absolute height. The
 * waterline layer is dark rock; above it, bands of soil and rock alternate,
 * each one or two voxels thick.
 */
export function buildStrata(rng: Rng, maxHeight: number): StratumKind[] {
  const strata: StratumKind[] = ['rockDark'];
  let kind: StratumKind = rng() < 0.5 ? 'rock' : 'soil';
  while (strata.length < maxHeight) {
    const thickness = randInt(rng, 1, 2);
    for (let t = 0; t < thickness && strata.length < maxHeight; t++) strata.push(kind);
    kind = kind === 'rock' ? 'soil' : 'rock';
  }
  return strata;
}
