/**
 * Clouds (ADR 0005): slightly translucent masses of 1-unit voxels drifting
 * down the wind high over the sea round the Isles. Worked out once the
 * layout is done, from a sequence of the Seed's own (`<seed>/clouds`), so
 * they never move the layout.
 *
 * Each cloud's shape is generated from the Seed: a box 3–8 units long (down
 * the wind), 2–5 wide and 2–3 high, its underside the biggest layer and
 * each layer above a smaller lump of the one below.
 *
 * Rules, every one held by `generateWorld`'s tests:
 * - a cloud floats at least `CLOUD_LIFT` units above the tallest Landmark;
 * - its drift runs down the wind, `DRIFT_LENGTH` long, at `DRIFT_SPEED`;
 * - all the way along its drift its body is over the sea: never over an
 *   Isle (straight down), nor between the camera and one (down the
 *   isometric view ray, −(1, 1, 1), from its top to the ground), with a
 *   cell of sea to spare;
 * - it is seen within reach of the Overview (`REACH` × its radius);
 * - clouds keep apart, and a World has at most `MAX_CLOUDS`.
 *
 * Their shadows are not placed here: they drift across the whole World in
 * the shader (`render/cloudShadow.ts`).
 */
import { LANDMARK_HEIGHT } from './landmarks';
import { createRng } from './prng';
import type { Cloud, PlacedLandmark, Terrain, View, Wind } from './types';

/** The most clouds a World has. */
export const MAX_CLOUDS = 8;
/** Units a cloud's underside floats above the tallest Landmark's top, at least (and up to 2 more). */
const CLOUD_LIFT = 2;
/** Units a cloud drifts from start to end: least and most. */
const DRIFT_LENGTH = [6, 14] as const;
/** Units a cloud drifts a second: least and most. */
const DRIFT_SPEED = [0.2, 0.4] as const;
/** Clouds are seen (their middle, down the view ray) within this many Overview radii of its centre. */
const REACH = 1.45;
/** Clouds' drift lines keep this far apart across the wind, unless they are this far apart along it. */
const APART_ACROSS = 4;
const APART_ALONG = 6;
/** Cloud placements tried per World. */
const TRIES = 300;

type Rng = () => number;

/** Place the World's clouds over the sea round its Isles. */
export function placeClouds(seed: string, terrain: Terrain, landmarks: PlacedLandmark[], overview: View, wind: Wind): Cloud[] {
  const rng = createRng(`${seed}/clouds`);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const { direction } = wind;
  const tallest = Math.max(...landmarks.map((l) => l.y + LANDMARK_HEIGHT[l.id]));
  // Every cell a cloud may reach: the Overview's reach, lifted as high as a cloud floats, and a drift.
  const pad = Math.ceil(Math.max(...[overview.target.x, overview.target.z].map(Math.abs)) + overview.radius * REACH + tallest + CLOUD_LIFT + 5 + DRIFT_LENGTH[1] + 10);
  const blocked = viewBlocked(terrain, pad);

  const clouds: Cloud[] = [];
  /** Each placed cloud's drift line: its middle, and its half-length. */
  const lines: Array<{ x: number; z: number; half: number }> = [];
  for (let attempt = 0; attempt < TRIES && clouds.length < MAX_CLOUDS; attempt++) {
    const { voxels, size } = cloudShape(rng, Math.abs(direction.x) > Math.abs(direction.z));
    const base = tallest + CLOUD_LIFT + rng() * 2;
    const top = base + size.y;
    const length = between(DRIFT_LENGTH[0], DRIFT_LENGTH[1]);
    const speed = between(DRIFT_SPEED[0], DRIFT_SPEED[1]);
    const phase = rng();
    // Where its middle is seen on the ground: anywhere within reach of the Overview.
    const angle = rng() * 2 * Math.PI;
    const r = Math.sqrt(rng()) * overview.radius * REACH;
    const seen = { x: overview.target.x + Math.cos(angle) * r, z: overview.target.z + Math.sin(angle) * r };
    const lift = base + size.y / 2;
    const mid = { x: seen.x + lift - size.x / 2, z: seen.z + lift - size.z / 2 };
    const from = { x: mid.x - (direction.x * length) / 2, z: mid.z - (direction.z * length) / 2 };
    const to = { x: mid.x + (direction.x * length) / 2, z: mid.z + (direction.z * length) / 2 };

    const apart = lines.every((l) => {
      const dx = mid.x - l.x;
      const dz = mid.z - l.z;
      const alongGap = Math.abs(dx * direction.x + dz * direction.z) - l.half - length / 2;
      const acrossGap = Math.abs(dx * direction.z - dz * direction.x);
      return acrossGap >= APART_ACROSS + Math.max(size.x, size.z) || alongGap >= APART_ALONG;
    });
    if (!apart) continue;

    const columns = [...new Map(voxels.map((v) => [`${v.x},${v.z}`, v])).values()];
    const steps = Math.ceil(length / 0.25);
    let clear = true;
    for (let i = 0; i <= steps && clear; i++) {
      const u = i / steps;
      const ax = from.x + (to.x - from.x) * u;
      const az = from.z + (to.z - from.z) * u;
      for (const v of columns) {
        const cx = Math.floor(ax + v.x);
        const cz = Math.floor(az + v.z);
        if (blocked(cx, cz, top) || blocked(cx + 1, cz, top) || blocked(cx, cz + 1, top) || blocked(cx + 1, cz + 1, top)) {
          clear = false;
          break;
        }
      }
    }
    if (!clear) continue;
    clouds.push({ voxels, size, base, from, to, period: length / speed, phase });
    lines.push({ x: mid.x, z: mid.z, half: length / 2 });
  }
  return clouds;
}

/**
 * Whether a unit column standing on cell (`cx`, `cz`) up to height `top`
 * would be over land with a cell of sea to spare, straight down or down the
 * view ray: the column shifted by every s in [0, top] towards (−1, −1)
 * covers cells (cx − k − a, cz − k − b), k from 0 to ⌈top⌉, a and b 0 or 1.
 *
 * Worked out once for every cell within `pad` of the grid: how far down the
 * ray the nearest such land is (k), each cell from the one diagonally before
 * it. A cell past the pad counts as blocked, so no cloud goes there.
 */
function viewBlocked(terrain: Terrain, pad: number): (cx: number, cz: number, top: number) => boolean {
  const { width, depth, isle } = terrain;
  // Land, or a cell beside it (8 neighbours), on the grid and a ring of one round it.
  const nw = width + 2;
  const nd = depth + 2;
  const near = new Uint8Array(nw * nd);
  for (let z = 0; z < depth; z++)
    for (let x = 0; x < width; x++)
      if (isle[z * width + x] !== -1) for (let dz = 0; dz <= 2; dz++) for (let dx = 0; dx <= 2; dx++) near[(z + dz) * nw + x + dx] = 1;
  const nearLand = (x: number, z: number) => x >= -1 && z >= -1 && x <= width && z <= depth && near[(z + 1) * nw + x + 1] === 1;

  const lo = -pad;
  const span = Math.max(width, depth) + 2 * pad;
  const first = new Float64Array(span * span);
  for (let j = 0; j < span; j++) {
    for (let i = 0; i < span; i++) {
      const cx = lo + i;
      const cz = lo + j;
      const here = nearLand(cx, cz) || nearLand(cx - 1, cz) || nearLand(cx, cz - 1) || nearLand(cx - 1, cz - 1);
      first[j * span + i] = here ? 0 : i > 0 && j > 0 ? first[(j - 1) * span + i - 1]! + 1 : Infinity;
    }
  }
  return (cx, cz, top) => {
    const i = cx - lo;
    const j = cz - lo;
    if (i < 0 || j < 0 || i >= span || j >= span) return true;
    return first[j * span + i]! <= Math.ceil(top);
  };
}

/**
 * A cloud's shape from the Seed: its underside a rectangle 3–8 long and 2–5
 * wide (corners cut on bigger ones), each layer above a smaller lump of the
 * one below, 2–3 layers. Long along x, or along z when `alongX` is false.
 */
function cloudShape(rng: Rng, alongX: boolean): Pick<Cloud, 'voxels' | 'size'> {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const long = int(3, 8);
  const wide = int(2, Math.min(5, long));
  const high = int(2, 3);
  const cells: Array<{ u: number; y: number; w: number }> = [];
  let layer = new Set<string>();
  for (let u = 0; u < long; u++) for (let w = 0; w < wide; w++) layer.add(`${u},${w}`);
  if (long >= 4 && wide >= 3) {
    for (const [u, w] of [[0, 0], [long - 1, 0], [0, wide - 1], [long - 1, wide - 1]] as const) if (rng() < 0.6) layer.delete(`${u},${w}`);
  }
  let box = { u0: 0, u1: long, w0: 0, w1: wide };
  for (let y = 0; y < high; y++) {
    if (y > 0) {
      const ul = Math.max(1, box.u1 - box.u0 - 1 - int(0, 2));
      const wl = Math.max(1, box.w1 - box.w0 - int(0, 1));
      const u0 = box.u0 + int(0, box.u1 - box.u0 - ul);
      const w0 = box.w0 + int(0, box.w1 - box.w0 - wl);
      box = { u0, u1: u0 + ul, w0, w1: w0 + wl };
      const next = new Set<string>();
      for (let u = box.u0; u < box.u1; u++) for (let w = box.w0; w < box.w1; w++) if (layer.has(`${u},${w}`)) next.add(`${u},${w}`);
      // A lump that fell only on a cut corner: keep one voxel of the layer below.
      if (next.size === 0) next.add([...layer][0]!);
      layer = next;
    }
    for (const k of layer) {
      const [u, w] = k.split(',').map(Number) as [number, number];
      cells.push({ u, y, w });
    }
  }
  const voxels = cells.map(({ u, y, w }) => (alongX ? { x: u, y, z: w } : { x: w, y, z: u }));
  const size = alongX ? { x: long, y: high, z: wide } : { x: wide, y: high, z: long };
  return { voxels, size };
}
