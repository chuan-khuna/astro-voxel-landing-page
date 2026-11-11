import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { structureVoxels } from '@/structures/parse';
import { countVoxels, VOXEL_KINDS } from './voxelCounts';
import { plantStructure } from './gardenPlants';
import { worldToVoxels } from './worldVoxels';

const counts = { projects: 6, pinned: 2, clients: 5, partners: 3 };
const world = generateWorld('harbour', counts);
const tally = countVoxels(world);

const voxelsIn = (s: Parameters<typeof structureVoxels>[0]) => [...structureVoxels(s)].length;

describe('countVoxels', () => {
  it('counts every terrain voxel: one per unit of height in each land column', () => {
    const { heights, isle } = world.terrain;
    const land = heights.reduce((sum, h, i) => sum + (isle[i] === -1 ? 0 : h), 0);
    expect(tally.terrain).toBe(land);
  });

  it('counts each Garden plant: two flowers for the Pinned Projects, three trees for the rest', () => {
    const biome = world.biome.id;
    const flowers = voxelsIn(plantStructure(biome, 'flower', 0)) + voxelsIn(plantStructure(biome, 'flower', 1));
    expect(tally.plants).toBe(flowers + 3 * voxelsIn(plantStructure(biome, 'tree', 0)));
  });

  it('counts every kind present in this World', () => {
    for (const kind of ['terrain', 'landmarks', 'plants', 'houseRoom', 'boats', 'ships', 'buoys', 'bridges', 'stairs'] as const) {
      if (kind === 'bridges' && world.bridges.length === 0) continue;
      if (kind === 'stairs' && world.stairs.length === 0) continue;
      expect(tally[kind], kind).toBeGreaterThan(0);
    }
  });

  it('counts each ship once per Partner, all alike', () => {
    expect(world.ships.length).toBe(counts.partners);
    expect(tally.ships % counts.partners).toBe(0);
    const twoShips = countVoxels(generateWorld('harbour', { ...counts, partners: 2 }));
    expect(twoShips.ships).toBe((tally.ships / 3) * 2);
  });

  it('counts nothing for kinds the content leaves out', () => {
    const bare = countVoxels(generateWorld('harbour', { projects: 0, clients: 0, partners: 0 }));
    expect(bare.plants).toBe(0);
    expect(bare.boats).toBe(0);
    expect(bare.ships).toBe(0);
    expect(bare.landmarks).toBeGreaterThan(0);
  });

  it('adds up to the voxels that are meshed, so no voxel counts twice', () => {
    const voxels = worldToVoxels(world);
    // The ships, the Garden's plants and the House's lid are meshes of their own, outside the grids (the House Interior is a scene of its own).
    expect(tally.inGrids).toBe(voxels.terrain.count + voxels.detail.count + voxels.structure.count);
    expect(tally.total).toBe(VOXEL_KINDS.reduce((sum, kind) => sum + tally[kind], 0));
    expect(tally.total).toBeGreaterThan(tally.inGrids + tally.ships + tally.plants);
  });

  it('changes with the Seed', () => {
    const other = countVoxels(generateWorld('lighthouse', counts));
    expect(other.terrain).not.toBe(tally.terrain);
    expect(other.total).not.toBe(tally.total);
  });
});
