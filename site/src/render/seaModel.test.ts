import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import {
  coastDistance,
  DEEP_REACH,
  SEA_BOB,
  SEA_LEVEL,
  SEA_RING,
  SHALLOW_OPACITY,
  SKIRT_BOTTOM,
  seaModel,
  seaShade,
  type SeaMesh,
} from './seaModel';

const world = generateWorld('harbour', { projects: 6, clients: 5, partners: 3 });
const { width, depth, isle } = world.terrain;
const sea = seaModel(world);

interface Face {
  /** The face's four corners. */
  corners: { x: number; y: number; z: number }[];
  normal: { x: number; y: number; z: number };
  /** The voxel the face belongs to, and whether each corner rises and falls with it. */
  cell: { x: number; z: number };
  lifts: number[];
  deep: number;
  opacity: number;
  swell: number;
  /** Distance from the coastline at the voxel's corners: (x, z), (x + 1, z), (x, z + 1), (x + 1, z + 1). */
  coast: number[];
  /** Whether surf may break at those corners: 0 by the jetty and the moored boats. */
  calm: number[];
}

/** Quads of a sea mesh: every 4 vertices are one face (two triangles). */
function faces(mesh: SeaMesh): Face[] {
  const out: Face[] = [];
  for (let v = 0; v < mesh.positions.length / 3; v += 4) {
    const corners = [0, 1, 2, 3].map((k) => ({
      x: mesh.positions[(v + k) * 3]!,
      y: mesh.positions[(v + k) * 3 + 1]!,
      z: mesh.positions[(v + k) * 3 + 2]!,
    }));
    out.push({
      corners,
      normal: { x: mesh.normals[v * 3]!, y: mesh.normals[v * 3 + 1]!, z: mesh.normals[v * 3 + 2]! },
      cell: { x: mesh.cells[v * 3]!, z: mesh.cells[v * 3 + 1]! },
      lifts: [0, 1, 2, 3].map((k) => mesh.cells[(v + k) * 3 + 2]!),
      deep: mesh.shades[v * 3]!,
      opacity: mesh.shades[v * 3 + 1]!,
      swell: mesh.shades[v * 3 + 2]!,
      coast: [0, 1, 2, 3].map((k) => mesh.coast[v * 4 + k]!),
      calm: [0, 1, 2, 3].map((k) => mesh.calm[v * 4 + k]!),
    });
  }
  return out;
}

const water = faces(sea.water);
/** The water's top faces that bob: one per voxel of the 1-unit layer. */
const tops = water.filter((f) => f.normal.y === 1 && f.lifts.every((l) => l === 1));
const topAt = new Map(tops.map((f) => [`${f.cell.x},${f.cell.z}`, f]));
const isLand = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth && isle[z * width + x] !== -1;

describe('sea model', () => {
  it('puts one water voxel top at sea level on every sea cell of the grid and a ring round it, none on land', () => {
    for (let z = -SEA_RING; z < depth + SEA_RING; z++) {
      for (let x = -SEA_RING; x < width + SEA_RING; x++) {
        const top = topAt.get(`${x},${z}`);
        if (isLand(x, z)) {
          expect(top).toBeUndefined();
          continue;
        }
        expect(top).toBeDefined();
        const xs = top!.corners.map((c) => c.x);
        const zs = top!.corners.map((c) => c.z);
        expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([x, x + 1, z, z + 1]);
        for (const c of top!.corners) expect(c.y).toBeCloseTo(SEA_LEVEL);
      }
    }
    expect(tops.length).toBe(topAt.size);
  });
});

/** Distance to the nearest land cell, centre to centre, by brute force. */
function coast(x: number, z: number): number {
  let best = Infinity;
  for (let lz = 0; lz < depth; lz++) {
    for (let lx = 0; lx < width; lx++) if (isLand(lx, lz)) best = Math.min(best, Math.hypot(lx - x, lz - z));
  }
  return best;
}

describe('sea shade', () => {
  it('runs from shallow and translucent beside the coast to deep and opaque out at sea', () => {
    const beside = tops.filter((t) => coast(t.cell.x, t.cell.z) === 1);
    expect(beside.length).toBeGreaterThan(0);
    for (const t of beside) {
      expect(t.deep).toBe(0);
      expect(t.opacity).toBeCloseTo(SHALLOW_OPACITY);
    }
    const far = tops.filter((t) => coast(t.cell.x, t.cell.z) >= DEEP_REACH);
    expect(far.length).toBeGreaterThan(0);
    for (const t of far) {
      expect(t.deep).toBe(1);
      expect(t.opacity).toBe(1);
    }
  });

  it('grows deeper and clearer with distance from the coast, never shallower further out', () => {
    expect(seaShade(1, 9).deep).toBe(0);
    expect(seaShade(2, 9).deep).toBeCloseTo(0.2);
    expect(seaShade(3, 9).opacity).toBe(1);
    const steps = [1, Math.SQRT2, 2, 3, 4, 5, 6, 8].map((d) => seaShade(d, 9));
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.deep).toBeGreaterThanOrEqual(steps[i - 1]!.deep);
      expect(steps[i]!.opacity).toBeGreaterThanOrEqual(steps[i - 1]!.opacity);
    }
  });

  it('measures the coast close to the true distance where the shade still changes', () => {
    const { w, distance } = coastDistance(world);
    for (const t of tops) {
      const d = distance[(t.cell.z + SEA_RING) * w + t.cell.x + SEA_RING]!;
      const truth = coast(t.cell.x, t.cell.z);
      if (truth <= DEEP_REACH) expect(Math.abs(d - truth)).toBeLessThan(0.5);
      else expect(d).toBeGreaterThan(DEEP_REACH - 0.5);
    }
  });
});

describe('sea swell and frame', () => {
  it('bobs fully over the grid and fades to still at the ring\'s outer edge', () => {
    for (const t of tops) {
      const inGrid = t.cell.x >= 0 && t.cell.z >= 0 && t.cell.x < width && t.cell.z < depth;
      if (inGrid) expect(t.swell).toBe(1);
      const outer = t.cell.x === -SEA_RING || t.cell.z === -SEA_RING || t.cell.x === width + SEA_RING - 1 || t.cell.z === depth + SEA_RING - 1;
      if (outer) expect(t.swell).toBe(0);
    }
  });

  it('frames the voxels with still, deep, opaque water out to six times the grid, flush with them', () => {
    const still = water.filter((f) => f.lifts.every((l) => l === 0) && f.normal.y === 1);
    expect(still).toHaveLength(4);
    const xs = still.flatMap((f) => f.corners.map((c) => c.x));
    const zs = still.flatMap((f) => f.corners.map((c) => c.z));
    expect(Math.min(...xs)).toBeCloseTo(width / 2 - 3 * width);
    expect(Math.max(...xs)).toBeCloseTo(width / 2 + 3 * width);
    expect(Math.min(...zs)).toBeCloseTo(depth / 2 - 3 * depth);
    expect(Math.max(...zs)).toBeCloseTo(depth / 2 + 3 * depth);
    for (const f of still) {
      expect([f.deep, f.opacity, f.swell]).toEqual([1, 1, 0]);
      for (const c of f.corners) {
        expect(c.y).toBeCloseTo(SEA_LEVEL);
        // Nothing of the frame lies over the voxels.
        const inside = c.x > -SEA_RING && c.x < width + SEA_RING && c.z > -SEA_RING && c.z < depth + SEA_RING;
        expect(inside).toBe(false);
      }
    }
  });
});

describe('sea skirts', () => {
  const skirts = water.filter((f) => f.normal.y === 0);

  it('hangs a skirt on the +x and +z sides of a voxel whose neighbour there is water, and none against land', () => {
    const key = (f: Face) => `${f.cell.x},${f.cell.z},${f.normal.x},${f.normal.z}`;
    const have = new Set(skirts.map(key));
    expect(have.size).toBe(skirts.length);
    for (const t of tops) {
      for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
        const neighbour = topAt.has(`${t.cell.x + dx},${t.cell.z + dz}`);
        expect(have.has(`${t.cell.x},${t.cell.z},${dx},${dz}`)).toBe(neighbour);
      }
    }
    for (const f of skirts) expect(f.normal.x < 0 || f.normal.z < 0).toBe(false);
  });

  it('bobs a skirt\'s top edge with its voxel and ends it below the lowest top, above the sea floor', () => {
    for (const f of skirts) {
      f.corners.forEach((c, k) => {
        if (f.lifts[k] === 1) expect(c.y).toBeCloseTo(SEA_LEVEL);
        else expect(c.y).toBeCloseTo(SKIRT_BOTTOM);
      });
    }
    expect(SKIRT_BOTTOM).toBeLessThan(SEA_LEVEL - SEA_BOB);
    expect(SKIRT_BOTTOM).toBeGreaterThan(0);
  });
});

describe('seabed', () => {
  it('lays a tile on the sea floor under every translucent water voxel, and only there', () => {
    const bed = faces(sea.seabed);
    const under = new Set(bed.map((f) => `${f.cell.x},${f.cell.z}`));
    for (const f of bed) for (const c of f.corners) expect(c.y).toBe(0);
    for (const t of tops) expect(under.has(`${t.cell.x},${t.cell.z}`)).toBe(t.opacity < 1);
    expect(under.size).toBe(bed.length);
  });
});

describe('surf data', () => {
  /** Corner k of a cell: 0 (x, z), 1 (x + 1, z), 2 (x, z + 1), 3 (x + 1, z + 1). */
  const corner = (cell: { x: number; z: number }, k: number) => ({ x: cell.x + (k % 2), z: cell.z + Math.floor(k / 2) });
  const nearestLand = (p: { x: number; z: number }) => {
    let best = Infinity;
    for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) if (isLand(x, z)) best = Math.min(best, Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z));
    return best;
  };

  it('gives each water voxel\'s corners their distance from the coastline: about 0 on the land\'s edge, growing out to sea', () => {
    for (const t of tops) {
      for (let k = 0; k < 4; k++) {
        const c = corner(t.cell, k);
        // A corner on the edge of a land cell is on the coastline; else, measured from the nearest land cell's edge (half a cell from its centre), within a cell.
        const truth = Math.max(0, nearestLand(c) - Math.SQRT1_2);
        if (truth === 0) expect(t.coast[k], `${c.x},${c.z}`).toBeLessThanOrEqual(0.5);
        else if (truth < 6) expect(Math.abs(t.coast[k]! - truth), `${c.x},${c.z}`).toBeLessThanOrEqual(1);
        else expect(t.coast[k], `${c.x},${c.z}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('keeps the surf off the jetty and the moored boats: calm at every corner of their cells, and free two cells away', () => {
    const still = [...world.landmarks.flatMap((l) => l.jetty), ...world.boats.map((b) => b.cell)];
    expect(still.length).toBeGreaterThan(0);
    for (const c of still) expect(topAt.get(`${c.x},${c.z}`)!.calm, `${c.x},${c.z}`).toEqual([0, 0, 0, 0]);
    for (const t of tops) {
      const far = still.every((c) => Math.max(Math.abs(c.x - t.cell.x), Math.abs(c.z - t.cell.z)) >= 2);
      if (far) expect(t.calm, `${t.cell.x},${t.cell.z}`).toEqual([1, 1, 1, 1]);
    }
  });
});

describe('sea triangles', () => {
  it('counts two triangles a quad, and stays well inside the World\'s budget', () => {
    for (const mesh of [sea.water, sea.seabed]) {
      expect(mesh.triangles).toBe(mesh.indices.length / 3);
      expect(mesh.triangles).toBe(mesh.positions.length / 6);
    }
    // Top plus at most two skirts a voxel, the frame, and the seabed.
    expect(sea.water.triangles).toBeLessThanOrEqual(tops.length * 6 + 8);
    expect(sea.water.triangles + sea.seabed.triangles).toBeLessThan(60_000);
  });
});
