import type { Bridge, Cell, PlacedLandmark, ShipRoute, Terrain } from './types';

/** At most this many buoys in a World. */
export const MAX_BUOYS = 4;
/** A buoy floats this near the land (Chebyshev, in cells): just off the shore, in view of the Isles. */
const SHORE = { min: 1, max: 4 } as const;
/** Clear of every cell a ship sails through by this many cells, as ships keep clear of the boats. */
const SHIP_CLEARANCE = 2;
/** Clear of the jetty, the boats and the bridges by this many cells. */
const CLEARANCE = 2;
/** Buoys keep at least this far apart. */
const SPACING = 4;
/** A buoy's lamp: this high above the sea floor, in the middle of its cell. */
const LAMP_Y = 1;

const chebyshev = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

/**
 * The buoys: sea marks that lead the way to the Dock (their lamps glow at
 * Night). No randomness: they follow from the layout. Candidates are sea
 * cells inside the grid, 1–4 cells off the land, clear of the ships' loops,
 * the jetty, the boats and the bridges, with the lamp in plain view of the
 * camera. The nearest to the jetty's tip are taken first, each at least
 * `SPACING` from the last, up to `MAX_BUOYS`.
 */
export function placeBuoys(terrain: Terrain, bridges: Bridge[], dock: PlacedLandmark | undefined, boats: Cell[], ships: ShipRoute[]): Cell[] {
  const { width, depth, isle, heights } = terrain;
  /** Chebyshev distance to the nearest land, or Infinity beyond `SHORE.max`. */
  const shoreDistance = (cell: Cell) => {
    let best = Infinity;
    for (let dz = -SHORE.max; dz <= SHORE.max; dz++) {
      for (let dx = -SHORE.max; dx <= SHORE.max; dx++) {
        const x = cell.x + dx;
        const z = cell.z + dz;
        if (x >= 0 && z >= 0 && x < width && z < depth && isle[z * width + x] !== -1) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dz)));
      }
    }
    return best;
  };
  const bridgeCells = bridges.flatMap((b) => b.cells);
  const keepClear = [...(dock?.jetty ?? []), ...boats, ...bridgeCells];
  const shipCells = ships.flatMap((s) => s.cells);
  const decks = new Map<string, number>([
    ...bridges.flatMap((b) => b.cells.map((c) => [`${c.x},${c.z}`, b.y] as const)),
    ...(dock?.jetty ?? []).map((c) => [`${c.x},${c.z}`, dock!.y] as const),
  ]);
  const top = Math.max(...heights, ...bridges.map((b) => b.y), dock?.y ?? 0);

  /** Does the line of sight from the lamp to the camera, along (1, 1, 1), enter land or a deck? */
  const hidden = (cell: Cell) => {
    const px = cell.x + 0.5;
    const pz = cell.z + 0.5;
    for (let t = 0.001; LAMP_Y + t <= top; t += 0.02) {
      const cx = Math.floor(px + t);
      const cz = Math.floor(pz + t);
      const y = LAMP_Y + t;
      if (cx >= width || cz >= depth) return false;
      if (y < heights[cz * width + cx]!) return true;
      const deck = decks.get(`${cx},${cz}`);
      if (deck !== undefined && y < deck && y > deck - 0.25) return true;
    }
    return false;
  };

  const candidates: Cell[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (isle[z * width + x] !== -1) continue;
      const cell = { x, z };
      const shore = shoreDistance(cell);
      if (shore < SHORE.min || shore > SHORE.max) continue;
      if (shipCells.some((c) => chebyshev(c, cell) < SHIP_CLEARANCE)) continue;
      if (keepClear.some((c) => chebyshev(c, cell) < CLEARANCE)) continue;
      if (hidden(cell)) continue;
      candidates.push(cell);
    }
  }

  // Nearest the jetty's tip first (ties: north to south, then west to east).
  const tip = dock?.jetty.at(-1) ?? { x: width / 2, z: depth / 2 };
  const distance = (c: Cell) => Math.hypot(c.x - tip.x, c.z - tip.z);
  candidates.sort((a, b) => distance(a) - distance(b) || a.z - b.z || a.x - b.x);
  const buoys: Cell[] = [];
  for (const cell of candidates) {
    if (buoys.length === MAX_BUOYS) break;
    if (buoys.every((b) => chebyshev(b, cell) >= SPACING)) buoys.push(cell);
  }
  return buoys;
}
