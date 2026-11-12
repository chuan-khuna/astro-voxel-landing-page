/**
 * Where a copy of an instanced structure goes (pure maths, no three.js, so
 * the World Web Worker can place Light Sources with it): its placement, the
 * pivot it turns about and its transform as a column-major 4×4 matrix.
 * `structureMeshes.ts` builds the `InstancedMesh`es from these.
 */
import type { Structure } from '@/structures';
import type { Facing } from '@/world';

/** Quarter turns that take a front (a door, a bow) drawn towards +z (south) to each facing. */
export const FACING_TURNS: Record<Facing, number> = { south: 0, east: 1, north: 2, west: 3 };

/**
 * Where one copy goes, in world units, and how many quarter turns (about +y)
 * it makes: whole turns for things that stand on a cell; a sailing ship
 * takes any fraction (its heading). A vessel on the swell also heaves, rolls
 * and pitches (`swell.ts`).
 */
export interface InstancePlacement {
  x: number;
  y: number;
  z: number;
  turns: number;
  /** World units the copy rises (a vessel on the swell); default 0. */
  heave?: number;
  /** Radians it rolls about its own length (z): its +x side rises; default 0. */
  roll?: number;
  /** Radians it pitches about its own beam (x): its bow (+z) rises; default 0. */
  pitch?: number;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** The point a structure's placements put in place and turn about: the middle of its footprint, on the ground. */
export const structurePivot = (structure: Structure): Point => ({
  x: structure.size.x / structure.scale / 2,
  y: 0,
  z: structure.size.z / structure.scale / 2,
});

/** A column-major 4×4 matrix applied to a point. */
export function transformPoint(m: readonly number[], p: Point): Point {
  return {
    x: m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!,
    y: m[1]! * p.x + m[5]! * p.y + m[9]! * p.z + m[13]!,
    z: m[2]! * p.x + m[6]! * p.y + m[10]! * p.z + m[14]!,
  };
}

/**
 * One copy's transform as a column-major 4×4 matrix: it turns the
 * structure about `pivot` (in the structure's own world units) by
 * `turns` quarter turns, then moves the pivot to the placement point. One
 * quarter turn takes +z to +x, so a door drawn on +z then faces east.
 */
export function instanceMatrix(placement: InstancePlacement, pivot: Point): number[] {
  const quarter = ((placement.turns % 4) + 4) % 4;
  // Whole quarter turns are exact; a fraction (a ship's heading) takes its cosine and sine.
  const whole = Number.isInteger(quarter);
  const c = whole ? [1, 0, -1, 0][quarter]! : Math.cos((quarter * Math.PI) / 2);
  const s = whole ? [0, 1, 0, -1][quarter]! : Math.sin((quarter * Math.PI) / 2);
  // R = yaw · roll · pitch, row-major: yaw = [[c, 0, s], [0, 1, 0], [-s, 0, c]] about +y; the
  // tilt (a vessel rocking) is in the copy's own frame, so it turns with it. No tilt: R is the yaw.
  const { roll = 0, pitch = 0, heave = 0 } = placement;
  const tilt = roll === 0 && pitch === 0 ? IDENTITY : multiply(rotationZ(roll), rotationX(-pitch));
  const r = multiply([c, 0, s, 0, 1, 0, -s, 0, c], tilt);
  // Rotated pivot: R · pivot.
  const rx = r[0]! * pivot.x + r[1]! * pivot.y + r[2]! * pivot.z;
  const ry = r[3]! * pivot.x + r[4]! * pivot.y + r[5]! * pivot.z;
  const rz = r[6]! * pivot.x + r[7]! * pivot.y + r[8]! * pivot.z;
  return [
    r[0]!, r[3]!, r[6]!, 0,
    r[1]!, r[4]!, r[7]!, 0,
    r[2]!, r[5]!, r[8]!, 0,
    placement.x - rx, placement.y + heave - ry, placement.z - rz, 1,
  ];
}

/** 3×3 matrices, row-major. */
type Matrix3 = readonly number[];
const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rotationZ = (a: number): Matrix3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const rotationX = (a: number): Matrix3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
function multiply(a: Matrix3, b: Matrix3): number[] {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
  return out;
}

