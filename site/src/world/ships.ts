import type { Bridge, Cell, Isle, ShipRoute, Terrain } from './types';

/** How far past the terrain grid's edge ships may sail, in cells. */
const SEA_PAD = 6;
/** A ship's cell keeps at least this many cells (Chebyshev) from anything it could hit. */
const CLEARANCE = 2;

/** The eight neighbours, orthogonal first. */
const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as const;

/**
 * What a loop sails round: a cell at its middle and an axis through it. The
 * loop passes the open water on both sides of the axis (`±across`), going
 * round one end of the axis there and the other end back.
 */
interface Body {
  centre: Cell;
  along: Cell;
  across: Cell;
}

/**
 * One sailing route per Partner. With one Isle, every loop sails round it.
 * With more, loops pass through the strait beside a bridge on both sides,
 * so the ship sails between the two Isles it links (and, since bridges link
 * every Isle, round the whole archipelago). Only bridges of 3+ cells can be
 * sailed beside; with none, the loop goes round all the land. Partner `k`
 * takes bridge `k mod bridges`; Partners beyond the bridges take a wider
 * loop, the other way round, then share loops, spread out round them by
 * `phase`. A loop that cannot be found falls back to a narrower one, then
 * to one round all the land, then to a ring inside the chart's edge.
 *
 * No randomness: the loops follow from the layout. `obstacles` are sea cells
 * a ship must keep clear of (the jetty and the moored boats).
 */
export function sailingRoutes(terrain: Terrain, isles: Isle[], bridges: Bridge[], obstacles: Cell[], count: number): ShipRoute[] {
  if (count <= 0) return [];
  const sea = seaChart(terrain, bridges, obstacles);

  // Bridges long enough to sail beside, each a body; or the one Isle (or all the land) as the body.
  const bodies: Body[] = bridges
    .filter((b) => b.cells.length >= 2 * CLEARANCE - 1)
    .map((b) => {
      const first = b.cells[0]!;
      const last = b.cells.at(-1)!;
      const along = { x: Math.sign(last.x - first.x), z: Math.sign(last.z - first.z) };
      return { centre: b.cells[Math.floor(b.cells.length / 2)]!, along, across: { x: along.z, z: along.x } };
    });
  // All the land as one body: the fallback when a strait is too tight to sail through.
  const minX = Math.min(...isles.map((i) => i.bounds.minX));
  const maxX = Math.max(...isles.map((i) => i.bounds.maxX));
  const minZ = Math.min(...isles.map((i) => i.bounds.minZ));
  const maxZ = Math.max(...isles.map((i) => i.bounds.maxZ));
  // Its centre is the land cell nearest the middle of the land: a loop must go round something solid.
  const mid = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  let centre: Cell = { x: 0, z: 0 };
  let best = Infinity;
  terrain.isle.forEach((owner, i) => {
    const c = { x: i % terrain.width, z: Math.floor(i / terrain.width) };
    const d = Math.hypot(c.x - mid.x, c.z - mid.z);
    if (owner !== -1 && d < best) {
      best = d;
      centre = c;
    }
  });
  const land: Body = { centre, along: { x: 1, z: 0 }, across: { x: 0, z: 1 } };
  if (bodies.length === 0) bodies.push(land);

  // Loops are shared by every Partner with the same body and lane: build each once.
  const loops = new Map<string, Cell[]>();
  const loopFor = (body: number, lane: number) => {
    const k = `${body}/${lane}`;
    if (!loops.has(k)) {
      const loop =
        sea.loop(bodies[body]!, CLEARANCE + lane) ??
        sea.loop(bodies[body]!, CLEARANCE) ??
        sea.loop(land, CLEARANCE + lane) ??
        sea.loop(land, CLEARANCE) ??
        sea.ring();
      const sailed = lane === 1 ? loop.toReversed() : loop;
      // Two bodies may fall back to the same loop: keep one copy, so its ships spread out.
      const same = [...loops.values()].find((l) => JSON.stringify(l) === JSON.stringify(sailed));
      loops.set(k, same ?? sailed);
    }
    return loops.get(k)!;
  };
  const cells = Array.from({ length: count }, (_, k) => loopFor(k % bodies.length, Math.floor(k / bodies.length) % 2));
  // Ships on the same loop start evenly spread round it.
  const sharing = new Map<Cell[], number>();
  const order = cells.map((loop) => {
    const j = sharing.get(loop) ?? 0;
    sharing.set(loop, j + 1);
    return j;
  });
  return cells.map((loop, k) => ({ cells: loop, phase: order[k]! / sharing.get(loop)! }));
}

/**
 * The sea round the World, past the grid's edge by `SEA_PAD`: how far each
 * cell is from anything a ship could hit, and loops through it.
 */
function seaChart(terrain: Terrain, bridges: Bridge[], obstacles: Cell[]) {
  const { width, depth, isle } = terrain;
  const w = width + SEA_PAD * 2;
  const d = depth + SEA_PAD * 2;
  const at = (c: Cell) => (c.z + SEA_PAD) * w + c.x + SEA_PAD;
  const inChart = (c: Cell) => c.x >= -SEA_PAD && c.z >= -SEA_PAD && c.x < width + SEA_PAD && c.z < depth + SEA_PAD;

  // Chebyshev distance to the nearest land, bridge or obstacle: a multi-source BFS over 8 neighbours.
  const distance = new Array<number>(w * d).fill(Infinity);
  const queue: Cell[] = [];
  const hit = (c: Cell) => {
    if (inChart(c) && distance[at(c)] !== 0) {
      distance[at(c)] = 0;
      queue.push(c);
    }
  };
  for (let i = 0; i < isle.length; i++) if (isle[i] !== -1) hit({ x: i % width, z: Math.floor(i / width) });
  for (const b of bridges) b.cells.forEach(hit);
  obstacles.forEach(hit);
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q]!;
    for (const [dx, dz] of STEPS) {
      const n = { x: c.x + dx, z: c.z + dz };
      if (inChart(n) && distance[at(n)] === Infinity) {
        distance[at(n)] = distance[at(c)]! + 1;
        queue.push(n);
      }
    }
  }
  // Open water: clear enough, and not on the chart's own edge.
  const open = (c: Cell, clearance: number) =>
    c.x > -SEA_PAD && c.z > -SEA_PAD && c.x < width + SEA_PAD - 1 && c.z < depth + SEA_PAD - 1 && distance[at(c)]! >= clearance;

  /**
   * The shortest way from `from` to `to` through open water, never through
   * `closed`. A diagonal step needs both cells beside it open, so it never
   * cuts a corner of land.
   */
  const route = (from: Cell, to: Cell, clearance: number, closed: Set<number>): Cell[] | null => {
    const free = (c: Cell) => open(c, clearance) && !closed.has(at(c));
    if (!free(from) || !free(to)) return null;
    const previous = new Map<number, number>([[at(from), -1]]);
    const queue: Cell[] = [from];
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q]!;
      if (c.x === to.x && c.z === to.z) {
        const path: Cell[] = [];
        for (let i = at(c); i !== -1; i = previous.get(i)!) path.push({ x: (i % w) - SEA_PAD, z: Math.floor(i / w) - SEA_PAD });
        return path.reverse();
      }
      for (const [dx, dz] of STEPS) {
        const n = { x: c.x + dx, z: c.z + dz };
        if (previous.has(at(n)) || !free(n)) continue;
        if (dx !== 0 && dz !== 0 && (!free({ x: c.x + dx, z: c.z }) || !free({ x: c.x, z: c.z + dz }))) continue;
        previous.set(at(n), at(c));
        queue.push(n);
      }
    }
    return null;
  };

  /**
   * The open water joined to the open sea at the chart's corner, so no
   * enclosed pocket (a bay with a narrow mouth, say) is ever a waypoint.
   */
  const seaways = new Map<number, Set<number>>();
  const openSea = (clearance: number) => {
    if (!seaways.has(clearance)) {
      const corner = { x: -SEA_PAD + 1, z: -SEA_PAD + 1 };
      const reached = new Set<number>([at(corner)]);
      const queue = [corner];
      for (let q = 0; q < queue.length; q++) {
        const c = queue[q]!;
        for (const [dx, dz] of STEPS.slice(0, 4)) {
          const n = { x: c.x + dx, z: c.z + dz };
          if (reached.has(at(n)) || !open(n, clearance)) continue;
          reached.add(at(n));
          queue.push(n);
        }
      }
      seaways.set(clearance, reached);
    }
    return seaways.get(clearance)!;
  };

  /** Cells from `from` in steps of `step` to the chart's edge. */
  const ray = (from: Cell, step: Cell) => {
    const cells: Cell[] = [];
    for (let c = from; inChart(c); c = { x: c.x + step.x, z: c.z + step.z }) cells.push(c);
    return cells;
  };

  return {
    /**
     * A loop round `body`: out from its centre across the axis both ways to
     * the first open water (`a` and `b`), then from `a` to `b` round one end
     * of the axis and back round the other. A wall along the axis past each
     * end in turn makes each half go the other way. Where the halves share
     * cells (a waypoint in a dead-end strait), the spur is cut out.
     */
    loop(body: Body, clearance: number): Cell[] | null {
      const seaway = openSea(clearance);
      const firstOpen = (sign: number) =>
        ray(body.centre, { x: body.across.x * sign, z: body.across.z * sign }).find((c) => seaway.has(at(c)));
      const a = firstOpen(1);
      const b = firstOpen(-1);
      if (!a || !b) return null;
      const wall = (sign: number) => new Set(ray(body.centre, { x: body.along.x * sign, z: body.along.z * sign }).map(at));
      const there = route(a, b, clearance, wall(1));
      const back = route(b, a, clearance, wall(-1));
      if (!there || !back) return null;
      return withoutSpurs([...there, ...back.slice(1, -1)], at);
    },
    /** The last resort: a ring round the whole chart, inside its edge; always open water. */
    ring(): Cell[] {
      const lo = -SEA_PAD + 2;
      const hiX = width + SEA_PAD - 3;
      const hiZ = depth + SEA_PAD - 3;
      const cells: Cell[] = [];
      for (let x = lo; x < hiX; x++) cells.push({ x, z: lo });
      for (let z = lo; z < hiZ; z++) cells.push({ x: hiX, z });
      for (let x = hiX; x > lo; x--) cells.push({ x, z: hiZ });
      for (let z = hiZ; z > lo; z--) cells.push({ x: lo, z });
      return cells;
    },
  };
}

/**
 * Cut every spur out of a loop: where the way there and the way back share
 * a cell (a waypoint in a dead-end pocket, say), keep the longer of the two
 * arcs between its visits. Each step stays an 8-neighbour one.
 */
function withoutSpurs(loop: Cell[], at: (c: Cell) => number): Cell[] {
  let cells = loop;
  for (;;) {
    const seen = new Map<number, number>();
    let cut: [number, number] | null = null;
    for (let j = 0; j < cells.length && !cut; j++) {
      const i = seen.get(at(cells[j]!));
      if (i === undefined) seen.set(at(cells[j]!), j);
      else cut = [i, j];
    }
    if (!cut) return cells;
    const [i, j] = cut;
    const inner = cells.slice(i, j);
    const outer = [...cells.slice(j), ...cells.slice(0, i)];
    cells = inner.length >= outer.length ? inner : outer;
  }
}
