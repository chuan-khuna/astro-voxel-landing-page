import { describe, expect, it } from 'vitest';
import { BIOME_IDS, generateWorld } from '@/world';
import { variantsOf } from '@/structures';
import { structureVoxels, voxelAt } from '@/structures/parse';
import { coarsen, developerBox, furnishedRoom, interiorPlacement, roomLight, screenFace, showsInterior } from './interiorModel';
import { houseStructure, housePlacement } from './structureModels';
import { INTERIOR, STRUCTURE } from './voxelTiers';
import { worldToVoxels } from './worldVoxels';

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

describe('coarsen', () => {
  it('halves a room to ⅛ unit: half the size, every coarse voxel from the fine voxels under it', () => {
    for (const biome of BIOME_IDS) {
      const room = furnishedRoom(biome);
      const coarse = coarsen(room, 2);
      expect(coarse.scale).toBe(STRUCTURE);
      expect(coarse.size).toEqual({ x: Math.ceil(room.size.x / 2), y: Math.ceil(room.size.y / 2), z: Math.ceil(room.size.z / 2) });
      const fine = [...structureVoxels(room)];
      const voxels = [...structureVoxels(coarse)];
      // Fewer voxels, but most of the room's volume still there.
      expect(voxels.length).toBeLessThan(fine.length / 4);
      expect(voxels.length * 8).toBeGreaterThan(fine.length * 0.6);
      for (const v of voxels) {
        const roles = new Set<string>();
        for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
          const f = voxelAt(room, v.x * 2 + dx, v.y * 2 + dy, v.z * 2 + dz);
          if (f) roles.add(f.role);
        }
        expect(roles.has(v.role), `${biome} ${v.x},${v.y},${v.z}`).toBe(true);
        expect(v.part).toBe('base');
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

describe('the room in the World’s structure grid', () => {
  it('is the furnished room at ⅛ unit, in the House’s interior box, so it shows as the lid lifts', () => {
    for (const world of worlds.slice(0, 8)) {
      const { structure } = worldToVoxels(world);
      const k = INTERIOR / STRUCTURE;
      const coarse = coarsen(furnishedRoom(world.biome.id), k);
      const at = interiorPlacement(world);
      const s = houseStructure(world);
      const box = s.interior!;
      expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(coarse.size.x);
      for (const v of structureVoxels(coarse)) {
        expect(structure.has(at.x / k + v.x, at.y / k + v.y, at.z / k + v.z), `${world.seed} ${v.x},${v.y},${v.z}`).toBe(true);
      }
    }
  });
});

describe('showsInterior', () => {
  const settled = { open: true, opening: 1, flying: false, zoom: 4, interiorZoom: 4, room: { x: 0.2, y: -0.1 } };

  it('takes over once the House is open and the camera has come to rest on it', () => {
    expect(showsInterior(settled)).toBe(true);
    // The Tour stops a little further out, so the Guide stays in view beside the House.
    expect(showsInterior({ ...settled, zoom: 4 * 0.56 })).toBe(true);
  });

  it('waits for the lid to lift and the camera to land', () => {
    expect(showsInterior({ ...settled, opening: 0.7 })).toBe(false);
    expect(showsInterior({ ...settled, flying: true })).toBe(false);
  });

  it('hands back to the World when the House shuts, the visitor zooms out or pans the room off screen', () => {
    expect(showsInterior({ ...settled, open: false })).toBe(false);
    expect(showsInterior({ ...settled, zoom: 1.5 })).toBe(false);
    expect(showsInterior({ ...settled, room: { x: 1.2, y: 0 } })).toBe(false);
  });
});
