/**
 * Where a Partner's ship is on its loop: the loop's cells smoothed into a
 * closed path through their centres, and the ship's position and heading at
 * any distance along it. Pure maths, no three.js.
 */
import type { Cell } from '../world';

/** A closed path in world units (x, z), with its total length. */
export interface SailingPath {
  points: Array<{ x: number; z: number }>;
  /** `along[i]`: distance from `points[0]` to `points[i]`; `along[n]` is the whole loop. */
  along: number[];
  length: number;
}

/** A ship's place on its path: position (world x, z) and heading in radians (0 is +x, π/2 is +z). */
export interface ShipPose {
  x: number;
  z: number;
  heading: number;
}

/** Corner-cutting rounds: each halves the sharpness of every turn. */
const SMOOTHING = 3;
/** The heading looks this far ahead and behind, in world units, so turns ease in. */
const HEADING_REACH = 0.35;

/** Smooth a loop of cells into a closed path through their centres (Chaikin corner cutting). */
export function sailingPath(cells: readonly Cell[]): SailingPath {
  let points = cells.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
  for (let round = 0; round < SMOOTHING; round++) {
    points = points.flatMap((p, i) => {
      const q = points[(i + 1) % points.length]!;
      return [
        { x: 0.75 * p.x + 0.25 * q.x, z: 0.75 * p.z + 0.25 * q.z },
        { x: 0.25 * p.x + 0.75 * q.x, z: 0.25 * p.z + 0.75 * q.z },
      ];
    });
  }
  const along = [0];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    along.push(along[i]! + Math.hypot(q.x - p.x, q.z - p.z));
  }
  return { points, along, length: along[points.length]! };
}

/** The point `distance` along the path, wrapping round it either way. */
function pointAt(path: SailingPath, distance: number): { x: number; z: number } {
  const { points, along, length } = path;
  const s = ((distance % length) + length) % length;
  // Binary search for the segment holding s.
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (along[mid]! <= s) lo = mid;
    else hi = mid - 1;
  }
  const p = points[lo]!;
  const q = points[(lo + 1) % points.length]!;
  const span = along[lo + 1]! - along[lo]!;
  const t = span > 0 ? (s - along[lo]!) / span : 0;
  return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t };
}

/** The ship's pose `distance` along its path. */
export function shipPose(path: SailingPath, distance: number): ShipPose {
  const { x, z } = pointAt(path, distance);
  const ahead = pointAt(path, distance + HEADING_REACH);
  const behind = pointAt(path, distance - HEADING_REACH);
  return { x, z, heading: Math.atan2(ahead.z - behind.z, ahead.x - behind.x) };
}
