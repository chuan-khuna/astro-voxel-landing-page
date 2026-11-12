import { describe, expect, it } from 'vitest';
import { BIOME_IDS, generateWorld, type World } from '@/world';
import { fallingLeaves, LEAF_SIZE, leavesShown } from './fallingLeaves';
import { gardenPlantsOf } from './gardenPlants';
import { decorationOf } from './decorationModels';
import { FIXED_COLOURS, oklchToLinear, shiftLightness } from './palette';

const counts = { projects: 8, clients: 5, partners: 3 };
const seeds = Array.from({ length: 40 }, (_, i) => `leaves-${i}`);
const worlds = seeds.map((seed) => generateWorld(seed, counts));

/** The cells a leaf may fall from: the Garden's trees, and the small trees and bushes among the Decoration. */
function treeCells(world: World): Array<{ x: number; z: number; ground: number }> {
  const garden = world.landmarks.find((l) => l.id === 'garden');
  const { width, heights } = world.terrain;
  return [
    ...gardenPlantsOf(world)
      .filter((p) => p.kind === 'tree')
      .map((p) => ({ ...p.cell, ground: garden!.y })),
    ...decorationOf(world, 'full')
      .filter(({ piece }) => piece.kind === 'sapling' || piece.kind === 'bush')
      .map(({ piece }) => ({ ...piece.cell, ground: heights[piece.cell.z * width + piece.cell.x]! })),
  ];
}

describe('fallingLeaves', () => {
  it('covers every Biome', () => {
    expect(new Set(worlds.map((w) => w.biome.id))).toEqual(new Set(BIOME_IDS));
  });

  it('is the same for the same World', () => {
    expect(fallingLeaves(generateWorld('harbour', counts), 'full')).toEqual(fallingLeaves(generateWorld('harbour', counts), 'full'));
  });

  it('starts each leaf in a tree’s canopy, above its ground', () => {
    for (const world of worlds) {
      const trees = treeCells(world);
      const leaves = fallingLeaves(world, 'full');
      expect(leaves.length, world.seed).toBeGreaterThan(0);
      for (const leaf of leaves) {
        const tree = trees.find((t) => leaf.start.x > t.x && leaf.start.x < t.x + 1 && leaf.start.z > t.z && leaf.start.z < t.z + 1);
        expect(tree, `${world.seed}: a leaf at ${leaf.start.x} ${leaf.start.z}`).toBeDefined();
        expect(leaf.start.y).toBeGreaterThan(tree!.ground + LEAF_SIZE);
      }
    }
  });

  it('lands each leaf down the wind, lying on land as high as its tree’s ground and off every other Landmark', () => {
    for (const world of worlds) {
      const { width, heights, isle } = world.terrain;
      const { direction } = world.wind;
      for (const leaf of fallingLeaves(world, 'full')) {
        const across = { x: leaf.land.x - leaf.start.x, z: leaf.land.z - leaf.start.z };
        expect(across.x * direction.x + across.z * direction.z).toBeGreaterThanOrEqual(-1e-9);
        // Never sideways to the wind.
        expect(Math.abs(across.x * direction.z - across.z * direction.x)).toBeLessThan(1e-9);
        const cell = { x: Math.floor(leaf.land.x), z: Math.floor(leaf.land.z) };
        const i = cell.z * width + cell.x;
        expect(isle[i], world.seed).not.toBe(-1);
        expect(leaf.land.y).toBeCloseTo(heights[i]! + LEAF_SIZE / 2, 9);
        const on = world.landmarks.filter((l) => l.footprint.cells.some((c) => c.x === cell.x && c.z === cell.z));
        expect(on.every((l) => l.id === 'garden'), world.seed).toBe(true);
      }
    }
  });

  it('colours each leaf from its Biome’s foliage', () => {
    for (const world of worlds) {
      const foliage = [0, 0.05, -0.05].map((dl) => oklchToLinear(shiftLightness(world.biome.colours.foliage, dl)));
      const allowed = [...foliage, oklchToLinear(FIXED_COLOURS.leafGold)].map((c) => c.join());
      for (const leaf of fallingLeaves(world, 'full')) expect(allowed, world.seed).toContain(leaf.colour.join());
    }
  });

  it('falls from fewer trees on the reduced render tier, which draws fewer', () => {
    for (const world of worlds) expect(fallingLeaves(world, 'reduced').length).toBeLessThanOrEqual(fallingLeaves(world, 'full').length);
  });

  it('times each leaf to fall, then lie and fade, within its cycle', () => {
    for (const leaf of fallingLeaves(worlds[0]!, 'full')) {
      expect(leaf.fall).toBeGreaterThan(1);
      expect(leaf.fall).toBeLessThan(leaf.period);
      expect(leaf.offset).toBeGreaterThanOrEqual(0);
      expect(leaf.offset).toBeLessThan(leaf.period);
      expect([-3, -2, -1, 1, 2, 3]).toContain(leaf.spin);
    }
  });
});

describe('leavesShown', () => {
  it('shows every leaf at full, and half (rounded up) at reduced and still', () => {
    expect(leavesShown(40, 'full')).toBe(40);
    expect(leavesShown(41, 'reduced')).toBe(21);
    expect(leavesShown(41, 'still')).toBe(21);
    expect(leavesShown(0, 'reduced')).toBe(0);
  });
});
