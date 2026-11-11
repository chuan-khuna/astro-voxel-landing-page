/**
 * Predefined structures (`structures/`, ADR 0004) placed in a World, at
 * ⅛-unit voxels (`STRUCTURE`). Pure: no three.js.
 *
 * A placed structure is drawn voxel by voxel into a grid, with each voxel's
 * colour role resolved to a colour id (`structureColour`) and its part
 * (`base` or `lid`) chosen by the caller. A structure faces its door the
 * way its Landmark says: files are drawn with the door on +z (south); a
 * door facing east swaps x and z. That is a mirror, not a quarter turn: it
 * keeps the walls the camera sees (+x and +z) the front walls, so the lid
 * still opens the room to the camera, but asymmetric details (a chimney,
 * a side window) swap sides. A file whose door is not on +z is refused.
 *
 * Each placed Landmark but the Garden is a structure, its Variant picked by
 * the Seed (`landmarkStructure`): the Station, the Mailbox, the Dock's
 * things and the House's base go into the World's structure grid
 * (`worldVoxels.ts`); the House's lid goes into a mesh of its own that
 * lifts (`house.ts`).
 */
import { houseYard, type Facing, type PlacedLandmark, type PlacedLandmarkId, type World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
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

/** A structure voxel's offset from the placement point, facing `facing`: as drawn for south, mirrored across x = z for east. */
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
  if (s.door !== null && s.door !== '+z') throw new Error(`${s.name}: placed structures are drawn with their door on +z, not ${s.door}`);
  const ids = s.palette.map(({ role }) => structureColour(colours, role));
  for (const v of structureVoxels(s)) {
    if (part !== undefined && v.part !== part) continue;
    const p = turned(s, v, at.facing);
    paint(at.x + p.x, at.y + p.y, at.z + p.z, ids[v.id - 1]!);
  }
}

/** The Landmarks drawn as structures: all but the Garden (its plants are polish ticket 05). */
type StructureLandmarkId = Exclude<PlacedLandmarkId, 'garden'>;
const isStructureLandmark = (l: PlacedLandmark): l is PlacedLandmark & { id: StructureLandmarkId } => l.id !== 'garden';

/** The structure a placed Landmark shows: its World's Biome's Variant number `variant`. The Garden has none yet. */
export function landmarkStructure(world: Pick<World, 'biome'>, landmark: PlacedLandmark): Structure {
  if (!isStructureLandmark(landmark)) throw new Error('The Garden is not a structure yet');
  const s = variantsOf(landmark.id, world.biome.id).find((v) => v.variant === landmark.variant);
  if (!s) throw new Error(`No ${landmark.id} Variant ${landmark.variant} for the ${world.biome.id} Biome`);
  return s;
}

/** The House Variant a World shows. */
export function houseStructure(world: World): Structure {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) throw new Error(`World ${world.seed} has no House`);
  return landmarkStructure(world, house);
}

/** Where the House's structure stands: its plot's origin cell, on the ground, its door the House's way. */
export function housePlacement(house: PlacedLandmark): StructurePlacement {
  const { origin } = houseYard(house).house;
  return { x: origin.x * STRUCTURE, y: house.y * STRUCTURE, z: origin.z * STRUCTURE, facing: house.door ?? 'south' };
}

/**
 * Where a Landmark's structure stands: its footprint's origin, on the
 * ground. The House faces its door; the Mailbox faces the same way, onto
 * the yard; a Dock whose footprint runs north to south (1×2) is laid
 * along it (the east mirror swaps x and z); the Station faces south.
 */
export function landmarkPlacement(world: Pick<World, 'landmarks'>, landmark: PlacedLandmark): StructurePlacement {
  if (landmark.id === 'house') return housePlacement(landmark);
  const { origin, width } = landmark.footprint;
  const at = { x: origin.x * STRUCTURE, y: landmark.y * STRUCTURE, z: origin.z * STRUCTURE };
  if (landmark.id === 'mailbox') return { ...at, facing: world.landmarks.find((l) => l.id === 'house')?.door ?? 'south' };
  if (landmark.id === 'dock') return { ...at, facing: width === 1 ? 'east' : 'south' };
  return { ...at, facing: 'south' };
}

/** Paint one part of the World's House Variant where the House stands (nothing if the World has no House). */
export function drawHousePart(world: World, colours: Pick<WorldColours, 'biome' | 'fixed'>, part: StructurePart, paint: Paint): void {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (house) drawStructure(houseStructure(world), housePlacement(house), colours, paint, part);
}

/**
 * Draw a World's placed structures into the World's ⅛-unit structure grid:
 * the House's base (its lid is a mesh of its own, `house.ts`), and the
 * Station, the Mailbox and the Dock's things whole.
 */
export function drawStructures(world: World, colours: WorldColours, paint: Paint): void {
  for (const landmark of world.landmarks) {
    if (!isStructureLandmark(landmark)) continue;
    drawStructure(landmarkStructure(world, landmark), landmarkPlacement(world, landmark), colours, paint, landmark.id === 'house' ? 'base' : undefined);
  }
}


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
