import { describe, expect, it } from 'vitest';
import { BIOME_IDS, generateWorld } from '@/world';
import { variantsOf } from '@/structures';
import { structureVoxels, voxelAt } from '@/structures/parse';
import { developerBounds, developerBox, furnishedRoom, interiorPlacement, roomLight, screenFace } from './interiorModel';
import { houseStructure, housePlacement } from './structureModels';
import { INTERIOR, STRUCTURE } from './voxelTiers';

const counts = { projects: 8, clients: 6, partners: 4 };
const worlds = Array.from({ length: 30 }, (_, i) => generateWorld(`interior-${i}`, counts));

describe('the furnished room', () => {
  it('is the Biome’s room with the developer seated in it, their moving parts kept apart', () => {
    for (const biome of BIOME_IDS) {
      const room = furnishedRoom(biome);
      const [plain] = variantsOf('room', biome);
      expect(room.scale).toBe(INTERIOR);
      expect(room.size).toEqual(plain!.size);
      const voxels = [...structureVoxels(room)];
      const plainCount = [...structureVoxels(plain!)].length;
      expect(voxels.length).toBeGreaterThan(plainCount);
      for (const part of ['head', 'leftHand', 'rightHand'] as const) expect(voxels.some((v) => v.part === part), `${biome} ${part}`).toBe(true);
      // Furniture keeps its own colours.
      for (const v of structureVoxels(plain!)) expect(voxelAt(room, v.x, v.y, v.z)?.role).toBe(v.role);
    }
  });

  it('gives the developer a box round every voxel of them', () => {
    for (const biome of BIOME_IDS) {
      const room = furnishedRoom(biome);
      const { min, max } = developerBox(room);
      const plain = variantsOf('room', biome)[0]!;
      const developer = [...structureVoxels(room)].filter((v) => voxelAt(plain, v.x, v.y, v.z) === null);
      expect(developer.length).toBeGreaterThan(100);
      for (const v of developer) {
        for (const axis of ['x', 'y', 'z'] as const) {
          expect(v[axis]).toBeGreaterThanOrEqual(min[axis]);
          expect(v[axis]).toBeLessThan(max[axis]);
        }
      }
      // A seated figure: about 20 voxels tall (1.25 units).
      expect(max.y - min.y).toBeGreaterThanOrEqual(18);
      expect(max.y - min.y).toBeLessThanOrEqual(22);
    }
  });

  it('finds the screen: the +x face of the computer’s screen voxels, with nothing in front', () => {
    for (const biome of BIOME_IDS) {
      const room = furnishedRoom(biome);
      const face = screenFace(room);
      expect(face.y1 - face.y0).toBeGreaterThanOrEqual(5);
      expect(face.z1 - face.z0).toBeGreaterThanOrEqual(6);
      for (let y = face.y0; y < face.y1; y++) {
        for (let z = face.z0; z < face.z1; z++) {
          expect(voxelAt(room, face.x - 1, y, z)?.role, `${biome} ${y},${z}`).toBe('screen');
          expect(voxelAt(room, face.x, y, z), `${biome} ${y},${z} in front`).toBeNull();
        }
      }
    }
  });

  it('lights each room from its lamp or fire', () => {
    for (const biome of BIOME_IDS) {
      const room = furnishedRoom(biome);
      const at = roomLight(room);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(at[axis]).toBeGreaterThan(0);
        expect(at[axis]).toBeLessThan(room.size[axis]);
      }
    }
  });
});

describe('the room in the World', () => {
  it('stands in the House Variant’s interior space, whichever way the door faces', () => {
    const seen = new Set<string>();
    for (const world of worlds) {
      const house = world.landmarks.find((l) => l.id === 'house')!;
      seen.add(house.door!);
      const s = houseStructure(world);
      const at = housePlacement(house);
      const place = interiorPlacement(world);
      const { min } = s.interior!;
      // The interior box is square in plan, so the east mirror leaves its min corner in place.
      const k = INTERIOR / STRUCTURE;
      expect(place, world.seed).toEqual({ x: (at.x + min.x) * k, y: (at.y + min.y) * k, z: (at.z + min.z) * k });
    }
    expect(seen).toEqual(new Set(['south', 'east']));
  });
});

describe('the developer in the World', () => {
  it('sits inside the House’s 3×3, above its floor, the box a little over a unit tall', () => {
    for (const world of worlds) {
      const house = world.landmarks.find((l) => l.id === 'house')!;
      const { min, max } = developerBounds(world);
      const { origin } = house.footprint;
      expect(min.x, world.seed).toBeGreaterThanOrEqual(origin.x);
      expect(min.z, world.seed).toBeGreaterThanOrEqual(origin.z);
      expect(max.x, world.seed).toBeLessThanOrEqual(origin.x + 3);
      expect(max.z, world.seed).toBeLessThanOrEqual(origin.z + 3);
      expect(min.y, world.seed).toBeGreaterThan(house.y);
      // A seated figure about 20 voxels of 1/16 unit tall.
      expect(max.y - min.y).toBeCloseTo(20 / 16, 0);
    }
  });
});
