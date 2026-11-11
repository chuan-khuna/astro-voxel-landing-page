/**
 * Voxels in a World by kind, for the render stats overlay. Pure (no
 * three.js): it redraws the World's detail and structure grids the way
 * `worldToVoxels` does and tallies each part as it lands, so a voxel two
 * parts share counts once (for the part drawn first), plus the voxels of the
 * separate meshes (the House's lid; the instanced plants, boats and ships). The House
 * Interior is a scene of its own and never counts here.
 *
 * Run once per World shown, never per frame.
 */
import type { World } from '@/world';
import { VoxelGrid } from './mesher';
import { drawDetail, worldColours } from './worldVoxels';
import { GROUND_DETAIL, STRUCTURE } from './voxelTiers';
import { drawWorldRoom } from './interiorModel';
import { drawHousePart, drawStructures } from './structureModels';
import { boatsOf, vesselStructure } from './vesselModels';
import { gardenPlantsOf } from './gardenPlants';
import { structureVoxels } from '@/structures/parse';

/** The kinds counted, in the order the overlay lists them. */
export const VOXEL_KINDS = ['terrain', 'landmarks', 'plants', 'houseRoom', 'boats', 'ships', 'buoys', 'bridges', 'stairs'] as const;
export type VoxelKind = (typeof VOXEL_KINDS)[number];

/**
 * - `terrain`: 1-unit voxels; the Landmarks' structures, the Garden's
 *   plants, the House's room, the boats and the ships are ⅛-unit voxels;
 *   every other kind is ¼-unit voxels.
 * - `landmarks`: the Landmark models and their Variants' structures (the
 *   House's base and lid, the Station, the Mailbox, the Dock's things, the
 *   Garden's fence), less the House's room.
 * - `plants`: the Garden's flowers and trees, one per planted Project.
 * - `houseRoom`: the House Interior's room as the World shows it, at ⅛
 *   unit (`interiorModel.ts`), the developer included.
 * - `boats`: every Client's moored boat (instanced, so not in the grids).
 * - `ships`: every Partner's ship.
 */
export type VoxelCounts = Record<VoxelKind, number> & {
  /** Every kind together. */
  total: number;
  /** Voxels in the World's three meshed grids (terrain, detail and structure): all but the separate meshes (the House's lid, the instanced plants, boats and ships). */
  inGrids: number;
};

export function countVoxels(world: World): VoxelCounts {
  const counts = Object.fromEntries(VOXEL_KINDS.map((kind) => [kind, 0])) as Record<VoxelKind, number>;
  const { heights, isle } = world.terrain;
  // A land column of height h holds h terrain voxels (see `worldToVoxels`).
  for (let i = 0; i < heights.length; i++) if (isle[i] !== -1) counts.terrain += heights[i]!;

  const colours = worldColours(world);
  const detail = new VoxelGrid(1 / GROUND_DETAIL);
  let before = 0;
  drawDetail(world, detail, colours, (part) => {
    const added = detail.count - before;
    before = detail.count;
    counts[part.kind === 'landmark' ? 'landmarks' : part.kind] += added;
  });
  const structure = new VoxelGrid(1 / STRUCTURE);
  drawStructures(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));
  counts.landmarks += structure.count;
  const beforeRoom = structure.count;
  drawWorldRoom(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));
  counts.houseRoom = structure.count - beforeRoom;
  const inGrids = counts.terrain + detail.count + structure.count;

  // The separate meshes: the House's lid, which lifts, and the instanced plants, boats and ships.
  if (world.landmarks.some((l) => l.id === 'house')) {
    const lid = new VoxelGrid(1 / STRUCTURE);
    drawHousePart(world, colours, 'lid', (x, y, z, colour) => lid.set(x, y, z, colour));
    counts.landmarks += lid.count;
  }
  for (const { structure } of boatsOf(world)) counts.boats += [...structureVoxels(structure)].length;
  for (const ship of world.ships) counts.ships += [...structureVoxels(vesselStructure('ship', world.biome.id, ship.kind))].length;
  for (const plant of gardenPlantsOf(world)) counts.plants += [...structureVoxels(plant.structure)].length;

  const total = VOXEL_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return { ...counts, total, inGrids };
}
