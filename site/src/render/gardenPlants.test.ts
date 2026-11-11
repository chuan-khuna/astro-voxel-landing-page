import { describe, expect, it } from 'vitest';
import { BIOME_IDS, LANDMARK_HEIGHT, generateWorld } from '@/world';
import { variantsOf } from '@/structures';
import { structureVoxels } from '@/structures/parse';
import { gardenPlantsOf, plantExtent, plantStructure, plantedGarden } from './gardenPlants';

const worlds = ['lighthouse', 'harbour', '42', '7'].map((seed) => generateWorld(seed, { projects: 9, pinned: 4, clients: 0, partners: 0 }));

describe('gardenPlantsOf', () => {
  it('gives each flower and tree cell the Biome\'s plant: the flowers first, then the trees', () => {
    for (const world of worlds) {
      const garden = world.landmarks.find((l) => l.id === 'garden')!;
      const plants = gardenPlantsOf(world);
      expect(plants.map((p) => p.kind)).toEqual(['flower', 'flower', 'flower', 'flower', 'tree', 'tree', 'tree']);
      expect(plants.map((p) => p.cell)).toEqual([...garden.flowers, ...garden.trees]);
      for (const p of plants) {
        expect(p.structure.kind, world.seed).toBe(p.kind);
        expect(p.structure.biome, world.seed).toBe(world.biome.id);
      }
    }
  });

  it('alternates the Biome\'s flowers, so neighbours differ', () => {
    for (const biome of BIOME_IDS) {
      expect(plantStructure(biome, 'flower', 0)).not.toBe(plantStructure(biome, 'flower', 1));
      expect(plantStructure(biome, 'flower', 0)).toBe(plantStructure(biome, 'flower', 2));
    }
  });
});

describe('plantExtent', () => {
  it('is the box of one plant: its cell, from the ground to its top, within the Garden\'s height', () => {
    for (const world of worlds) {
      const garden = world.landmarks.find((l) => l.id === 'garden')!;
      const { origin } = garden.footprint;
      for (const p of gardenPlantsOf(world)) {
        const { min, max } = plantExtent(garden, p);
        expect(min).toEqual({ x: p.cell.x - origin.x, y: 0, z: p.cell.z - origin.z });
        expect([max.x, max.z]).toEqual([min.x + 1, min.z + 1]);
        const top = Math.max(...[...structureVoxels(p.structure)].map((v) => v.y + 1)) / p.structure.scale;
        expect(max.y).toBe(top);
        expect(max.y).toBeLessThanOrEqual(LANDMARK_HEIGHT.garden);
      }
    }
  });
});

describe('plantedGarden', () => {
  it('plants a Biome\'s fence full for the Model Gallery: every voxel of the fence and of its nine plants', () => {
    for (const biome of BIOME_IDS) {
      const garden = plantedGarden(biome);
      expect(garden.footprint).toEqual({ width: 5, depth: 5 });
      const count = (s: Parameters<typeof structureVoxels>[0]) => [...structureVoxels(s)].length;
      const flowers = [0, 1, 2, 3, 4, 5].reduce((sum, i) => sum + count(plantStructure(biome, 'flower', i)), 0);
      const trees = 3 * count(plantStructure(biome, 'tree', 0));
      expect(count(garden), biome).toBe(count(variantsOf('garden', biome)[0]!) + flowers + trees);
      expect(garden.size.y, biome).toBe(plantStructure(biome, 'tree', 0).size.y);
    }
  });
});
