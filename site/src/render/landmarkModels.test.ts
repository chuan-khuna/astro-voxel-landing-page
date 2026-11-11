import { describe, expect, it } from 'vitest';
import { generateWorld, type PlacedLandmark } from '../world';
import { VoxelGrid } from './mesher';
import { buildLandmark, landmarkExtent, treeExtent } from './landmarkModels';
import { DETAIL, worldColours } from './worldVoxels';

const counts = { projects: 6, clients: 0, partners: 0 };
const worlds = ['lanternfish', '694157692', 'harbour', '7', '42'].map((seed) => generateWorld(seed, counts));

/** Every ¼ voxel a Landmark's model draws, in world grid coordinates. */
const voxelsOf = (landmark: PlacedLandmark, world = worlds[0]!) => {
  const grid = new VoxelGrid(1 / DETAIL);
  buildLandmark(landmark, grid, worldColours(world));
  const cells: Array<{ x: number; y: number; z: number }> = [];
  for (const { x, y, z } of grid.voxels()) cells.push({ x, y, z });
  return cells;
};

describe('Landmark models', () => {
  it('fill their footprint: the model reaches every footprint cell, and the jetty', () => {
    for (const world of worlds) {
      for (const l of world.landmarks) {
        const voxels = voxelsOf(l, world);
        const reached = new Set(voxels.map((v) => `${Math.floor(v.x / DETAIL)},${Math.floor(v.z / DETAIL)}`));
        for (const c of [...l.footprint.cells, ...l.jetty]) expect(reached.has(`${c.x},${c.z}`), `${world.seed} ${l.id} ${c.x},${c.z}`).toBe(true);
        // ...and nothing outside it.
        const inside = new Set([...l.footprint.cells, ...l.jetty].map((c) => `${c.x},${c.z}`));
        for (const key of reached) expect(inside.has(key), `${world.seed} ${l.id} ${key}`).toBe(true);
      }
    }
  });

  it('give each Garden tree a model that fills its whole cell', () => {
    for (const world of worlds) {
      const garden = world.landmarks.find((l) => l.id === 'garden')!;
      const voxels = voxelsOf(garden, world);
      for (const t of garden.trees) {
        // A canopy layer covers all 4×4 ¼ voxels of the tree's cell.
        const layer = voxels.filter((v) => Math.floor(v.x / DETAIL) === t.x && Math.floor(v.z / DETAIL) === t.z && v.y === garden.y * DETAIL + 4);
        expect(layer, `${world.seed} tree ${t.x},${t.z}`).toHaveLength(DETAIL * DETAIL);
      }
    }
  });
});

describe('landmarkExtent', () => {
  it('covers the whole footprint (and the jetty) on the ground, and the model\'s height', () => {
    for (const world of worlds) {
      for (const l of world.landmarks) {
        const { min, max } = landmarkExtent(l);
        const { origin } = l.footprint;
        for (const c of [...l.footprint.cells, ...l.jetty]) {
          expect(c.x - origin.x, `${world.seed} ${l.id}`).toBeGreaterThanOrEqual(min.x);
          expect(c.x + 1 - origin.x, `${world.seed} ${l.id}`).toBeLessThanOrEqual(max.x);
          expect(c.z - origin.z, `${world.seed} ${l.id}`).toBeGreaterThanOrEqual(min.z);
          expect(c.z + 1 - origin.z, `${world.seed} ${l.id}`).toBeLessThanOrEqual(max.z);
        }
        expect(max.y, `${world.seed} ${l.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('measures the box the Station draws, in world units', () => {
    const station = worlds[0]!.landmarks.find((l) => l.id === 'station')!;
    // A 2×2 pad, and the mast's light at the top, 17 quarter voxels up.
    expect(landmarkExtent(station)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 4.25, z: 2 } });
  });
});

describe('treeExtent', () => {
  it('is the box of one tree: its cell, from the ground up to the top of its canopy', () => {
    for (const world of worlds) {
      const garden = world.landmarks.find((l) => l.id === 'garden')!;
      const { origin } = garden.footprint;
      for (const t of garden.trees) {
        // A tree is 8 quarter voxels tall: 2 world units.
        expect(treeExtent(garden, t), `${world.seed} ${t.x},${t.z}`).toEqual({
          min: { x: t.x - origin.x, y: 0, z: t.z - origin.z },
          max: { x: t.x - origin.x + 1, y: 2, z: t.z - origin.z + 1 },
        });
      }
    }
  });

  it('holds every voxel the Garden draws in the tree\'s cell', () => {
    const world = worlds[1]!;
    const garden = world.landmarks.find((l) => l.id === 'garden')!;
    const voxels = voxelsOf(garden, world);
    for (const t of garden.trees) {
      const { max } = treeExtent(garden, t);
      const own = voxels.filter((v) => Math.floor(v.x / DETAIL) === t.x && Math.floor(v.z / DETAIL) === t.z);
      for (const v of own) expect(v.y + 1).toBeLessThanOrEqual(garden.y * DETAIL + max.y * DETAIL);
    }
  });
});
