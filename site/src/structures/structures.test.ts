import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIOME_IDS } from '@/world';
import { HOUSE_INTERIOR } from '@/render/houseModel';
import { GROUND_DETAIL, STRUCTURE } from '@/render/voxelTiers';
import { STRUCTURES, STRUCTURE_FILES, variantsOf } from './index';
import { parseStructure, structureVoxels, voxelAt, type Structure } from './parse';
import { STRUCTURE_ROLES } from './roles';

const root = fileURLToPath(new URL('.', import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.structure') ? [join(dir, e.name)] : [],
  );
const onDisk = files(root);

describe('structure files', () => {
  it('each parses, and the build-time module holds the same voxels', () => {
    expect(onDisk.length).toBeGreaterThan(0);
    for (const file of onDisk) {
      const parsed = parseStructure(readFileSync(file, 'utf8'), file);
      const built = STRUCTURE_FILES[`./${relative(root, file).split(sep).join('/')}`];
      expect(built, file).toBeDefined();
      expect(built!.voxels, file).toEqual(parsed.voxels);
      expect(built!.palette, file).toEqual(parsed.palette);
      expect(built!.size, file).toEqual(parsed.size);
    }
  });

  it('each uses only known colour roles', () => {
    for (const s of STRUCTURES) for (const { role } of s.palette) expect(Object.keys(STRUCTURE_ROLES), s.name).toContain(role);
  });

  it('each fills its declared footprint: every cell has voxels, and nothing lies outside it', () => {
    for (const s of STRUCTURES) {
      expect(s.size.x, s.name).toBe(s.footprint.width * STRUCTURE);
      expect(s.size.z, s.name).toBe(s.footprint.depth * STRUCTURE);
      const reached = new Set<string>();
      for (const v of structureVoxels(s)) reached.add(`${Math.floor(v.x / STRUCTURE)},${Math.floor(v.z / STRUCTURE)}`);
      for (let z = 0; z < s.footprint.depth; z++) for (let x = 0; x < s.footprint.width; x++) expect(reached.has(`${x},${z}`), `${s.name} ${x},${z}`).toBe(true);
    }
  });
});

describe('the House Variants', () => {
  const houses = STRUCTURES.filter((s) => s.kind === 'house');
  const inBox = (box: NonNullable<Structure['interior']>, v: { x: number; y: number; z: number }) =>
    v.x >= box.min.x && v.x < box.max.x && v.y >= box.min.y && v.y < box.max.y && v.z >= box.min.z && v.z < box.max.z;

  it('gives every Biome at least one House Variant, numbered from 1', () => {
    for (const biome of BIOME_IDS) {
      const variants = variantsOf('house', biome);
      expect(variants.length, biome).toBeGreaterThan(0);
      expect(variants.map((v) => v.variant), biome).toEqual(variants.map((_, i) => i + 1));
    }
  });

  it('is 3×3 cells (24×24 ⅛ voxels) and 3.5–4 units tall, its door on the +z face', () => {
    for (const s of houses) {
      expect(s.footprint, s.name).toEqual({ width: 3, depth: 3 });
      expect(s.size.y, s.name).toBeGreaterThanOrEqual(28);
      expect(s.size.y, s.name).toBeLessThanOrEqual(32);
      expect(s.door, s.name).toBe('+z');
      expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
      const doors = [...structureVoxels(s)].filter((v) => v.role === 'door' || v.role === 'doorWood' || (v.role === 'accent' && v.y < 12 && v.z === s.size.z - 3 && v.x >= 10 && v.x < 14));
      // The door: a 4×10 opening in the front wall's outer face.
      const face = doors.filter((v) => v.z === s.size.z - 3);
      expect(face.length, s.name).toBeGreaterThanOrEqual(4 * 10 - 1);
    }
  });

  it('shares one interior space per Biome, which holds the House room', () => {
    for (const biome of BIOME_IDS) {
      const interiors = variantsOf('house', biome).map((s) => s.interior);
      for (const box of interiors) expect(box, biome).toEqual(interiors[0]);
    }
    // The room (¼ voxels, `HOUSE_INTERIOR`) fits inside each interior, in ⅛ voxels.
    const scale = STRUCTURE / GROUND_DETAIL;
    for (const s of houses) {
      const box = s.interior!;
      expect(box, s.name).not.toBeNull();
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(HOUSE_INTERIOR.min[axis] * scale, `${s.name} ${axis}`).toBeGreaterThanOrEqual(box.min[axis]);
        expect(HOUSE_INTERIOR.max[axis] * scale, `${s.name} ${axis}`).toBeLessThanOrEqual(box.max[axis]);
      }
    }
  });

  it('keeps the interior empty, closes it from above with the lid, and opens it to the camera with the lid off', () => {
    for (const s of houses) {
      const box = s.interior!;
      const voxels = [...structureVoxels(s)];
      for (const v of voxels) expect(inBox(box, v), `${s.name} ${v.x},${v.y},${v.z}`).toBe(false);
      for (let x = box.min.x; x < box.max.x; x++) {
        for (let z = box.min.z; z < box.max.z; z++) {
          let covered = false;
          for (let y = box.max.y; y < s.size.y && !covered; y++) covered = voxelAt(s, x, y, z)?.part === 'lid';
          expect(covered, `${s.name} column ${x},${z}`).toBe(true);
        }
      }
      // Above the floor, the base holds only the two back walls (low x and low z).
      for (const v of voxels) {
        if (v.part !== 'base' || v.y < box.min.y) continue;
        expect(v.x < box.max.x && v.z < box.max.z, `${s.name} ${v.x},${v.y},${v.z}`).toBe(true);
      }
      expect(voxels.some((v) => v.part === 'lid'), s.name).toBe(true);
    }
  });

  it('has windows and a roof: glass in the walls, and every voxel above the walls in the lid', () => {
    for (const s of houses) {
      const voxels = [...structureVoxels(s)];
      expect(voxels.filter((v) => v.role === 'window').length, s.name).toBeGreaterThan(20);
      for (const v of voxels) if (v.y >= s.interior!.max.y) expect(v.part, `${s.name} ${v.x},${v.y},${v.z}`).toBe('lid');
    }
  });
});
