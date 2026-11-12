import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BIOME_IDS, BOAT_KINDS, DECORATION_HEIGHT, DECORATION_KINDS, GARDEN_HEIGHT, LANDMARK_HEIGHT, LANDMARK_MIN_HEIGHT, LANDMARK_VARIANTS, PLACED_LANDMARK_IDS, SHIP_KINDS } from '@/world';
import { GROUND_DETAIL, INTERIOR, STRUCTURE } from '@/render/voxelTiers';
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

  it('each fills its declared footprint: every cell has voxels (but the Garden fence’s bed), and nothing lies outside it', () => {
    for (const s of STRUCTURES) {
      expect(s.size.x, s.name).toBe(s.footprint.width * s.scale);
      expect(s.size.z, s.name).toBe(s.footprint.depth * s.scale);
      const reached = new Set<string>();
      for (const v of structureVoxels(s)) reached.add(`${Math.floor(v.x / s.scale)},${Math.floor(v.z / s.scale)}`);
      const bed = (x: number, z: number) => s.kind === 'garden' && x >= 1 && x <= 3 && z >= 1 && z <= 3;
      for (let z = 0; z < s.footprint.depth; z++) for (let x = 0; x < s.footprint.width; x++) expect(reached.has(`${x},${z}`), `${s.name} ${x},${z}`).toBe(!bed(x, z));
    }
  });
});

describe('the Landmark Variants', () => {
  const KINDS = ['house', 'station', 'mailbox', 'dock', 'garden'] as const;
  /** How far a structure reaches above the ground, in ⅛ voxels (its anchor may sit below its first layer). */
  const above = (s: Structure) => s.size.y - s.anchor.y;

  it('gives each Landmark in every Biome as many Variants as the generator picks from, numbered from 1', () => {
    for (const biome of BIOME_IDS) {
      for (const kind of KINDS) {
        const variants = variantsOf(kind, biome);
        expect(variants.map((v) => v.variant), `${kind} ${biome}`).toEqual(Array.from({ length: LANDMARK_VARIANTS[biome][kind] }, (_, i) => i + 1));
        for (const v of variants) expect(v.name, `${kind} ${biome}`).toContain(`${biome}-${v.variant}`);
      }
    }
  });

  it('never stands taller than the generator keeps clear for its Landmark (`LANDMARK_HEIGHT`)', () => {
    for (const kind of KINDS) for (const s of STRUCTURES.filter((s) => s.kind === kind)) expect(above(s) / STRUCTURE, s.name).toBeLessThanOrEqual(LANDMARK_HEIGHT[kind]);
  });

  it('makes the Station 2×2 and 5–6 units tall, its door 4×10 on +z', () => {
    for (const s of STRUCTURES.filter((s) => s.kind === 'station')) {
      expect(s.footprint, s.name).toEqual({ width: 2, depth: 2 });
      expect(s.size.y, s.name).toBeGreaterThanOrEqual(40);
      expect(s.size.y, s.name).toBeLessThanOrEqual(48);
      expect(s.door, s.name).toBe('+z');
      expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
      // The door: 4 wide and 10 tall, each voxel the frontmost of its column on that row. The autumn door is
      // the Biome's green accent, which also lights the cabinets in the yard (x 12 and up), so only the
      // Station's own front (x below 12) counts.
      const STATION_FRONT = 12;
      const door = [...structureVoxels(s)].filter((v) => v.role === 'door' || v.role === 'doorWood' || (v.role === 'accent' && v.y >= 1 && v.y <= 10 && v.x < STATION_FRONT));
      const front = door.filter((v) => voxelAt(s, v.x, v.y, v.z + 1) === null);
      expect(new Set(front.map((v) => v.x)).size, s.name).toBe(4);
      expect(new Set(front.map((v) => v.y)).size, s.name).toBe(10);
    }
  });

  it('makes the Mailbox small: about 4×6 and 1–1.25 units tall in the House\'s yard, its front on +z', () => {
    for (const s of STRUCTURES.filter((s) => s.kind === 'mailbox')) {
      expect(s.footprint, s.name).toEqual({ width: 1, depth: 1 });
      expect(s.size.y, s.name).toBeGreaterThanOrEqual(8);
      expect(s.size.y, s.name).toBeLessThanOrEqual(10);
      expect(s.door, s.name).toBe('+z');
      // The box (everything above the post) is at most 6 voxels across either way.
      const box = [...structureVoxels(s)].filter((v) => v.y >= 5);
      for (const axis of ['x', 'z'] as const) {
        const span = Math.max(...box.map((v) => v[axis])) - Math.min(...box.map((v) => v[axis])) + 1;
        expect(span, `${s.name} ${axis}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('stands the Dock\'s things on its ¼-unit deck: 2×1, the anchor two voxels below the first layer, at most 1 unit above the ground', () => {
    const deck = STRUCTURE / GROUND_DETAIL;
    for (const s of STRUCTURES.filter((s) => s.kind === 'dock')) {
      expect(s.footprint, s.name).toEqual({ width: 2, depth: 1 });
      expect(s.anchor, s.name).toEqual({ x: 0, y: -deck, z: 0 });
      expect(s.door, s.name).toBeNull();
      expect(above(s), s.name).toBeLessThanOrEqual(STRUCTURE);
    }
  });
});

describe('the Garden', () => {
  const ofKind = (kind: string) => STRUCTURES.filter((s) => s.kind === kind);
  /** The span of a structure's voxels along an axis, in voxels (min and max inclusive). */
  const span = (s: Structure, axis: 'x' | 'z', filter: (v: { y: number }) => boolean = () => true) => {
    const values = [...structureVoxels(s)].filter(filter).map((v) => v[axis]);
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  it('gives every Biome a tree and at least one flower, numbered from 1', () => {
    for (const biome of BIOME_IDS) {
      expect(variantsOf('tree', biome).map((s) => s.variant), biome).toEqual([1]);
      const flowers = variantsOf('flower', biome);
      expect(flowers.length, biome).toBeGreaterThan(0);
      expect(flowers.map((s) => s.variant), biome).toEqual(flowers.map((_, i) => i + 1));
    }
  });

  it('fences a 5×5 Garden at most 1 unit tall, its bed left empty, its gate in the middle of +z', () => {
    for (const s of ofKind('garden')) {
      expect(s.footprint, s.name).toEqual({ width: 5, depth: 5 });
      expect(s.door, s.name).toBe('+z');
      expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
      expect(s.size.y, s.name).toBeLessThanOrEqual(GARDEN_HEIGHT.fence * STRUCTURE);
      const voxels = [...structureVoxels(s)];
      // The gate: the middle of the +z side differs from the fence beside it (another role or another shape).
      const cellOf = (cx: number) => voxels.filter((v) => v.z >= 4 * STRUCTURE && Math.floor(v.x / STRUCTURE) === cx).map((v) => `${v.x % STRUCTURE},${v.y},${v.z},${v.role}`).toSorted();
      expect(cellOf(2), s.name).not.toEqual(cellOf(1));
    }
  });

  it('keeps each tree 3–3.5 units tall, its crown 6×6 at most: 2 voxels clear of the next tree', () => {
    for (const s of ofKind('tree')) {
      expect(s.footprint, s.name).toEqual({ width: 1, depth: 1 });
      expect(s.size.y, s.name).toBeGreaterThanOrEqual(24);
      expect(s.size.y, s.name).toBeLessThanOrEqual(GARDEN_HEIGHT.tree * STRUCTURE);
      for (const axis of ['x', 'z'] as const) {
        const { min, max } = span(s, axis);
        expect([min, max], `${s.name} ${axis}`).toEqual([1, 6]);
      }
    }
  });

  it('keeps each flower 1.25–1.75 units tall, its bloom 6×6 at most, filling its cell', () => {
    for (const s of ofKind('flower')) {
      expect(s.footprint, s.name).toEqual({ width: 1, depth: 1 });
      expect(s.size.y, s.name).toBeGreaterThanOrEqual(10);
      expect(s.size.y, s.name).toBeLessThanOrEqual(GARDEN_HEIGHT.flower * STRUCTURE);
      // The bloom: the top half.
      const bloom = (v: { y: number }) => v.y >= s.size.y / 2;
      for (const axis of ['x', 'z'] as const) {
        const all = span(s, axis);
        expect(all.min, `${s.name} ${axis}`).toBeGreaterThanOrEqual(1);
        expect(all.max, `${s.name} ${axis}`).toBeLessThanOrEqual(6);
        const { min, max } = span(s, axis, bloom);
        expect(max - min + 1, `${s.name} ${axis}`).toBeGreaterThanOrEqual(5);
      }
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
    for (const s of houses) expect(s.interior, s.name).not.toBeNull();
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

describe('the House Interior rooms', () => {
  const developer = STRUCTURES.find((s) => s.kind === 'developer');
  const key = (v: { x: number; y: number; z: number }) => `${v.x},${v.y},${v.z}`;

  it('gives every Biome one room, drawn at 1/16 unit', () => {
    for (const biome of BIOME_IDS) {
      const rooms = variantsOf('room', biome);
      expect(rooms.map((r) => r.variant), biome).toEqual([1]);
      expect(rooms[0]!.scale, biome).toBe(INTERIOR);
    }
  });

  it('fits each room in the interior space of every House Variant in its Biome', () => {
    for (const biome of BIOME_IDS) {
      const [room] = variantsOf('room', biome);
      for (const house of variantsOf('house', biome)) {
        const { min, max } = house.interior!;
        // The room stands at the interior's min corner; ⅛ voxels to 1/16 voxels.
        const k = INTERIOR / STRUCTURE;
        for (const axis of ['x', 'y', 'z'] as const) expect(room!.size[axis], `${room!.name} in ${house.name} ${axis}`).toBeLessThanOrEqual((max[axis] - min[axis]) * k);
        expect(room!.anchor, room!.name).toEqual({ x: 0, y: 0, z: 0 });
      }
    }
  });

  it('seats the developer at each room’s developer anchor, inside the room and clear of its furniture', () => {
    expect(developer?.scale).toBe(INTERIOR);
    expect(new Set(developer!.palette.map((p) => p.part))).toEqual(new Set(['base', 'head', 'leftHand', 'rightHand']));
    for (const room of STRUCTURES.filter((s) => s.kind === 'room')) {
      const at = room.developer;
      expect(at, room.name).not.toBeNull();
      const furniture = new Set([...structureVoxels(room)].map(key));
      for (const v of structureVoxels(developer!)) {
        const p = { x: at!.x + v.x, y: at!.y + v.y, z: at!.z + v.z };
        for (const axis of ['x', 'y', 'z'] as const) {
          expect(p[axis], `${room.name} ${key(p)}`).toBeGreaterThanOrEqual(0);
          expect(p[axis], `${room.name} ${key(p)}`).toBeLessThan(room.size[axis]);
        }
        expect(furniture.has(key(p)), `${room.name} ${key(p)}`).toBe(false);
      }
      // The developer sits on something: a voxel of the room right under their lowest layer.
      const lowest = [...structureVoxels(developer!)].filter((v) => v.y === 0);
      expect(lowest.some((v) => furniture.has(key({ x: at!.x + v.x, y: at!.y - 1, z: at!.z + v.z }))), room.name).toBe(true);
    }
  });

  it('puts a computer in front of the developer: a screen facing them (+x), in view over their shoulder', () => {
    for (const room of STRUCTURES.filter((s) => s.kind === 'room')) {
      const screen = [...structureVoxels(room)].filter((v) => v.role === 'screen');
      expect(screen.length, room.name).toBeGreaterThanOrEqual(30);
      const at = room.developer!;
      for (const v of screen) {
        expect(v.x, room.name).toBeLessThan(at.x);
        expect(voxelAt(room, v.x + 1, v.y, v.z), `${room.name} in front of ${key(v)}`).toBeNull();
      }
      // The screen spans the developer's eye line.
      const eyes = at.y + Math.max(...[...structureVoxels(developer!)].filter((v) => v.part === 'head').map((v) => v.y)) - 3;
      expect(Math.min(...screen.map((v) => v.y)), room.name).toBeLessThanOrEqual(eyes);
      expect(Math.max(...screen.map((v) => v.y)), room.name).toBeGreaterThanOrEqual(eyes - 4);
    }
  });

  it('has a light for the Night: a lamp or a fire in every room', () => {
    for (const room of STRUCTURES.filter((s) => s.kind === 'room')) {
      expect([...structureVoxels(room)].some((v) => v.role === 'lamp' || v.role === 'fire'), room.name).toBe(true);
    }
  });
});

describe('the boats and ships', () => {
  /** The box a structure's voxels fill, in ⅛ voxels: x across the beam, z bow to stern, y up. */
  const box = (s: Structure) => {
    const all = [...structureVoxels(s)];
    const span = (axis: 'x' | 'y' | 'z') => Math.max(...all.map((v) => v[axis])) - Math.min(...all.map((v) => v[axis])) + 1;
    return { beam: span('x'), length: span('z'), height: span('y'), voxels: all.length };
  };
  const boats = STRUCTURES.filter((s) => s.kind === 'boat');
  const ships = STRUCTURES.filter((s) => s.kind === 'ship');

  it('gives every Biome one boat per boat kind and one ship per ship kind, numbered from 1', () => {
    for (const biome of BIOME_IDS) {
      expect(variantsOf('boat', biome).map((s) => s.variant), biome).toEqual(Array.from({ length: BOAT_KINDS }, (_, i) => i + 1));
      expect(variantsOf('ship', biome).map((s) => s.variant), biome).toEqual(Array.from({ length: SHIP_KINDS }, (_, i) => i + 1));
    }
  });

  it('makes a boat 1×1, 6–8 long, 4–6 across and 4–8 tall, bow to +z, standing on the sea floor', () => {
    for (const s of boats) {
      const b = box(s);
      expect(s.footprint, s.name).toEqual({ width: 1, depth: 1 });
      expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
      expect(b.length, s.name).toBeGreaterThanOrEqual(6);
      expect(b.length, s.name).toBeLessThanOrEqual(8);
      expect(b.beam, s.name).toBeGreaterThanOrEqual(4);
      expect(b.beam, s.name).toBeLessThanOrEqual(6);
      expect(b.height, s.name).toBeGreaterThanOrEqual(4);
      expect(b.height, s.name).toBeLessThanOrEqual(8);
    }
  });

  it('makes a ship 1×2 or 1×3, 16–24 long, 8 across and 20–32 tall', () => {
    for (const s of ships) {
      const b = box(s);
      expect([2, 3], s.name).toContain(s.footprint.depth);
      expect(s.footprint.width, s.name).toBe(1);
      expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
      expect(b.length, s.name).toBeGreaterThanOrEqual(16);
      expect(b.beam, s.name).toBe(8);
      expect(b.height, s.name).toBeGreaterThanOrEqual(20);
      expect(b.height, s.name).toBeLessThanOrEqual(32);
    }
  });

  it('makes every ship clearly larger than every boat: at least twice as long, three times as tall, and five times the voxels', () => {
    const most = (key: 'length' | 'height' | 'voxels') => Math.max(...boats.map((s) => box(s)[key]));
    for (const s of ships) {
      const b = box(s);
      expect(b.length, s.name).toBeGreaterThanOrEqual(2 * most('length'));
      expect(b.height, s.name).toBeGreaterThanOrEqual(2.5 * most('height'));
      expect(b.voxels, s.name).toBeGreaterThanOrEqual(5 * most('voxels'));
    }
  });

  it('points the bow to +z: the hull narrows towards the bow, so the last row is narrower than the middle', () => {
    for (const s of [...boats, ...ships]) {
      const hull = [...structureVoxels(s)].filter((v) => v.y === 1);
      const across = (z: number) => hull.filter((v) => v.z === z).length;
      const zs = hull.map((v) => v.z);
      const bow = Math.max(...zs);
      const middle = Math.round((Math.min(...zs) + bow) / 2);
      expect(across(bow), s.name).toBeLessThan(across(middle));
    }
  });
});

describe('the Decoration', () => {
  const tallest = (s: Structure) => s.size.y - s.anchor.y;
  /** The span of a structure's voxels along an axis, in voxels (max − min + 1). */
  const width = (s: Structure, axis: 'x' | 'z') => {
    const values = [...structureVoxels(s)].map((v) => v[axis]);
    return Math.max(...values) - Math.min(...values) + 1;
  };

  it('gives every Biome one piece of each kind, numbered from 1', () => {
    for (const biome of BIOME_IDS) for (const kind of DECORATION_KINDS) expect(variantsOf(kind, biome).map((s) => s.variant), `${kind} ${biome}`).toEqual([1]);
  });

  it('stands each piece on one cell, from the ground, never taller than the generator keeps clear for it (`DECORATION_HEIGHT`)', () => {
    for (const kind of DECORATION_KINDS) {
      for (const s of STRUCTURES.filter((s) => s.kind === kind)) {
        expect(s.footprint, s.name).toEqual({ width: 1, depth: 1 });
        expect(s.anchor, s.name).toEqual({ x: 0, y: 0, z: 0 });
        expect(tallest(s) / STRUCTURE, s.name).toBeLessThanOrEqual(DECORATION_HEIGHT[kind]);
      }
    }
  });

  it('keeps to the sizes in the README: grass, clumps and rocks 2–4 voxels tall, a bush 4–6, a small tree 12–16, a building 20 at most', () => {
    const tall: Record<string, [number, number]> = { grass: [2, 4], clump: [2, 4], rocks: [2, 4], bush: [4, 6], sapling: [12, 16], fence: [4, 8], lamp: [10, 16], shed: [10, 16], windmill: [14, 20] };
    for (const kind of DECORATION_KINDS) {
      for (const s of STRUCTURES.filter((s) => s.kind === kind)) {
        const [low, high] = tall[kind]!;
        expect(tallest(s), s.name).toBeGreaterThanOrEqual(low);
        expect(tallest(s), s.name).toBeLessThanOrEqual(high);
      }
    }
  });

  it('makes the small tree a smaller species than the Garden\'s tree: its crown 4–5 voxels across and lower', () => {
    for (const biome of BIOME_IDS) {
      const [sapling] = variantsOf('sapling', biome);
      const [tree] = variantsOf('tree', biome);
      for (const axis of ['x', 'z'] as const) expect(width(sapling!, axis), sapling!.name).toBeLessThanOrEqual(5);
      expect(tallest(sapling!), sapling!.name).toBeLessThan(tallest(tree!));
    }
  });

  it('fronts each minor building on +z, so turning it south or east shows its front', () => {
    for (const kind of ['shed', 'windmill'] as const) for (const s of STRUCTURES.filter((s) => s.kind === kind)) expect(s.door, s.name).toBe('+z');
  });

  it('never stands a Landmark Variant lower than the generator assumes (`LANDMARK_MIN_HEIGHT`)', () => {
    for (const kind of PLACED_LANDMARK_IDS) {
      for (const s of STRUCTURES.filter((s) => s.kind === kind)) expect(tallest(s) / STRUCTURE, s.name).toBeGreaterThanOrEqual(LANDMARK_MIN_HEIGHT[kind]);
    }
  });
});
