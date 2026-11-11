/**
 * The House Interior's room (ADR 0006), as data: pure, no three.js.
 *
 * Each Biome has one room (`structures/room/<biome>-1.structure`), drawn at
 * 1/16 unit (`INTERIOR`) to fill the interior space every House Variant
 * of that Biome keeps empty. The developer (`structures/developer/any-1`)
 * sits at the room's `developer:` anchor; `furnishedRoom` merges the two
 * into one structure, keeping the developer's moving parts (`head`,
 * `leftHand`, `rightHand`) apart for the Interior scene to animate.
 *
 * The room shows twice:
 * - in the Interior scene (`interior.ts`), at 1/16 unit;
 * - in the World, `coarsen`ed to ⅛ unit and drawn in the structure grid,
 *   so the room is there while the lid lifts and the camera dives in.
 *
 * The room never turns with the House's door: the interior box is square
 * in plan, and its back walls are the low-x and low-z ones either way.
 */
import type { BiomeId, World } from '@/world';
import { STRUCTURES, variantsOf, type Structure } from '@/structures';
import { structureVoxels, voxelAt, type StructureVoxel } from '@/structures/parse';
import { drawStructure, houseStructure, housePlacement, turned } from './structureModels';
import { INTERIOR, STRUCTURE } from './voxelTiers';
import type { WorldColours } from './worldVoxels';

interface Point {
  x: number;
  y: number;
  z: number;
}

/** A box of voxels: [min, max) on each axis. */
export interface VoxelBox {
  min: Point;
  max: Point;
}

export { DEVELOPER_PARTS, type DeveloperPart } from '@/structures/roles';

const cache = new Map<BiomeId, Structure>();

/** The developer, seated: one figure for every room. */
function developer(): Structure {
  const s = STRUCTURES.find((s) => s.kind === 'developer');
  if (!s) throw new Error('No developer structure');
  return s;
}

/** A Biome's room with the developer seated at its anchor, as one 1/16-unit structure. */
export function furnishedRoom(biome: BiomeId): Structure {
  const hit = cache.get(biome);
  if (hit) return hit;
  const room = variantsOf('room', biome)[0];
  if (!room || !room.developer) throw new Error(`No room with a developer anchor for the ${biome} Biome`);
  const figure = developer();
  const palette: StructureVoxel[] = [...room.palette];
  const idOf = (entry: StructureVoxel) => {
    const i = palette.findIndex((p) => p.role === entry.role && p.part === entry.part);
    if (i !== -1) return i + 1;
    palette.push(entry);
    return palette.length;
  };
  const voxels = room.voxels.slice();
  const { size } = room;
  const at = room.developer;
  for (const v of structureVoxels(figure)) {
    const x = at.x + v.x;
    const y = at.y + v.y;
    const z = at.z + v.z;
    if (x < 0 || y < 0 || z < 0 || x >= size.x || y >= size.y || z >= size.z) throw new Error(`${room.name}: the developer leaves the room`);
    voxels[x + size.x * (z + size.z * y)] = idOf({ role: v.role, part: v.part });
  }
  const furnished: Structure = { ...room, name: `${room.name} + ${figure.name}`, palette, voxels };
  cache.set(biome, furnished);
  return furnished;
}

/**
 * A structure at a coarser scale: each block of `factor`³ voxels becomes
 * one voxel if at least a quarter of it is filled, in the role most of its
 * voxels have (ties to the first met). Every coarse voxel is `base`.
 */
export function coarsen(s: Structure, factor: number): Structure {
  const size = { x: Math.ceil(s.size.x / factor), y: Math.ceil(s.size.y / factor), z: Math.ceil(s.size.z / factor) };
  const palette: StructureVoxel[] = [];
  const ids = new Map<string, number>();
  const voxels = new Uint8Array(size.x * size.y * size.z);
  const threshold = Math.ceil(factor ** 3 / 4);
  for (let y = 0; y < size.y; y++) {
    for (let z = 0; z < size.z; z++) {
      for (let x = 0; x < size.x; x++) {
        const tally = new Map<string, number>();
        let filled = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dz = 0; dz < factor; dz++) {
            for (let dx = 0; dx < factor; dx++) {
              const v = voxelAt(s, x * factor + dx, y * factor + dy, z * factor + dz);
              if (!v) continue;
              filled++;
              tally.set(v.role, (tally.get(v.role) ?? 0) + 1);
            }
          }
        }
        if (filled < threshold) continue;
        let role = '';
        let best = 0;
        for (const [r, n] of tally) {
          if (n > best) {
            role = r;
            best = n;
          }
        }
        let id = ids.get(role);
        if (id === undefined) {
          palette.push({ role: role as StructureVoxel['role'], part: 'base' });
          id = palette.length;
          ids.set(role, id);
        }
        voxels[x + size.x * (z + size.z * y)] = id;
      }
    }
  }
  return {
    ...s,
    name: `${s.name} at 1/${s.scale / factor}`,
    scale: s.scale / factor,
    size,
    footprint: { width: size.x / (s.scale / factor), depth: size.z / (s.scale / factor) },
    anchor: { x: Math.floor(s.anchor.x / factor), y: Math.floor(s.anchor.y / factor), z: Math.floor(s.anchor.z / factor) },
    developer: s.developer && { x: Math.floor(s.developer.x / factor), y: Math.floor(s.developer.y / factor), z: Math.floor(s.developer.z / factor) },
    palette,
    voxels,
  };
}

/** The box round every voxel of the developer in a furnished room (its voxels the plain room lacks). */
export function developerBox(room: Structure): VoxelBox {
  const at = room.developer!;
  const figure = developer();
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const v of structureVoxels(figure)) {
    for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] = Math.min(min[axis], at[axis] + v[axis]);
      max[axis] = Math.max(max[axis], at[axis] + v[axis] + 1);
    }
  }
  return { min, max };
}

/**
 * The computer's screen: the +x face (at `x`) of the room's `screen`
 * voxels, spanning [y0, y1) × [z0, z1) in the room's voxels. The Interior
 * scene draws scrolling code on it.
 */
export function screenFace(room: Structure): { x: number; y0: number; y1: number; z0: number; z1: number } {
  const screen = [...structureVoxels(room)].filter((v) => v.role === 'screen');
  if (screen.length === 0) throw new Error(`${room.name} has no screen`);
  const of = (axis: 'x' | 'y' | 'z') => screen.map((v) => v[axis]);
  return {
    x: Math.max(...of('x')) + 1,
    y0: Math.min(...of('y')),
    y1: Math.max(...of('y')) + 1,
    z0: Math.min(...of('z')),
    z1: Math.max(...of('z')) + 1,
  };
}

/** Where a room's warm light is at Night: the middle of its lamps and fires, in the room's voxels. */
export function roomLight(room: Structure): Point {
  const lights = [...structureVoxels(room)].filter((v) => v.role === 'lamp' || v.role === 'fire');
  if (lights.length === 0) throw new Error(`${room.name} has no lamp or fire`);
  const mean = (axis: 'x' | 'y' | 'z') => lights.reduce((sum, v) => sum + v[axis] + 0.5, 0) / lights.length;
  return { x: mean('x'), y: mean('y'), z: mean('z') };
}

/**
 * Where the room's min corner stands in a World, in World voxels at 1/16
 * unit: the min corner of the House Variant's interior box, as placed.
 */
export function interiorPlacement(world: World): Point {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) throw new Error(`World ${world.seed} has no House`);
  const s = houseStructure(world);
  if (!s.interior) throw new Error(`${s.name} has no interior`);
  const at = housePlacement(house);
  const a = turned(s, s.interior.min, at.facing);
  const b = turned(s, { x: s.interior.max.x - 1, y: s.interior.max.y - 1, z: s.interior.max.z - 1 }, at.facing);
  const k = INTERIOR / s.scale;
  return { x: (at.x + Math.min(a.x, b.x)) * k, y: (at.y + Math.min(a.y, b.y)) * k, z: (at.z + Math.min(a.z, b.z)) * k };
}

/** The room's voxels in the World (World ⅛ voxels): its furnished room at ⅛ unit in the House's interior box. */
export function drawWorldRoom(world: World, colours: Pick<WorldColours, 'biome' | 'fixed'>, paint: (x: number, y: number, z: number, colour: number) => void): void {
  if (!world.landmarks.some((l) => l.id === 'house')) return;
  const k = INTERIOR / STRUCTURE;
  const coarse = coarsen(furnishedRoom(world.biome.id), k);
  const at = interiorPlacement(world);
  drawStructure(coarse, { x: at.x / k, y: at.y / k, z: at.z / k, facing: 'south' }, colours, paint);
}

/**
 * The House Interior takes over at no less than this share of the House
 * Interior's own zoom (the Tour stops a little further out, to keep the
 * Guide beside the House in view).
 */
const INTERIOR_ZOOM_SHARE = 0.5;

/**
 * Whether the House Interior scene shows: the House is open, its lid fully
 * lifted, the camera at rest (not on a flight), close enough, and the
 * room's middle on screen (`room`: its position in clip space).
 */
export function showsInterior(state: {
  open: boolean;
  opening: number;
  flying: boolean;
  zoom: number;
  interiorZoom: number;
  room: { x: number; y: number };
}): boolean {
  const { open, opening, flying, zoom, interiorZoom, room } = state;
  return open && opening === 1 && !flying && zoom >= interiorZoom * INTERIOR_ZOOM_SHARE && Math.abs(room.x) <= 1 && Math.abs(room.y) <= 1;
}
