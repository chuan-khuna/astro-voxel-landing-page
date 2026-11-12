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
 * Each placed Landmark is a structure, its Variant picked by the Seed
 * (`landmarkStructure`): the Station's lighthouse, the Mailbox, the Dock's
 * things, the Garden's fence and the House's base go into the World's
 * structure grid (`worldVoxels.ts`), and so does each Service's structure
 * round the lighthouse (`serviceStructure`); the House's lid goes into a
 * mesh of its own that lifts (`house.ts`). The Garden's plants are
 * instanced (`gardenPlants.ts`).
 */
import { LIGHTHOUSE_CELL, SERVICE_KINDS, SERVICE_PLACES, STATION_SIZE, houseYard, type BiomeId, type Facing, type PlacedLandmark, type StationService, type World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
import { structureVoxels, type StructureVoxel } from '@/structures/parse';
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

/** The structure a placed Landmark shows: its World's Biome's Variant number `variant` (the Garden's is its fence). */
export function landmarkStructure(world: Pick<World, 'biome'>, landmark: PlacedLandmark): Structure {
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
 * along it (the east mirror swaps x and z); the Garden's gate faces the
 * way the Garden says (its fence is the same on every side but the gate);
 * the Station's lighthouse stands in the middle of its group, facing south.
 */
export function landmarkPlacement(world: Pick<World, 'landmarks'>, landmark: PlacedLandmark): StructurePlacement {
  if (landmark.id === 'house') return housePlacement(landmark);
  const { origin, width } = landmark.footprint;
  const at = { x: origin.x * STRUCTURE, y: landmark.y * STRUCTURE, z: origin.z * STRUCTURE };
  if (landmark.id === 'mailbox') return { ...at, facing: world.landmarks.find((l) => l.id === 'house')?.door ?? 'south' };
  if (landmark.id === 'dock') return { ...at, facing: width === 1 ? 'east' : 'south' };
  if (landmark.id === 'garden') return { ...at, facing: landmark.door ?? 'south' };
  if (landmark.id === 'station') return { ...at, x: at.x + LIGHTHOUSE_CELL.x * STRUCTURE, z: at.z + LIGHTHOUSE_CELL.z * STRUCTURE, facing: 'south' };
  return { ...at, facing: 'south' };
}

/** The structure of a Service of `kind` (1 to `SERVICE_KINDS.length`), in a Biome's style. */
export function serviceStructure(biome: BiomeId, kind: number): Structure {
  const s = variantsOf('service', biome).find((v) => v.variant === kind);
  if (!s) throw new Error(`No Service structure of kind ${kind} for the ${biome} Biome`);
  return s;
}

/** Where a Service's structure stands: its 2×2 place in the Station's group, on the group's ground, facing south. */
export function servicePlacement(station: PlacedLandmark, service: StationService): StructurePlacement {
  return { x: service.cell.x * STRUCTURE, y: station.y * STRUCTURE, z: service.cell.z * STRUCTURE, facing: 'south' };
}

/** Paint every Service's structure round a placed Station (nothing for any other Landmark). */
export function drawServices(world: Pick<World, 'biome'>, landmark: PlacedLandmark, colours: Pick<WorldColours, 'biome' | 'fixed'>, paint: Paint): void {
  for (const service of landmark.services) drawStructure(serviceStructure(world.biome.id, service.kind), servicePlacement(landmark, service), colours, paint);
}

const groups = new Map<BiomeId, Structure>();

/**
 * A Biome's Station group as one structure, for the Model Gallery: the
 * lighthouse in the middle and one Service of each kind (`SERVICE_KINDS`)
 * on the first places round it (the four sides), as a World lays them out.
 */
export function stationGroup(biome: BiomeId): Structure {
  const hit = groups.get(biome);
  if (hit) return hit;
  const lighthouse = variantsOf('station', biome)[0];
  if (!lighthouse) throw new Error(`No lighthouse for the ${biome} Biome`);
  const services = SERVICE_KINDS.map((_, k) => ({ cell: SERVICE_PLACES[k]!, structure: serviceStructure(biome, k + 1) }));
  const scale = lighthouse.scale;
  const size = { x: STATION_SIZE * scale, y: Math.max(lighthouse.size.y, ...services.map((s) => s.structure.size.y)), z: STATION_SIZE * scale };
  const palette: StructureVoxel[] = [];
  const idOf = (entry: StructureVoxel) => {
    const i = palette.findIndex((p) => p.role === entry.role && p.part === entry.part);
    if (i !== -1) return i + 1;
    palette.push(entry);
    return palette.length;
  };
  const voxels = new Uint8Array(size.x * size.y * size.z);
  const put = (s: Structure, cell: { x: number; z: number }) => {
    for (const v of structureVoxels(s)) voxels[cell.x * scale + v.x + size.x * (cell.z * scale + v.z + size.z * v.y)] = idOf({ role: v.role, part: v.part });
  };
  put(lighthouse, LIGHTHOUSE_CELL);
  for (const { cell, structure } of services) put(structure, cell);
  const group: Structure = { ...lighthouse, name: `${lighthouse.name} group`, footprint: { width: STATION_SIZE, depth: STATION_SIZE }, door: null, size, palette, voxels };
  groups.set(biome, group);
  return group;
}

/** Paint one part of the World's House Variant where the House stands (nothing if the World has no House). */
export function drawHousePart(world: World, colours: Pick<WorldColours, 'biome' | 'fixed'>, part: StructurePart, paint: Paint): void {
  const house = world.landmarks.find((l) => l.id === 'house');
  if (house) drawStructure(houseStructure(world), housePlacement(house), colours, paint, part);
}

/**
 * Draw a World's placed structures into the World's ⅛-unit structure grid:
 * the House's base (its lid is a mesh of its own, `house.ts`), and the
 * Station's lighthouse with its Services' structures, the Mailbox, the
 * Dock's things and the Garden's fence whole.
 */
export function drawStructures(world: World, colours: WorldColours, paint: Paint): void {
  for (const landmark of world.landmarks) {
    drawStructure(landmarkStructure(world, landmark), landmarkPlacement(world, landmark), colours, paint, landmark.id === 'house' ? 'base' : undefined);
    drawServices(world, landmark, colours, paint);
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
