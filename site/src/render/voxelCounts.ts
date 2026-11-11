/**
 * Voxels in a World by kind, for the render stats overlay. Pure (no
 * three.js): it redraws the World's detail and structure grids the way
 * `worldToVoxels` does and tallies each part as it lands, so a voxel two
 * parts share counts once (for the part drawn first), plus the voxels of the
 * meshes that move on their own (the ships, the House's lid). The House
 * Interior is a scene of its own and never counts here.
 *
 * Run once per World shown, never per frame.
 */
import type { World } from '@/world';
import { VoxelGrid } from './mesher';
import { drawDetail, worldColours } from './worldVoxels';
import { GROUND_DETAIL, STRUCTURE } from './voxelTiers';
import { landmarkOrigin, treeExtent } from './landmarkModels';
import { drawWorldRoom } from './interiorModel';
import { drawHousePart, drawStructures } from './structureModels';
import { shipVoxels } from './vesselModels';

/** The kinds counted, in the order the overlay lists them. */
export const VOXEL_KINDS = ['terrain', 'landmarks', 'trees', 'houseRoom', 'boats', 'ships', 'buoys', 'bridges', 'stairs'] as const;
export type VoxelKind = (typeof VOXEL_KINDS)[number];

/**
 * - `terrain`: 1-unit voxels; the Landmarks' structures and the House's
 *   room are ⅛-unit voxels; every other kind is ¼-unit voxels.
 * - `landmarks`: the Landmark models and their Variants' structures (the
 *   House's base and lid, the Station, the Mailbox, the Dock's things), less
 *   the Garden's trees and the House's room.
 * - `trees`: the Garden's trees, one per Project.
 * - `houseRoom`: the House Interior's room as the World shows it, at ⅛
 *   unit (`interiorModel.ts`), the developer included.
 * - `ships`: every Partner's ship.
 */
export type VoxelCounts = Record<VoxelKind, number> & {
  /** Every kind together. */
  total: number;
  /** Voxels in the World's three meshed grids (terrain, detail and structure): all but the separately meshed moving parts. */
  inGrids: number;
};

export function countVoxels(world: World): VoxelCounts {
  const counts = Object.fromEntries(VOXEL_KINDS.map((kind) => [kind, 0])) as Record<VoxelKind, number>;
  const { heights, isle } = world.terrain;
  // A land column of height h holds h terrain voxels (see `worldToVoxels`).
  for (let i = 0; i < heights.length; i++) if (isle[i] !== -1) counts.terrain += heights[i]!;

  const colours = worldColours(world);
  const detail = new VoxelGrid(1 / GROUND_DETAIL);
  /** Voxels of the detail grid in a box of ¼ voxels (half-open). */
  const inBox = (min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }) => {
    let n = 0;
    for (let x = min.x; x < max.x; x++) for (let y = min.y; y < max.y; y++) for (let z = min.z; z < max.z; z++) if (detail.has(x, y, z)) n++;
    return n;
  };
  let before = 0;
  drawDetail(world, detail, colours, (part) => {
    const added = detail.count - before;
    before = detail.count;
    if (part.kind !== 'landmark') {
      counts[part.kind] += added;
      return;
    }
    const { landmark } = part;
    const origin = landmarkOrigin(landmark);
    const at = (v: { x: number; y: number; z: number }, scale: number) => ({
      x: origin.x + Math.round(v.x * scale),
      y: origin.y + Math.round(v.y * scale),
      z: origin.z + Math.round(v.z * scale),
    });
    let inside = 0;
    if (landmark.id === 'garden') {
      for (const tree of landmark.trees) {
        const box = treeExtent(landmark, tree);
        inside += inBox(at(box.min, GROUND_DETAIL), at(box.max, GROUND_DETAIL));
      }
      counts.trees += inside;
    }
    counts.landmarks += added - inside;
  });
  const structure = new VoxelGrid(1 / STRUCTURE);
  drawStructures(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));
  counts.landmarks += structure.count;
  const beforeRoom = structure.count;
  drawWorldRoom(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));
  counts.houseRoom = structure.count - beforeRoom;
  const inGrids = counts.terrain + detail.count + structure.count;

  // The moving parts, each its own mesh.
  if (world.landmarks.some((l) => l.id === 'house')) {
    const lid = new VoxelGrid(1 / STRUCTURE);
    drawHousePart(world, colours, 'lid', (x, y, z, colour) => lid.set(x, y, z, colour));
    counts.landmarks += lid.count;
  }
  if (world.ships.length > 0) counts.ships = shipVoxels(colours).count * world.ships.length;

  const total = VOXEL_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return { ...counts, total, inGrids };
}
