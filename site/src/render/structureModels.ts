/**
 * Predefined structures (`structures/`, ADR 0004) placed in a World, at
 * ⅛-unit voxels (`STRUCTURE`). Pure: no three.js.
 *
 * A placed structure is drawn voxel by voxel into a grid, with each voxel's
 * colour role resolved to a colour id (`structureColour`) and its part
 * (`base` or `lid`) chosen by the caller. A structure turns to face its
 * door the way its Landmark says: files are drawn with the door on +z
 * (south); a door facing east swaps x and z, which keeps the walls the
 * camera sees (+x and +z) the front walls.
 *
 * Today only the House is a structure: its base goes into the World's
 * structure grid (`worldVoxels.ts`), its lid into a mesh of its own that
 * lifts (`house.ts`).
 */
import { houseYard, type Facing, type PlacedLandmark, type World } from '@/world';
import { STRUCTURES, variantsOf, type Structure } from '@/structures';
import { structureVoxels } from '@/structures/parse';
import { STRUCTURE_ROLES, type RoleColour, type StructurePart, type StructureRole } from '@/structures/roles';
import { STRUCTURE } from './voxelTiers';
import type { WorldColours } from './worldVoxels';

type Paint = (x: number, y: number, z: number, colour: number) => void;

/** A colour role's colour id in a World's colour table. */
export function structureColour(colours: Pick<WorldColours, 'biome' | 'fixed'>, role: StructureRole): number {
  const colour: RoleColour = STRUCTURE_ROLES[role];
  return 'biome' in colour ? colours.biome(colour.biome, colour.dl ?? 0) : colours.fixed(colour.fixed, colour.dl ?? 0);
}

/** Where a structure goes: its anchor's World voxel (⅛ units), and the way its door faces. */
export interface StructurePlacement {
  x: number;
  y: number;
  z: number;
  facing: Facing;
}

/** A structure voxel's offset from the placement point, turned to face `facing` (south or east). */
export function turned(s: Structure, v: { x: number; y: number; z: number }, facing: Facing): { x: number; y: number; z: number } {
  const x = v.x - s.anchor.x;
  const y = v.y - s.anchor.y;
  const z = v.z - s.anchor.z;
  return facing === 'east' ? { x: z, y, z: x } : { x, y, z };
}

/** Paint one part of a structure (or all of it) at a placement. */
export function drawStructure(
  s: Structure,
  at: StructurePlacement,
  colours: Pick<WorldColours, 'biome' | 'fixed'>,
  paint: Paint,
  part?: StructurePart,
): void {
  const ids = s.palette.map(({ role }) => structureColour(colours, role));
  for (const v of structureVoxels(s)) {
    if (part !== undefined && v.part !== part) continue;
    const p = turned(s, v, at.facing);
    paint(at.x + p.x, at.y + p.y, at.z + p.z, ids[v.id - 1]!);
  }
}

/** The House Variant a World shows: its Biome's, by the House's `variant`. */
export function houseStructure(world: World): Structure {
  const house = world.landmarks.find((l) => l.id === 'house');
  const variants = variantsOf('house', world.biome.id);
  return variants[(house?.variant ?? 0) % variants.length]!;
}

/** Where the House's structure stands: its plot's origin cell, on the ground, its door the House's way. */
export function housePlacement(house: PlacedLandmark): StructurePlacement {
  const { origin } = houseYard(house).house;
  return { x: origin.x * STRUCTURE, y: house.y * STRUCTURE, z: origin.z * STRUCTURE, facing: house.door ?? 'south' };
}

/** Draw a World's placed structures (today, the House's base) into the World's ⅛-unit structure grid. */
export function drawStructures(world: World, colours: WorldColours, paint: Paint): void {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (house) drawStructure(houseStructure(world), housePlacement(house), colours, paint, 'base');
}

/** The tallest House Variant, in world units: the House's box for its link and its Data Card. */
export const HOUSE_HEIGHT = Math.max(...STRUCTURES.filter((s) => s.kind === 'house').map((s) => s.size.y)) / STRUCTURE;

/**
 * A lit window face: one ⅛ voxel's face of glass, facing +x or +z, with
 * nothing in front of it, in World ⅛ voxels (the voxel's min corner).
 */
export interface WindowFace {
  x: number;
  y: number;
  z: number;
  facing: '+x' | '+z';
  part: StructurePart;
}

/**
 * The House's window faces that glow at Night: every glass voxel's +x or +z
 * face that is open (no voxel of the structure in front of it). On the
 * front walls these face out, towards the camera; on the back walls they
 * face into the room, seen with the lid off.
 */
export function houseWindowFaces(world: World): WindowFace[] {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) return [];
  const s = houseStructure(world);
  const at = housePlacement(house);
  const filled = new Set<string>();
  const glass: Array<{ x: number; y: number; z: number; part: StructurePart }> = [];
  for (const v of structureVoxels(s)) {
    const p = turned(s, v, at.facing);
    const w = { x: at.x + p.x, y: at.y + p.y, z: at.z + p.z };
    filled.add(`${w.x},${w.y},${w.z}`);
    if (v.role === 'window') glass.push({ ...w, part: v.part });
  }
  const faces: WindowFace[] = [];
  for (const g of glass) {
    if (!filled.has(`${g.x + 1},${g.y},${g.z}`)) faces.push({ ...g, facing: '+x' });
    if (!filled.has(`${g.x},${g.y},${g.z + 1}`)) faces.push({ ...g, facing: '+z' });
  }
  return faces;
}
