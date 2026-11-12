import type { Rng } from './prng';
import type { Bridge, Cell, Isle, Terrain } from './types';

/** Longest bridge, in sea cells. */
const MAX_BRIDGE_LENGTH = 12;

const DIRECTIONS = [
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: -1 },
] as const;

/**
 * Link every Isle with straight bridges: Kruskal over Isle pairs, nearest
 * first, so the bridges form a spanning tree. A bridge runs straight over sea
 * between two land cells of equal height, with open sea on both sides.
 * Returns null if some Isle cannot be reached.
 */
export function buildBridges(rng: Rng, terrain: Terrain, isles: Isle[]): Bridge[] | null {
  const centre = (s: Isle) => ({ x: (s.bounds.minX + s.bounds.maxX) / 2, z: (s.bounds.minZ + s.bounds.maxZ) / 2 });
  const pairs: Array<{ a: number; b: number; d: number }> = [];
  for (let a = 0; a < isles.length; a++) {
    for (let b = a + 1; b < isles.length; b++) {
      const ca = centre(isles[a]!);
      const cb = centre(isles[b]!);
      pairs.push({ a, b, d: Math.hypot(ca.x - cb.x, ca.z - cb.z) });
    }
  }
  pairs.sort((p, q) => p.d - q.d || p.a - q.a || p.b - q.b);

  const group = isles.map((s) => s.id);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  const used = new Set<number>();
  const bridges: Bridge[] = [];
  for (const { a, b } of pairs) {
    if (root(a) === root(b)) continue;
    const bridge = shortestBridge(rng, terrain, a, b, used);
    if (!bridge) continue;
    bridges.push(bridge);
    for (const c of bridge.cells) used.add(c.z * terrain.width + c.x);
    group[root(a)] = root(b);
  }
  const linked = isles.every((s) => root(s.id) === root(0));
  return linked ? bridges : null;
}

function shortestBridge(rng: Rng, terrain: Terrain, from: number, to: number, used: Set<number>): Bridge | null {
  const { width, depth, heights, isle } = terrain;
  const inside = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth;
  const isSea = (x: number, z: number) => inside(x, z) && isle[z * width + x] === -1;

  let best: Bridge[] = [];
  for (let i = 0; i < isle.length; i++) {
    if (isle[i] !== from) continue;
    const sx = i % width;
    const sz = Math.floor(i / width);
    for (const { dx, dz } of DIRECTIONS) {
      const cells: Cell[] = [];
      let x = sx + dx;
      let z = sz + dz;
      let ok = true;
      while (isSea(x, z) && cells.length <= MAX_BRIDGE_LENGTH) {
        // Open sea on both sides, and no crossing another bridge.
        const side = !isSea(x + dz, z + dx) || !isSea(x - dz, z - dx) || used.has(z * width + x);
        if (side) {
          ok = false;
          break;
        }
        cells.push({ x, z });
        x += dx;
        z += dz;
      }
      if (!ok || cells.length === 0 || cells.length > MAX_BRIDGE_LENGTH || !inside(x, z)) continue;
      const end = z * width + x;
      if (isle[end] !== to || heights[end] !== heights[i]) continue;
      if (best.length > 0 && cells.length > best[0]!.cells.length) continue;
      const bridge = { from, to, cells, y: heights[i]! };
      best = best.length > 0 && cells.length === best[0]!.cells.length ? [...best, bridge] : [bridge];
    }
  }
  return best.length > 0 ? best[Math.floor(rng() * best.length)]! : null;
}
