import { describe, expect, it } from 'vitest';
import { generateWorld, type PlacedLandmark } from '@/world';
import { VoxelGrid } from './mesher';
import { buildLandmark, landmarkExtent, treeExtent } from './landmarkModels';
import { worldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

const counts = { projects: 6, clients: 0, partners: 0 };
const worlds = ['lighthouse', '694157692', 'harbour', '7', '42'].map((seed) => generateWorld(seed, counts));

/** Every ¼ voxel a Landmark's model draws, in world grid coordinates. */
const voxelsOf = (landmark: PlacedLandmark, world = worlds[0]!) => {
  const grid = new VoxelGrid(1 / GROUND_DETAIL);
  buildLandmark(landmark, grid, worldColours(world));
  const cells: Array<{ x: number; y: number; z: number }> = [];
  for (const { x, y, z } of grid.voxels()) cells.push({ x, y, z });
  return cells;
};

describe('Landmark models', () => {
  it('fill their footprint: the model reaches every footprint cell, and the jetty', () => {
    for (const world of worlds) {
      // The House's plot holds its structure, its yard and the Mailbox (`structureModels.test.ts`).
      for (const l of world.landmarks.filter((l) => l.id !== 'house')) {
        const voxels = voxelsOf(l, world);
        const reached = new Set(voxels.map((v) => `${Math.floor(v.x / GROUND_DETAIL)},${Math.floor(v.z / GROUND_DETAIL)}`));
        for (const c of [...l.footprint.cells, ...l.jetty]) expect(reached.has(`${c.x},${c.z}`), `${world.seed} ${l.id} ${c.x},${c.z}`).toBe(true);
        // ...and nothing outside it.
        const inside = new Set([...l.footprint.cells, ...l.jetty].map((c) => `${c.x},${c.z}`));
        for (const key of reached) expect(inside.has(key), `${world.seed} ${l.id} ${key}`).toBe(true);
      }
    }
  });

  it('draw only the room inside the House, within the House\'s 3×3', () => {
    for (const world of worlds) {
      const house = world.landmarks.find((l) => l.id === 'house')!;
      const voxels = voxelsOf(house, world);
      expect(voxels.length).toBeGreaterThan(0);
      for (const v of voxels) {
        expect(Math.floor(v.x / GROUND_DETAIL) - house.footprint.origin.x, world.seed).toBeLessThan(3);
        expect(Math.floor(v.z / GROUND_DETAIL) - house.footprint.origin.z, world.seed).toBeLessThan(3);
      }
    }
  });

  it('give each Garden tree a model that fills its whole cell', () => {
    for (const world of worlds) {
      const garden = world.landmarks.find((l) => l.id === 'garden')!;
      const voxels = voxelsOf(garden, world);
      for (const t of garden.trees) {
        // A canopy layer covers all 4×4 ¼ voxels of the tree's cell.
        const layer = voxels.filter((v) => Math.floor(v.x / GROUND_DETAIL) === t.x && Math.floor(v.z / GROUND_DETAIL) === t.z && v.y === garden.y * GROUND_DETAIL + 4);
        expect(layer, `${world.seed} tree ${t.x},${t.z}`).toHaveLength(GROUND_DETAIL * GROUND_DETAIL);
      }
    }
  });
});

describe('landmarkExtent', () => {
  it('covers the whole footprint (and the jetty) on the ground, and the model\'s height', () => {
    for (const world of worlds) {
      for (const l of world.landmarks.filter((l) => l.id !== 'house')) {
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
      // The House's box is the House: its 3×3, not its yard, up to its roof (3.5–4 units).
      const house = landmarkExtent(world.landmarks.find((l) => l.id === 'house')!);
      expect(house.min, world.seed).toEqual({ x: 0, y: 0, z: 0 });
      expect([house.max.x, house.max.z], world.seed).toEqual([3, 3]);
      expect(house.max.y, world.seed).toBeGreaterThanOrEqual(3.5);
      expect(house.max.y, world.seed).toBeLessThanOrEqual(4);
    }
  });

  it('measures the box the Station draws, in world units', () => {
    const station = worlds[0]!.landmarks.find((l) => l.id === 'station')!;
    // A 2×2 pad, and the mast's light at the top, 17 quarter voxels up.
    expect(landmarkExtent(station)).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 4.25, z: 2 } });
  });
});

describe('the Mailbox', () => {
  it('measures one cell across and 2 units tall: a box on a post, its flag raised above it', () => {
    for (const world of worlds) {
      const mailbox = world.landmarks.find((l) => l.id === 'mailbox')!;
      expect(landmarkExtent(mailbox), world.seed).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } });
    }
  });

  it('raises a red flag on the side the camera sees (+x), up to its top', () => {
    const world = worlds[0]!;
    const mailbox = world.landmarks.find((l) => l.id === 'mailbox')!;
    const grid = new VoxelGrid(1 / GROUND_DETAIL);
    const colours = worldColours(world);
    buildLandmark(mailbox, grid, colours);
    const red = colours.fixed('flagRed');
    const flag = [...grid.voxels()].filter((v) => v.colour === red);
    expect(flag.length).toBeGreaterThan(0);
    const { x, y } = { x: mailbox.footprint.origin.x * GROUND_DETAIL, y: mailbox.y * GROUND_DETAIL };
    for (const v of flag) expect(v.x - x).toBe(GROUND_DETAIL - 1);
    expect(Math.max(...flag.map((v) => v.y - y))).toBe(2 * GROUND_DETAIL - 1);
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
      const own = voxels.filter((v) => Math.floor(v.x / GROUND_DETAIL) === t.x && Math.floor(v.z / GROUND_DETAIL) === t.z);
      for (const v of own) expect(v.y + 1).toBeLessThanOrEqual(garden.y * GROUND_DETAIL + max.y * GROUND_DETAIL);
    }
  });
});
