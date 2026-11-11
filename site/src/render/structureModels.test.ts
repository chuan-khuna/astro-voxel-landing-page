import { describe, expect, it } from 'vitest';
import { generateWorld, houseYard, type World } from '@/world';
import { structureVoxels } from '@/structures/parse';
import { housePlacement, houseStructure, houseWindowFaces, turned } from './structureModels';
import { worldToVoxels } from './worldVoxels';
import { STRUCTURE } from './voxelTiers';

const counts = { projects: 6, clients: 3, partners: 2 };
const worlds = Array.from({ length: 40 }, (_, i) => generateWorld(`house-${i}`, counts));
const houseOf = (world: World) => world.landmarks.find((l) => l.id === 'house')!;

describe('the House in the World', () => {
  it('draws its Biome\'s House Variant', () => {
    for (const world of worlds) {
      const s = houseStructure(world);
      expect(s.kind).toBe('house');
      expect(s.biome).toBe(world.biome.id);
    }
  });

  it('meshes its base in the World\'s ⅛-unit structure grid, inside the House\'s 3×3 and on its ground', () => {
    for (const world of worlds) {
      const { structure } = worldToVoxels(world);
      const house = houseOf(world);
      const base = [...structureVoxels(houseStructure(world))].filter((v) => v.part === 'base');
      expect(structure.size).toBe(1 / STRUCTURE);
      expect(structure.count, world.seed).toBe(base.length);
      const { origin } = houseYard(house).house;
      for (const v of structure.voxels()) {
        expect(Math.floor(v.x / STRUCTURE) - origin.x, world.seed).toBeGreaterThanOrEqual(0);
        expect(Math.floor(v.x / STRUCTURE) - origin.x, world.seed).toBeLessThan(3);
        expect(Math.floor(v.z / STRUCTURE) - origin.z, world.seed).toBeGreaterThanOrEqual(0);
        expect(Math.floor(v.z / STRUCTURE) - origin.z, world.seed).toBeLessThan(3);
        expect(v.y, world.seed).toBeGreaterThanOrEqual(house.y * STRUCTURE);
      }
    }
  });

  it('turns the door to face the House\'s way, onto the yard cell in front of it', () => {
    const seen = new Set<string>();
    for (const world of worlds) {
      const house = houseOf(world);
      seen.add(house.door!);
      const s = houseStructure(world);
      const at = housePlacement(house);
      // The door: a 4×10 opening in the middle of the front wall's outer layer, as drawn (+z).
      const door = [...structureVoxels(s)].filter((v) => v.x >= 10 && v.x < 14 && v.y >= 2 && v.y < 12 && v.z === s.size.z - 3);
      expect(door.length, world.seed).toBe(40);
      const yard = houseYard(house).door;
      const inside = house.door === 'south' ? { x: yard.x, z: yard.z - 1 } : { x: yard.x - 1, z: yard.z };
      for (const v of door) {
        const p = turned(s, v, at.facing);
        expect({ x: Math.floor((at.x + p.x) / STRUCTURE), z: Math.floor((at.z + p.z) / STRUCTURE) }, world.seed).toEqual(inside);
      }
    }
    expect([...seen].toSorted()).toEqual(['east', 'south']);
  });

  it('lights each window on an open face towards +x or +z: out of the front walls, into the room from the back walls', () => {
    for (const world of worlds.slice(0, 8)) {
      const faces = houseWindowFaces(world);
      expect(faces.some((f) => f.part === 'lid'), world.seed).toBe(true);
      expect(faces.some((f) => f.part === 'base'), world.seed).toBe(true);
      const filled = new Set<string>();
      const { structure } = worldToVoxels(world);
      for (const v of structure.voxels()) filled.add(`${v.x},${v.y},${v.z}`);
      for (const f of faces) {
        const front = f.facing === '+x' ? `${f.x + 1},${f.y},${f.z}` : `${f.x},${f.y},${f.z + 1}`;
        expect(filled.has(front), `${world.seed} ${front}`).toBe(false);
      }
    }
  });
});
