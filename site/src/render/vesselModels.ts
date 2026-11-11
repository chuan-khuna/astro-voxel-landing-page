/**
 * The Clients' boats and the Partners' ships, in ¼-unit voxels. Simple
 * code-built models for now: every Client gets the same boat and every
 * Partner the same ship.
 *
 * - A boat fills most of its berth cell, from the sea floor up, its bow
 *   towards its facing. Boats are static, so they are drawn into the World's
 *   detail grid with the terrain's Landmarks.
 * - A ship is its own small grid, about two cells long and one wide and
 *   three times a boat's height, centred on `SHIP_ORIGIN` with its bow
 *   towards +x. Ships sail, so each is a mesh of its own that moves.
 */
import type { Boat } from '../world';
import { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

/** A boat's size in ¼ voxels: length (bow to stern) and beam. */
const BOAT_LENGTH = 4;
const BOAT_BEAM = 3;

/** Draw a Client's boat in its berth: a red hull round an open plank deck, a white bow cap and a white seat amidships. */
export function drawBoat(boat: Boat, grid: VoxelGrid, { fixed }: WorldColours): void {
  const { cell, facing } = boat;
  // Local u runs stern (0) to bow (BOAT_LENGTH − 1); v across the beam, one voxel in from the cell's edge.
  const put = (u: number, y: number, v: number, colour: number) => {
    const back = BOAT_LENGTH - 1 - u;
    const [dx, dz] =
      facing === 'east' ? [u, v + 1] : facing === 'west' ? [back, v + 1] : facing === 'south' ? [v + 1, u] : [v + 1, back];
    grid.set(cell.x * GROUND_DETAIL + dx, y, cell.z * GROUND_DETAIL + dz, colour);
  };
  const bowCorner = (u: number, v: number) => u === BOAT_LENGTH - 1 && v !== 1;
  for (let u = 0; u < BOAT_LENGTH; u++) {
    for (let v = 0; v < BOAT_BEAM; v++) {
      if (bowCorner(u, v)) continue;
      const deck = v === 1 && u > 0 && u < BOAT_LENGTH - 1;
      put(u, 0, v, deck ? fixed('plank') : fixed('hullRed'));
      if (!deck) put(u, 1, v, u === BOAT_LENGTH - 1 ? fixed('whitewash') : fixed('hullRed'));
    }
  }
  // A white seat amidships.
  put(1, 1, 1, fixed('whitewash'));
}

/** Ship size in ¼ voxels. */
const SHIP_LENGTH = 8;
const SHIP_BEAM = 4;

/** The middle of the ship's waterline, in its grid's ¼ voxels: the point it turns about. */
export const SHIP_ORIGIN = { x: SHIP_LENGTH / 2, y: 0, z: SHIP_BEAM / 2 } as const;

/**
 * A Partner's ship: a navy hull with a pale gunwale and a raised bow, a plank
 * deck, a cabin at the stern, and a mast with a square sail and an accent
 * pennant. Bow towards +x.
 */
export function shipVoxels({ fixed, biome }: WorldColours): VoxelGrid {
  const grid = new VoxelGrid(1 / GROUND_DETAIL);
  const bowCorner = (u: number, v: number) => u === SHIP_LENGTH - 1 && (v === 0 || v === SHIP_BEAM - 1);
  for (let u = 0; u < SHIP_LENGTH; u++) {
    for (let v = 0; v < SHIP_BEAM; v++) {
      if (bowCorner(u, v)) continue;
      grid.set(u, 0, v, fixed('hullNavy'));
      const edge = u === 0 || v === 0 || v === SHIP_BEAM - 1 || u >= SHIP_LENGTH - 2;
      grid.set(u, 1, v, edge ? fixed('hullNavy') : fixed('plank'));
      if (edge) grid.set(u, 2, v, fixed('whitewash'));
    }
  }
  // The cabin at the stern, with a window facing the bow, and its roof.
  grid.box(1, 2, 1, 3, 4, 3, fixed('whitewash'));
  grid.set(2, 3, 1, fixed('glass'));
  grid.set(2, 3, 2, fixed('glass'));
  grid.box(0, 4, 1, 3, 5, 3, fixed('metalDark'));
  // The mast, a square sail before it, and a pennant on top.
  grid.box(4, 2, 1, 5, 10, 2, fixed('trunk'));
  grid.box(5, 4, 0, 6, 9, SHIP_BEAM, fixed('sail'));
  grid.set(4, 10, 1, biome('accent'));
  return grid;
}
