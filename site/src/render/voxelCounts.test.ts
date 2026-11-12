import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { structureVoxels } from '@/structures/parse';
import { countVoxels, VOXEL_KINDS } from './voxelCounts';
import { plantStructure } from './gardenPlants';
import { vesselStructure } from './vesselModels';
import { decorationStructure } from './decorationModels';
import { worldToVoxels } from './worldVoxels';
import { furnishedRoom } from './interiorModel';

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
    for (const kind of ['terrain', 'landmarks', 'plants', 'decoration', 'houseRoom', 'boats', 'ships', 'buoys', 'bridges', 'stairs'] as const) {
      if (kind === 'bridges' && world.bridges.length === 0) continue;
      if (kind === 'stairs' && world.stairs.length === 0) continue;
      expect(tally[kind], kind).toBeGreaterThan(0);
    }
  });

  it('counts each boat and each ship as the structure of its kind', () => {
    const biome = world.biome.id;
    expect(world.ships.length).toBe(counts.partners);
    expect(tally.boats).toBe(world.boats.reduce((sum, b) => sum + voxelsIn(vesselStructure('boat', biome, b.kind)), 0));
    expect(tally.ships).toBe(world.ships.reduce((sum, s) => sum + voxelsIn(vesselStructure('ship', biome, s.kind)), 0));
  });

  it('counts every piece of Decoration as the structure of its kind', () => {
    expect(world.decoration.length).toBeGreaterThan(0);
    expect(tally.decoration).toBe(world.decoration.reduce((sum, d) => sum + voxelsIn(decorationStructure(world.biome.id, d.kind)), 0));
  });

  it('counts the House room as the World shows it: the Biome’s furnished room at 1/16 unit, the developer seated in it', () => {
    expect(tally.houseRoom).toBe(voxelsIn(furnishedRoom(world.biome.id)));
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
    // The boats, the ships, the Garden's plants and the House's lid and room are meshes of their own, outside the grids.
    expect(tally.inGrids).toBe(voxels.terrain.count + voxels.detail.count + voxels.structure.count);
    expect(tally.total).toBe(VOXEL_KINDS.reduce((sum, kind) => sum + tally[kind], 0));
    expect(tally.total).toBeGreaterThan(tally.inGrids + tally.boats + tally.ships + tally.plants + tally.houseRoom);
  });

  it('changes with the Seed', () => {
    const other = countVoxels(generateWorld('lighthouse', counts));
    expect(other.terrain).not.toBe(tally.terrain);
    expect(other.total).not.toBe(tally.total);
  });
});
