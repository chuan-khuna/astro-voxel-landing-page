import { describe, expect, it } from 'vitest';
import { LANDMARK_HEIGHT, generateWorld, type PlacedLandmark } from '@/world';
import { VoxelGrid } from './mesher';
import { buildLandmark, landmarkExtent } from './landmarkModels';
import { worldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

const counts = { projects: 6, pinned: 2, clients: 0, partners: 0 };
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
  it('draw only the Dock’s deck and jetty at ¼ unit: the rest are structures', () => {
    for (const world of worlds) {
      for (const l of world.landmarks.filter((l) => l.id !== 'dock')) expect(voxelsOf(l, world), `${world.seed} ${l.id}`).toHaveLength(0);
      for (const l of world.landmarks.filter((l) => l.id === 'dock')) {
        const voxels = voxelsOf(l, world);
        const reached = new Set(voxels.map((v) => `${Math.floor(v.x / GROUND_DETAIL)},${Math.floor(v.z / GROUND_DETAIL)}`));
        for (const c of [...l.footprint.cells, ...l.jetty]) expect(reached.has(`${c.x},${c.z}`), `${world.seed} ${l.id} ${c.x},${c.z}`).toBe(true);
        // ...and nothing outside it.
        const inside = new Set([...l.footprint.cells, ...l.jetty].map((c) => `${c.x},${c.z}`));
        for (const key of reached) expect(inside.has(key), `${world.seed} ${l.id} ${key}`).toBe(true);
      }
    }
  });
});

describe('landmarkExtent', () => {
  it('covers the whole footprint (and the jetty) on the ground, and the model\'s height', () => {
    for (const world of worlds) {
      for (const l of world.landmarks.filter((l) => l.id !== 'house')) {
        const { min, max } = landmarkExtent(world, l);
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
      const house = landmarkExtent(world, world.landmarks.find((l) => l.id === 'house')!);
      expect(house.min, world.seed).toEqual({ x: 0, y: 0, z: 0 });
      expect([house.max.x, house.max.z], world.seed).toEqual([3, 3]);
      expect(house.max.y, world.seed).toBeGreaterThanOrEqual(3.5);
      expect(house.max.y, world.seed).toBeLessThanOrEqual(4);
    }
  });

  it('never stands taller than the generator keeps clear for it (`LANDMARK_HEIGHT`)', () => {
    // Placement keeps every Landmark in view past the others' models at these heights.
    for (const world of worlds) {
      for (const l of world.landmarks) expect(landmarkExtent(world, l).max.y, `${world.seed} ${l.id}`).toBeLessThanOrEqual(LANDMARK_HEIGHT[l.id]);
    }
  });

  it('measures the Station\'s Variant: its 2×2, 5–6 units tall', () => {
    for (const world of worlds) {
      const { min, max } = landmarkExtent(world, world.landmarks.find((l) => l.id === 'station')!);
      expect(min, world.seed).toEqual({ x: 0, y: 0, z: 0 });
      expect([max.x, max.z], world.seed).toEqual([2, 2]);
      expect(max.y, world.seed).toBeGreaterThanOrEqual(5);
      expect(max.y, world.seed).toBeLessThanOrEqual(6);
    }
  });

  it('measures the Mailbox in its cell, 1–1.25 units tall, and the Dock\'s things at most 1 unit over its deck', () => {
    for (const world of worlds) {
      const mailbox = landmarkExtent(world, world.landmarks.find((l) => l.id === 'mailbox')!);
      expect(mailbox.min, world.seed).toEqual({ x: 0, y: 0, z: 0 });
      expect([mailbox.max.x, mailbox.max.z], world.seed).toEqual([1, 1]);
      expect(mailbox.max.y, world.seed).toBeGreaterThanOrEqual(1);
      expect(mailbox.max.y, world.seed).toBeLessThanOrEqual(1.25);
      const dock = landmarkExtent(world, world.landmarks.find((l) => l.id === 'dock')!);
      expect(dock.max.y, world.seed).toBeGreaterThan(0.25);
      expect(dock.max.y, world.seed).toBeLessThanOrEqual(1);
    }
  });
});

describe('the Garden’s extent', () => {
  it('covers its fence and its plants: as tall as its trees, or about 1 unit with none', () => {
    for (const seed of ['lighthouse', 'harbour']) {
      const extent = (projects: number, pinned: number) => {
        const world = generateWorld(seed, { ...counts, projects, pinned });
        return landmarkExtent(world, world.landmarks.find((l) => l.id === 'garden')!);
      };
      const bare = extent(0, 0);
      expect(bare.min, seed).toEqual({ x: 0, y: 0, z: 0 });
      expect([bare.max.x, bare.max.z], seed).toEqual([5, 5]);
      expect(bare.max.y, seed).toBeLessThanOrEqual(1);
      expect(extent(2, 2).max.y, seed).toBeLessThanOrEqual(1.75);
      expect(extent(6, 2).max.y, seed).toBeGreaterThanOrEqual(3);
    }
  });
});
