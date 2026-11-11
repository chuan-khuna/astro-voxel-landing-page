import type { Bridge, Cell, Facing, Stair, Terrain } from './types';

const STEPS: ReadonlyArray<{ dx: number; dz: number; facing: Facing }> = [
  { dx: 1, dz: 0, facing: 'east' },
  { dx: 0, dz: 1, facing: 'south' },
  { dx: -1, dz: 0, facing: 'west' },
  { dx: 0, dz: -1, facing: 'north' },
];
/** Extra cost of a one-step climb, so paths prefer level ground and take few stairs. */
const CLIMB_COST = 3;

/**
 * The cheapest walkable route from `from` to `to` over land and bridges.
 * A step may change height by at most one voxel (a stair); two or more is a
 * cliff. Cells in `blocked` are never entered. Returns null if there is no
 * route.
 */
export function findPath(terrain: Terrain, bridges: Bridge[], from: Cell, to: Cell, blocked: Cell[]): Cell[] | null {
  const { width, depth } = terrain;
  const walk = walkHeights(terrain, bridges);
  const closed = new Set(blocked.map((c) => c.z * width + c.x));
  const start = from.z * width + from.x;
  const goal = to.z * width + to.x;

  // Dial's algorithm: costs are small integers, so buckets replace a heap.
  const cost = new Array<number>(walk.length).fill(Infinity);
  const previous = new Array<number>(walk.length).fill(-1);
  const buckets: number[][] = [[start]];
  cost[start] = 0;
  for (let c = 0; c < buckets.length; c++) {
    for (const i of buckets[c] ?? []) {
      if (cost[i] !== c) continue;
      if (i === goal) return trace(previous, goal, width);
      const x = i % width;
      const z = Math.floor(i / width);
      for (const { dx, dz } of STEPS) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
        const j = nz * width + nx;
        if (walk[j] === undefined || (closed.has(j) && j !== goal)) continue;
        const climb = Math.abs(walk[j]! - walk[i]!);
        if (climb > 1) continue;
        const next = c + 1 + climb * CLIMB_COST;
        if (next < cost[j]!) {
          cost[j] = next;
          previous[j] = i;
          (buckets[next] ??= []).push(j);
        }
      }
    }
  }
  return null;
}

/** Stairs on the lower cell of every single-step height change along a path, climbing towards the higher cell. */
export function stairsAlong(terrain: Terrain, bridges: Bridge[], cells: Cell[]): Stair[] {
  const walk = walkHeights(terrain, bridges);
  const heightOf = (c: Cell) => walk[c.z * terrain.width + c.x]!;
  const stairs: Stair[] = [];
  for (let k = 1; k < cells.length; k++) {
    const a = cells[k - 1]!;
    const b = cells[k]!;
    if (heightOf(a) === heightOf(b)) continue;
    const [low, high] = heightOf(a) < heightOf(b) ? [a, b] : [b, a];
    const step = STEPS.find((s) => s.dx === high.x - low.x && s.dz === high.z - low.z)!;
    stairs.push({ cell: low, y: heightOf(low), facing: step.facing });
  }
  return stairs;
}

/** Walking height per cell: land height, bridge deck height, or undefined for open sea. */
function walkHeights(terrain: Terrain, bridges: Bridge[]): Array<number | undefined> {
  const walk: Array<number | undefined> = terrain.heights.map((h, i) => (terrain.isle[i] === -1 ? undefined : h));
  for (const b of bridges) for (const c of b.cells) walk[c.z * terrain.width + c.x] = b.y;
  return walk;
}

function trace(previous: number[], goal: number, width: number): Cell[] {
  const cells: Cell[] = [];
  for (let i = goal; i !== -1; i = previous[i]!) cells.push({ x: i % width, z: Math.floor(i / width) });
  return cells.reverse();
}
