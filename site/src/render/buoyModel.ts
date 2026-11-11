/**
 * A buoy, in ¼-unit voxels: a red float with a white band, a short post and
 * a lamp on top, a unit tall from the sea floor, in the middle of its cell.
 * Buoys are static, so they are drawn into the World's detail grid; at Night
 * a glowing box over the lamp (`buoyLamp`) lights it. Pure (no three.js).
 */
import type { Cell } from '../world';
import type { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

/** The float's two-by-two ¼ voxels start this far into the cell, and the post and lamp stand here. */
const FLOAT = 1;
const POST = 2;

export function drawBuoy(cell: Cell, grid: VoxelGrid, { fixed }: WorldColours): void {
  const x = cell.x * GROUND_DETAIL;
  const z = cell.z * GROUND_DETAIL;
  grid.box(x + FLOAT, 0, z + FLOAT, x + FLOAT + 2, 1, z + FLOAT + 2, fixed('flagRed'));
  grid.box(x + FLOAT, 1, z + FLOAT, x + FLOAT + 2, 2, z + FLOAT + 2, fixed('sail'));
  grid.set(x + POST, 2, z + POST, fixed('metalDark'));
  grid.set(x + POST, 3, z + POST, fixed('lamp'));
}

/** The lamp's box in world units: what glows at Night. */
export function buoyLamp(cell: Cell): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
  const q = 1 / GROUND_DETAIL;
  const x = cell.x * GROUND_DETAIL + POST;
  const z = cell.z * GROUND_DETAIL + POST;
  return {
    min: { x: x * q, y: 3 * q, z: z * q },
    max: { x: (x + 1) * q, y: 4 * q, z: (z + 1) * q },
  };
}
