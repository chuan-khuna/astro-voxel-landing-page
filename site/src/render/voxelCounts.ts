/**
 * Voxels in a World by kind, for the render stats overlay. Pure (no
 * three.js): it redraws the World's detail grid the way `worldToVoxels`
 * does and tallies each part as it lands, so a voxel two parts share counts
 * once (for the part drawn first), plus the voxels of the meshes that move
 * on their own (the ships, the House's lid, the developer's head and hands).
 *
 * Run once per World shown, never per frame.
 */
import type { World } from '@/world';
import { VoxelGrid } from './mesher';
import { DETAIL, drawDetail, worldColours } from './worldVoxels';
import { landmarkOrigin, treeExtent } from './landmarkModels';
import { DEVELOPER_PARTS, HOUSE_INTERIOR, drawDeveloperPart, drawHouseLid, type HouseDraw } from './houseModel';
import { shipVoxels } from './vesselModels';

/** The kinds counted, in the order the overlay lists them. */
export const VOXEL_KINDS = ['terrain', 'landmarks', 'trees', 'houseRoom', 'boats', 'ships', 'buoys', 'bridges', 'stairs'] as const;
export type VoxelKind = (typeof VOXEL_KINDS)[number];

/**
 * - `terrain`: 1-unit voxels; every other kind is ¼-unit voxels.
 * - `landmarks`: the Landmark models, the House's base and lid included,
 *   less the Garden's trees and the House's room.
 * - `trees`: the Garden's trees, one per Project.
 * - `houseRoom`: everything inside the House's room (`HOUSE_INTERIOR`),
 *   the developer's moving head and hands included.
 * - `ships`: every Partner's ship.
 */
export type VoxelCounts = Record<VoxelKind, number> & {
  /** Every kind together. */
  total: number;
  /** Voxels in the World's two meshed grids (terrain and detail): all but the separately meshed moving parts. */
  inGrids: number;
};

export function countVoxels(world: World): VoxelCounts {
  const counts = Object.fromEntries(VOXEL_KINDS.map((kind) => [kind, 0])) as Record<VoxelKind, number>;
  const { heights, isle } = world.terrain;
  // A land column of height h holds h terrain voxels (see `worldToVoxels`).
  for (let i = 0; i < heights.length; i++) if (isle[i] !== -1) counts.terrain += heights[i]!;

  const colours = worldColours(world);
  const detail = new VoxelGrid(1 / DETAIL);
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
        inside += inBox(at(box.min, DETAIL), at(box.max, DETAIL));
      }
      counts.trees += inside;
    } else if (landmark.id === 'house') {
      inside = inBox(at(HOUSE_INTERIOR.min, 1), at(HOUSE_INTERIOR.max, 1));
      counts.houseRoom += inside;
    }
    counts.landmarks += added - inside;
  });
  const inGrids = counts.terrain + detail.count;

  // The moving parts, each its own mesh.
  const partCount = (paint: (draw: HouseDraw) => void) => {
    const grid = new VoxelGrid(1 / DETAIL);
    paint({ box: (...args) => grid.box(...args), set: (...args) => grid.set(...args) });
    return grid.count;
  };
  if (world.landmarks.some((l) => l.id === 'house')) {
    counts.landmarks += partCount((draw) => drawHouseLid(draw, colours));
    for (const part of DEVELOPER_PARTS) counts.houseRoom += partCount((draw) => drawDeveloperPart(part, draw, colours));
  }
  if (world.ships.length > 0) counts.ships = shipVoxels(colours).count * world.ships.length;

  const total = VOXEL_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return { ...counts, total, inGrids };
}
