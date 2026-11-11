/**
 * The ASCII structure format (ADR 0004, ADR 0006), parsed into a typed voxel
 * array. Runs at build time only (the Vite plugin in `vitePlugin.ts`) and in
 * tests: the browser never parses ASCII.
 *
 * A structure file is a header, a key and layers of ⅛-unit voxels:
 *
 * ```
 * # Comments start with #.
 * kind: house              what it is (the House, a tree, a boat...)
 * biome: tropical          the Biome whose style it is, or `any`
 * variant: 1               its Variant number within that Biome
 * footprint: 3x3           cells along x and z; 8 voxels a cell
 * door: +z                 the face the door is on (+x, -x, +z, -z) or `none`
 * anchor: 0 0 0            the voxel corner that stands on the footprint's
 *                          min corner, on the ground
 * interior: 4 2 4 20 20 20 optional: a box (min x y z, max x y z, max
 *                          exclusive) kept empty for a room
 * key:
 *   P plinth               character, colour role, optional part (`lid`)
 *   w wall lid
 * layer 0                  one block per layer, bottom to top;
 * PPPP...                  `layers 2-7` repeats one block for each layer
 * ```
 *
 * In a block, rows run north to south (z = 0 first) and the characters of
 * a row west to east (x = 0 first), so a block reads like the World seen
 * from above with north up. `.` is always empty. Every layer from 0 to the
 * top appears exactly once.
 */
// Relative, not `@/`: this module loads with the Vite and Vitest configs, before the alias exists.
import { BIOME_IDS, type BiomeId } from '../world/types';
import { STRUCTURE_PARTS, isStructureRole, type StructurePart, type StructureRole } from './roles';

/** Structure voxels per cell, along each axis (ADR 0006). */
export const STRUCTURE_VOXELS_PER_CELL = 8;

export type DoorFace = '+x' | '-x' | '+z' | '-z';

interface Point {
  x: number;
  y: number;
  z: number;
}

/** One entry in a structure's palette: what colour role and which part a voxel is. */
export interface StructureVoxel {
  role: StructureRole;
  part: StructurePart;
}

/** A parsed structure: plain data plus one typed array, safe to post to a Web Worker. */
export interface Structure {
  /** The file it came from, for messages. */
  name: string;
  kind: string;
  /** The Biome whose style it is; null for one shared by every Biome. */
  biome: BiomeId | null;
  variant: number;
  /** Size in ⅛-unit voxels. */
  size: Point;
  /** Footprint in cells. */
  footprint: { width: number; depth: number };
  door: DoorFace | null;
  anchor: Point;
  interior: { min: Point; max: Point } | null;
  /** `voxels` holds 0 for empty, or 1 + an index into this list. */
  palette: StructureVoxel[];
  /** One byte per voxel, at `x + size.x · (z + size.z · y)`. */
  voxels: Uint8Array;
}

const DOORS: readonly string[] = ['+x', '-x', '+z', '-z'];

export function parseStructure(text: string, name: string): Structure {
  const fail = (line: number, message: string): never => {
    throw new Error(`${name}:${line + 1}: ${message}`);
  };
  const lines = text.split(/\r?\n/);
  const header = new Map<string, { value: string; line: number }>();
  const key = new Map<string, number>();
  const palette: StructureVoxel[] = [];
  const blocks: Array<{ from: number; to: number; rows: string[]; line: number }> = [];
  let mode: 'header' | 'key' | 'layers' = 'header';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const layer = /^layers?\s+(\d+)(?:\s*-\s*(\d+))?$/.exec(line);
    if (layer) {
      mode = 'layers';
      const from = Number(layer[1]);
      const to = layer[2] === undefined ? from : Number(layer[2]);
      if (to < from) fail(i, `layer range ${from}-${to} runs backwards`);
      blocks.push({ from, to, rows: [], line: i });
      continue;
    }
    if (mode === 'layers') {
      blocks.at(-1)!.rows.push(line);
      continue;
    }
    if (line === 'key:') {
      mode = 'key';
      continue;
    }
    if (mode === 'key') {
      const [char, role, part = 'base', ...rest] = line.split(/\s+/);
      if (!char || char.length !== 1 || !role || rest.length > 0) fail(i, `a key line is "<character> <role> [part]"`);
      if (char === '.') fail(i, '"." is always empty');
      if (key.has(char!)) fail(i, `"${char}" is in the key twice`);
      if (!isStructureRole(role!)) fail(i, `unknown role "${role}"`);
      if (!(STRUCTURE_PARTS as readonly string[]).includes(part)) fail(i, `unknown part "${part}"`);
      palette.push({ role: role as StructureRole, part: part as StructurePart });
      key.set(char!, palette.length);
      continue;
    }
    const field = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!field) fail(i, `expected "name: value", got "${line}"`);
    header.set(field![1]!, { value: field![2]!.trim(), line: i });
  }

  const need = (field: string) => header.get(field)?.value ?? fail(0, `missing "${field}:"`);
  const numbers = (field: string, count: number) => {
    const values = need(field).split(/\s+/).map(Number);
    if (values.length !== count || values.some((v) => !Number.isInteger(v))) fail(header.get(field)!.line, `"${field}" takes ${count} whole numbers`);
    return values;
  };

  const kind = need('kind');
  const biomeName = need('biome');
  if (biomeName !== 'any' && !(BIOME_IDS as readonly string[]).includes(biomeName)) fail(header.get('biome')!.line, `unknown Biome "${biomeName}"`);
  const variant = Number(need('variant'));
  if (!Number.isInteger(variant) || variant < 1) fail(header.get('variant')!.line, 'variant is a whole number from 1');
  const footprint = /^(\d+)x(\d+)$/.exec(need('footprint'));
  if (!footprint) fail(header.get('footprint')!.line, 'footprint is "<width>x<depth>" in cells');
  const width = Number(footprint![1]);
  const depth = Number(footprint![2]);
  const doorName = need('door');
  if (doorName !== 'none' && !DOORS.includes(doorName)) fail(header.get('door')!.line, `door is one of ${DOORS.join(', ')} or none`);
  const [ax, ay, az] = numbers('anchor', 3);
  const interiorBox = header.has('interior') ? numbers('interior', 6) : null;

  const sx = width * STRUCTURE_VOXELS_PER_CELL;
  const sz = depth * STRUCTURE_VOXELS_PER_CELL;
  blocks.sort((a, b) => a.from - b.from);
  let next = 0;
  for (const b of blocks) {
    if (b.from !== next) fail(b.line, `layer ${next} is ${b.from > next ? 'missing' : 'given twice'}`);
    next = b.to + 1;
    if (b.rows.length !== sz) fail(b.line, `each layer has ${sz} rows (footprint ${width}x${depth}), this one ${b.rows.length}`);
  }
  if (next === 0) fail(0, 'no layers');
  const sy = next;

  const voxels = new Uint8Array(sx * sy * sz);
  for (const b of blocks) {
    b.rows.forEach((row, z) => {
      const line = b.line + 1 + z;
      if (row.length !== sx) fail(line, `each row is ${sx} wide (footprint ${width}x${depth}), this one ${row.length}`);
      for (let x = 0; x < sx; x++) {
        const char = row[x]!;
        if (char === '.') continue;
        const id = key.get(char) ?? fail(line, `"${char}" is not in the key`);
        for (let y = b.from; y <= b.to; y++) voxels[x + sx * (z + sz * y)] = id;
      }
    });
  }

  return {
    name,
    kind,
    biome: biomeName === 'any' ? null : (biomeName as BiomeId),
    variant,
    size: { x: sx, y: sy, z: sz },
    footprint: { width, depth },
    door: doorName === 'none' ? null : (doorName as DoorFace),
    anchor: { x: ax!, y: ay!, z: az! },
    interior: interiorBox && {
      min: { x: interiorBox[0]!, y: interiorBox[1]!, z: interiorBox[2]! },
      max: { x: interiorBox[3]!, y: interiorBox[4]!, z: interiorBox[5]! },
    },
    palette,
    voxels,
  };
}

/** The voxel at (x, y, z), or null if it is empty or outside the structure. */
export function voxelAt(s: Structure, x: number, y: number, z: number): StructureVoxel | null {
  const { size } = s;
  if (x < 0 || y < 0 || z < 0 || x >= size.x || y >= size.y || z >= size.z) return null;
  const id = s.voxels[x + size.x * (z + size.z * y)]!;
  return id === 0 ? null : s.palette[id - 1]!;
}

/** Every filled voxel, with its palette entry and its id (1 + the entry's index). */
export function* structureVoxels(s: Structure): Generator<Point & StructureVoxel & { id: number }> {
  const { x: sx, y: sy, z: sz } = s.size;
  for (let y = 0; y < sy; y++) {
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const id = s.voxels[x + sx * (z + sz * y)]!;
        if (id !== 0) yield { x, y, z, id, ...s.palette[id - 1]! };
      }
    }
  }
}
