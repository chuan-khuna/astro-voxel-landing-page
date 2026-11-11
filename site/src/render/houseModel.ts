/**
 * The House (3×3 cells, so 12×12 ¼ voxels) and its room, in three parts:
 *
 * - **base**: the plinth, the floor and the two back walls (low x and low z).
 *   It stays put, so it is drawn into the World's detail grid.
 * - **lid**: the roof, the dome and the two front walls (high x and high z,
 *   the faces the isometric camera sees, with the door and windows). It is
 *   its own mesh and lifts off, which leaves the room open to the camera
 *   like a doll's house.
 * - **room**: what stands in `HOUSE_INTERIOR`, the space the base and lid
 *   leave empty: a desk, a computer, a chair and the developer's seated
 *   body. The developer's head and hands are moving parts
 *   (`DEVELOPER_PARTS`), each its own small mesh.
 *
 * All coordinates are the House's local ¼ voxels: the origin is the min
 * corner of its footprint, local y = 0 the first voxel above the ground.
 * Pure (no three.js). Every House Variant to come (ADR 0004) keeps this
 * split: a liftable lid and the same interior space.
 */
import type { BiomeColourRole } from '../world';
import type { FixedColour } from './palette';

/** Draws ¼ voxels: `box` fills [x0, x1) × [y0, y1) × [z0, z1). */
export interface HouseDraw {
  box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number | null) => void;
  set: (x: number, y: number, z: number, colour: number) => void;
}

/** Colour ids, as `WorldColours` hands them out. */
export interface HouseColours {
  fixed: (name: FixedColour) => number;
  biome: (role: BiomeColourRole, dl?: number) => number;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

/** A box of ¼ voxels: [min, max) on each axis. */
export interface VoxelBox {
  min: Point;
  max: Point;
}

/** The House's footprint in ¼ voxels. */
export const HOUSE_SIZE = { w: 12, d: 12 } as const;

/** The room's space, inside the walls and under the roof. */
export const HOUSE_INTERIOR: VoxelBox = { min: { x: 2, y: 1, z: 2 }, max: { x: 10, y: 9, z: 10 } };

/** How high the lid lifts when the House opens, in world units: clear of the room as the camera sees it. */
export const ROOF_LIFT = 6;

/**
 * The computer's screen: a rectangle on the plane `x = SCREEN.x` (the
 * computer's front face, facing +x, towards the camera), spanning y0–y1 and
 * z0–z1. It is drawn as its own glowing plane that scrolls code.
 */
export const SCREEN = { x: 3, y0: 6.1, y1: 8.85, z0: 2.15, z1: 5.85 } as const;

const { w, d } = HOUSE_SIZE;
const { min: inner, max: outer } = HOUSE_INTERIOR;
/** Walls stand one ¼ voxel in from the plinth's edge, one ¼ voxel thick. */
const WALL_LO = inner.x - 1;
const WALL_HI = outer.x;
const ROOF_Y = outer.y;

/** Plinth, floor (with a rug under the chair) and the two back walls (low x, low z). */
export function drawHouseBase({ box, set }: HouseDraw, { fixed }: HouseColours): void {
  box(0, 0, 0, w, 1, d, fixed('plinth'));
  box(inner.x, 0, inner.z, outer.x, 1, outer.z, fixed('floorWood'));
  box(5, 0, 5, 9, 1, 9, fixed('rug'));
  // The back walls, corner to corner; the two outer corners belong to the lid.
  box(WALL_LO, 1, WALL_LO, WALL_LO + 1, ROOF_Y, WALL_HI, fixed('whitewash'));
  box(WALL_LO + 1, 1, WALL_LO, WALL_HI, ROOF_Y, WALL_LO + 1, fixed('whitewash'));
  // A window in each back wall, seen from inside.
  box(WALL_LO, 5, 6, WALL_LO + 1, 7, 8, fixed('glass'));
  box(6, 5, WALL_LO, 8, 7, WALL_LO + 1, fixed('glass'));
  set(WALL_LO, 7, 8, fixed('bougainvillea'));
}

/** Roof, dome and the two front walls (high x, high z) with the door and windows. */
export function drawHouseLid({ box, set }: HouseDraw, { fixed }: HouseColours): void {
  box(WALL_HI, 1, WALL_LO, WALL_HI + 1, ROOF_Y, WALL_HI + 1, fixed('whitewash'));
  box(WALL_LO, 1, WALL_HI, WALL_HI, ROOF_Y, WALL_HI + 1, fixed('whitewash'));
  box(0, ROOF_Y, 0, w, ROOF_Y + 1, d, fixed('roofWhite'));
  const mid = Math.floor(w / 2);
  box(mid - 1, 1, WALL_HI, mid + 1, 6, WALL_HI + 1, fixed('blueDoor'));
  for (const z of [2, d - 4]) box(WALL_HI, 5, z, WALL_HI + 1, 7, z + 2, fixed('glass'));
  box(2, 5, WALL_HI, 4, 7, WALL_HI + 1, fixed('glass'));
  box(mid - 2, ROOF_Y + 1, Math.floor(d / 2) - 2, mid + 2, ROOF_Y + 3, Math.floor(d / 2) + 2, fixed('blueTrim'));
  box(mid - 1, ROOF_Y + 3, Math.floor(d / 2) - 1, mid + 1, ROOF_Y + 4, Math.floor(d / 2) + 1, fixed('blueTrim'));
  // Bougainvillea climbing the front corner.
  set(WALL_LO, 6, WALL_HI, fixed('bougainLight'));
  set(WALL_LO, 7, WALL_HI, fixed('bougainvillea'));
  set(WALL_LO, 8, WALL_HI, fixed('bougainvillea'));
}

/**
 * The room: a desk along the back-left wall with a computer facing into the
 * room, a chair, a plant and the developer's seated body (facing the
 * computer, so the camera looks over their shoulder at the screen).
 */
export function drawHouseRoom({ box, set }: HouseDraw, { fixed, biome }: HouseColours): void {
  // Desk: a top along the wall, on a drawer block and a leg.
  box(2, 4, 2, 5, 5, 9, fixed('desk'));
  box(2, 1, 2, 5, 4, 4, fixed('desk'));
  box(2, 1, 8, 3, 4, 9, fixed('desk'));
  // The computer, as tall as the room allows, its screen face at x = SCREEN.x.
  box(2, 5, 2, SCREEN.x, 9, 6, fixed('screenDark'));
  set(4, 5, 3, fixed('whitewash')); // a mug
  // The chair.
  set(6, 1, 6, fixed('chair'));
  box(5, 2, 5, 8, 3, 9, fixed('chair'));
  box(7, 3, 5, 8, 4, 9, fixed('chair'));
  // The developer's body: shins under the desk, thighs, torso and arms on the desk.
  box(4, 1, 6, 5, 3, 8, fixed('trousers'));
  box(4, 3, 6, 6, 4, 8, fixed('trousers'));
  box(5, 4, 6, 7, 6, 8, fixed('shirt'));
  box(5, 4, 5, 6, 6, 6, fixed('shirt'));
  box(5, 4, 8, 6, 6, 9, fixed('shirt'));
  box(4, 5, 5, 5, 6, 6, fixed('shirt'));
  box(4, 5, 8, 5, 6, 9, fixed('shirt'));
  // A plant in the back-right corner.
  box(8, 1, 2, 10, 3, 4, fixed('trunk'));
  box(8, 3, 2, 10, 5, 4, biome('foliage'));
  set(9, 5, 2, biome('foliage', 0.04));
}

/** The developer's moving parts, each its own mesh. */
export const DEVELOPER_PARTS = ['head', 'leftHand', 'rightHand'] as const;
export type DeveloperPart = (typeof DEVELOPER_PARTS)[number];

/** Each moving part at rest, in the House's local ¼ voxels. */
export function drawDeveloperPart(part: DeveloperPart, { box }: HouseDraw, { fixed }: HouseColours): void {
  if (part === 'head') {
    box(5, 6, 6, 7, 8, 8, fixed('skin'));
    box(6, 6, 6, 7, 8, 8, fixed('hair')); // the back of the head
    box(5, 8, 6, 7, 9, 8, fixed('hair'));
  } else {
    box(3, 5, part === 'leftHand' ? 5 : 8, 4, 6, part === 'leftHand' ? 6 : 9, fixed('skin'));
  }
}

/** The box round the developer (body, head and hands), for their link. */
export function developerExtent(): VoxelBox {
  return { min: { x: 3, y: 1, z: 5 }, max: { x: 7, y: 9, z: 9 } };
}
