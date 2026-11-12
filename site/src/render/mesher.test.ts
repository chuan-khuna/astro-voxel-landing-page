/**
 * A few behavioural checks on the mesher. The World generator stays the main
 * test seam; these only pin what the renderer relies on: culling, merging and
 * the triangle budget.
 */
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../world';
import { meshVoxels, triangleCount, VoxelGrid } from './mesher';
import { meshWorld } from './worldVoxels';

const colours = [
  [1, 1, 1],
  [0.5, 0.5, 0.5],
] as const;
const mesh = (grid: VoxelGrid) => meshVoxels(grid, { colours, aoStrength: 0.5, chunkSize: 16 });
const quads = (grid: VoxelGrid) => mesh(grid).reduce((n, m) => n + m.quads, 0);

/** Budget for the whole World (spec: Performance budget). */
const MAX_TRIANGLES = 300_000;

describe('mesher', () => {
  it('culls faces between neighbouring voxels', () => {
    const one = new VoxelGrid(1);
    one.set(0, 0, 0, 0);
    expect(quads(one)).toBe(6);

    // Two voxels of different colours: the shared faces are hidden, nothing merges.
    const two = new VoxelGrid(1);
    two.set(0, 0, 0, 0);
    two.set(1, 0, 0, 1);
    expect(quads(two)).toBe(10);
  });

  it('greedy-merges same-colour coplanar faces into one quad per side', () => {
    const cube = new VoxelGrid(1);
    cube.box(0, 0, 0, 8, 8, 8, 0);
    expect(quads(cube)).toBe(6);
  });

  it('does not merge faces of different colours', () => {
    const slab = new VoxelGrid(1);
    for (let x = 0; x < 4; x++) slab.set(x, 0, 0, x % 2);
    expect(quads(slab)).toBeGreaterThan(6);
  });

  // Forty Worlds take a few seconds: more than Vitest's default 5s when files run in parallel.
  it('keeps every sampled World, including 4-Isle ones, under the triangle budget', () => {
    let fourIsles = 0;
    for (let n = 0; n < 40; n++) {
      const world = generateWorld(`budget-${n}`, { projects: 0, clients: 0, partners: 0 });
      if (world.isles.length === 4) fourIsles++;
      const { terrain, detail } = meshWorld(world);
      expect(triangleCount(terrain) + triangleCount(detail)).toBeLessThanOrEqual(MAX_TRIANGLES);
    }
    expect(fourIsles).toBeGreaterThan(0);
  }, 20_000);
});
