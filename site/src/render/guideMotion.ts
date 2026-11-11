/**
 * Where the Guide floats and how it moves, as pure functions: no three.js,
 * so they are tested directly; `guide.ts` applies them to meshes.
 *
 * - `guideSpot(world, id)`: a spot beside a placed Landmark, as the
 *   isometric camera sees it, clear of every Landmark on screen and of the
 *   ground under it. The Guide idles at the Station's spot; the Tour can
 *   send it to any other.
 * - `voxelFlights` / `flightPoint`: the voxels flying in to assemble the
 *   Guide (and, played backwards, flying off as it dissolves).
 * - `hoverPose(seconds)`: the idle bob; `blinking(seconds)`: when it blinks.
 */
import type { PlacedLandmarkId, Vec3, World } from '@/world';
import { landmarkExtent } from './landmarkModels';

/**
 * Half the Guide's size on screen, in world units, with its bob: what must
 * stay clear round its spot.
 */
export const GUIDE_REACH = 1.3;
/** Space between the Guide and its Landmark on screen, in world units. */
const GAP = 0.4;
/** How far the Guide floats above its Landmark's ground, at its middle. */
const HOVER_HEIGHT = 1.75;
/** The extra cost of the left side over the right, in world units of distance. */
const LEFT_COST = 0.5;
/** How far past the preferred spot the search for a clear one goes, and its step, in world units on screen. */
const SEARCH = 2.2;
const STEP = 0.25;

interface ScreenBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

const SQRT6 = Math.sqrt(6);

/** A world point on the isometric screen (world units, y up). The camera looks along −(1, 1, 1). */
const toScreen = (x: number, y: number, z: number) => ({ x: (x - z) / Math.SQRT2, y: (2 * y - x - z) / SQRT6 });

function screenBox(world: World, id: PlacedLandmarkId): ScreenBox {
  const landmark = world.landmarks.find((l) => l.id === id);
  if (!landmark) throw new Error(`World ${world.seed} has no ${id}`);
  const { min, max } = landmarkExtent(landmark);
  const { origin } = landmark.footprint;
  const box = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
  for (let i = 0; i < 8; i++) {
    const p = toScreen(
      origin.x + (i & 1 ? max.x : min.x),
      landmark.y + (i & 2 ? max.y : min.y),
      origin.z + (i & 4 ? max.z : min.z),
    );
    box.left = Math.min(box.left, p.x);
    box.right = Math.max(box.right, p.x);
    box.bottom = Math.min(box.bottom, p.y);
    box.top = Math.max(box.top, p.y);
  }
  return box;
}

/**
 * Where the Guide floats beside a placed Landmark, so it never stands in
 * front of any Landmark on screen: the clear spot nearest its preferred
 * one, just right of the Landmark on screen and level with its middle
 * (the left side costs a little more; a crowded corner, like the Mailbox's
 * by the House and Garden, may push it higher, lower or over the top).
 * If nothing near is clear (rare: a Mailbox tucked in front of its House),
 * it takes the preferred spot anyway. Then it moves along the line of
 * sight, towards the camera, until the ground under it is well below it:
 * that keeps its place on screen.
 */
export function guideSpot(world: World, id: PlacedLandmarkId): Vec3 {
  const landmark = world.landmarks.find((l) => l.id === id)!;
  const own = screenBox(world, id);
  const boxes = world.landmarks.map((l) => screenBox(world, l.id));
  const clear = (x: number, y: number) =>
    boxes.every(
      (b) => x - GUIDE_REACH >= b.right || x + GUIDE_REACH <= b.left || y - GUIDE_REACH >= b.top || y + GUIDE_REACH <= b.bottom,
    );
  const right = own.right + GAP + GUIDE_REACH;
  const left = own.left - GAP - GUIDE_REACH;
  const level = Math.max((own.bottom + own.top) / 2, own.bottom + GUIDE_REACH);
  /** How far a spot is from the preferred one; the left side costs a little more. */
  const cost = (x: number, y: number) =>
    Math.min(Math.abs(x - right), Math.abs(x - left) + LEFT_COST) + Math.abs(y - level);
  let at = { x: right, y: level };
  let best = Infinity;
  for (let x = left - SEARCH; x <= right + SEARCH; x += STEP) {
    for (let y = own.bottom; y <= own.top + GAP + GUIDE_REACH + SEARCH; y += STEP) {
      const c = cost(x, y);
      if (c < best && clear(x, y)) {
        best = c;
        at = { x, y };
      }
    }
  }

  // The world point at that screen spot with the Guide's middle HOVER_HEIGHT over the Landmark's ground.
  let y = landmark.y + HOVER_HEIGHT;
  const sum = 2 * y - SQRT6 * at.y;
  const diff = Math.SQRT2 * at.x;
  let x = (sum + diff) / 2;
  let z = (sum - diff) / 2;
  const { width, depth, heights } = world.terrain;
  const ground = (cx: number, cz: number) => (cx >= 0 && cz >= 0 && cx < width && cz < depth ? heights[cz * width + cx]! : 0);
  const aboveGround = () => {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (y - GUIDE_REACH <= ground(Math.floor(x) + dx, Math.floor(z) + dz)) return false;
      }
    }
    return true;
  };
  for (let step = 0; step < 80 && !aboveGround(); step++) {
    x += 0.25;
    y += 0.25;
    z += 0.25;
  }
  return { x, y, z };
}

/** One voxel's flight in to its place in the Guide (model space, world units). */
export interface VoxelFlight {
  from: Vec3;
  to: Vec3;
  /** When it sets off, as a share of the whole assembly (0 to `MAX_DELAY`). */
  delay: number;
}

/** The last voxel sets off this far into the assembly. */
const MAX_DELAY = 0.45;
/** How high a voxel's path arcs over the straight line, in world units. */
const ARC = 1.2;

/** A fixed pseudo-random number in [0, 1) for voxel `i`, draw `k`. */
const noise = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A flight for each voxel: from a scattered spot below and round the Guide
 * (as if it gathered itself from the World) to its place, setting off in
 * turn from the bottom up. The same voxels always fly the same way.
 */
export function voxelFlights(targets: readonly Vec3[]): VoxelFlight[] {
  const lowest = Math.min(...targets.map((t) => t.y));
  const highest = Math.max(...targets.map((t) => t.y));
  const span = Math.max(1e-6, highest - lowest);
  return targets.map((to, i) => {
    const angle = noise(i, 1) * Math.PI * 2;
    const reach = 2.5 + noise(i, 2) * 2;
    const height = (to.y - lowest) / span;
    return {
      from: { x: to.x + Math.cos(angle) * reach, y: to.y - 1.5 - noise(i, 3) * 2, z: to.z + Math.sin(angle) * reach },
      to,
      delay: MAX_DELAY * Math.min(1, 0.6 * height + 0.4 * noise(i, 4)),
    };
  });
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Where a voxel is, and how big (0 to 1), `t` of the way (0 to 1) through
 * the assembly: unseen at its start, growing as it flies an arc, at full size
 * in its place once it lands.
 */
export function flightPoint(flight: VoxelFlight, t: number): Vec3 & { scale: number } {
  const p = clamp01((t - flight.delay) / (1 - MAX_DELAY));
  if (p >= 1) return { ...flight.to, scale: 1 };
  const e = easeOut(p);
  const { from, to } = flight;
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e + Math.sin(Math.PI * e) * ARC,
    z: from.z + (to.z - from.z) * e,
    scale: Math.min(1, p * 4),
  };
}

/** The idle bob: one rise and fall every BOB seconds; a slow turn either way every SWAY. */
const BOB = 2.6;
const SWAY = 7;

/** The Guide's offset from its spot while it idles: up and down (world units) and a slight turn (radians). */
export function hoverPose(seconds: number): { y: number; yaw: number } {
  return {
    y: 0.1 * Math.sin((2 * Math.PI * seconds) / BOB),
    yaw: 0.08 * Math.sin((2 * Math.PI * seconds) / SWAY),
  };
}

/** A blink: shut for BLINK seconds at the end of every BLINK_EVERY. */
const BLINK = 0.15;
const BLINK_EVERY = 4.2;

/** Whether the Guide's eyes are shut `seconds` into its idling. */
export function blinking(seconds: number): boolean {
  const t = ((seconds % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY;
  return t >= BLINK_EVERY - BLINK;
}
