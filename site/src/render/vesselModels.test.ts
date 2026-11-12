import { describe, expect, it } from 'vitest';
import { BIOME_IDS, BOAT_KINDS, SHIP_KINDS, generateWorld, type Facing } from '@/world';
import { structureVoxels, type Structure } from '@/structures/parse';
import { instanceMatrix, type InstancePlacement } from './structureMeshes';
import { boatPlacement, boatsOf, shipPlacement, vesselStructure } from './vesselModels';

/** Where a structure voxel's middle lands in the World under a placement (pivot: footprint middle on the ground). */
const placed = (s: Structure, placement: InstancePlacement) => {
  const pivot = { x: s.size.x / s.scale / 2, y: 0, z: s.size.z / s.scale / 2 };
  const m = instanceMatrix(placement, pivot);
  return (v: { x: number; y: number; z: number }) => {
    const [x, y, z] = [(v.x + 0.5) / s.scale, (v.y + 0.5) / s.scale, (v.z + 0.5) / s.scale];
    return { x: m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, y: m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, z: m[2]! * x + m[6]! * y + m[10]! * z + m[14]! };
  };
};
/** The middle of the voxels in a structure's frontmost (bow) row and of all its voxels, placed. */
const bowAndMiddle = (s: Structure, placement: InstancePlacement) => {
  const all = [...structureVoxels(s)];
  const bowZ = Math.max(...all.map((v) => v.z));
  const at = placed(s, placement);
  const mean = (vs: typeof all) => {
    const ps = vs.map(at);
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, z: ps.reduce((a, p) => a + p.z, 0) / ps.length };
  };
  return { bow: mean(all.filter((v) => v.z === bowZ)), middle: mean(all) };
};

describe('vessel models', () => {
  it('takes each boat and ship from its kind in the World’s Biome', () => {
    for (const biome of BIOME_IDS) {
      for (let kind = 1; kind <= BOAT_KINDS; kind++) expect(vesselStructure('boat', biome, kind)).toMatchObject({ kind: 'boat', biome, variant: kind });
      for (let kind = 1; kind <= SHIP_KINDS; kind++) expect(vesselStructure('ship', biome, kind)).toMatchObject({ kind: 'ship', biome, variant: kind });
    }
  });

  it('moors each boat in its berth, its bow pointing along its facing and out of its cell nowhere', () => {
    const towards: Record<Facing, [number, number]> = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
    for (const facing of ['east', 'west', 'south', 'north'] as const) {
      const boat = { cell: { x: 5, z: 9 }, facing, kind: 1 };
      for (const biome of BIOME_IDS) {
        const s = vesselStructure('boat', biome, 2);
        const placement = boatPlacement(boat);
        const { bow, middle } = bowAndMiddle(s, placement);
        const [dx, dz] = towards[facing];
        expect((bow.x - middle.x) * dx + (bow.z - middle.z) * dz, `${biome} ${facing}`).toBeGreaterThan(0.2);
        for (const v of [...structureVoxels(s)].map(placed(s, placement))) {
          expect(Math.floor(v.x)).toBe(5);
          expect(Math.floor(v.z)).toBe(9);
        }
      }
    }
  });

  it('gives every boat in a World its Client’s kind', () => {
    const world = generateWorld('harbour', { projects: 4, clients: 6, partners: 3 });
    const boats = boatsOf(world);
    expect(boats.map((b) => b.structure.variant)).toEqual(world.boats.map((b) => b.kind));
    expect(boats.every((b) => b.structure.biome === world.biome.id)).toBe(true);
  });

  it('sails a ship bow first along its heading, its middle on the path', () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7, 2.5]) {
      const s = vesselStructure('ship', 'northern', 1);
      const placement = shipPlacement({ x: 10, z: 4, heading });
      const { bow, middle } = bowAndMiddle(s, placement);
      const along = (bow.x - middle.x) * Math.cos(heading) + (bow.z - middle.z) * Math.sin(heading);
      const across = -(bow.x - middle.x) * Math.sin(heading) + (bow.z - middle.z) * Math.cos(heading);
      expect(along, `${heading}`).toBeGreaterThan(0.8);
      expect(Math.abs(across), `${heading}`).toBeLessThan(0.2);
      expect(placement).toMatchObject({ x: 10, y: 0, z: 4 });
    }
  });
});
