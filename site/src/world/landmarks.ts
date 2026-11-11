import type { Rng } from './prng';
import { surfaceOf } from './terrain';
import type { BiomeId, Boat, Bridge, Cell, Facing, Footprint, Isle, PlacedLandmark, PlacedLandmarkId, Terrain } from './types';

/** Most trees the Garden shows; Projects beyond the cap stay on their pages only. */
export const MAX_TREES = 24;
/** Most boats moored at the Dock; Clients beyond the cap stay on the Dock's page only. */
export const MAX_BOATS = 12;
/** Boats moor at most this many cells (Chebyshev) from the jetty. */
const BERTH_REACH = 2;
/** Footprints differing by more than this many voxels in height are never levelled. */
const MAX_LEVELLING = 2;
/** The House's plot (cells a side) and the House on it, in the plot's north-west corner. */
export const HOUSE_PLOT = 4;
export const HOUSE_CELLS = 3;
/**
 * How tall, in units above its ground, each Landmark's model may stand. Placement
 * keeps every Landmark in view past the others' models at these heights, so a
 * model must never be taller (the renderer's tests hold it to this). They leave
 * room for the polish models: a Station of 5–6, a House of 3.5–4, Garden trees
 * of 3–3.5. The Dock's covers its jetty too; the Mailbox's is its own cell.
 */
export const LANDMARK_HEIGHT: Record<PlacedLandmarkId, number> = {
  station: 6,
  house: 4,
  garden: 3.5,
  dock: 1,
  mailbox: 2,
};
/**
 * How many Variants each Landmark has in each Biome's style: the structure
 * files `structures/<landmark>/<biome>-<n>.structure`, numbered from 1 (a
 * data test holds the files to this table). The Garden has one until its
 * plants are drawn (polish ticket 05).
 */
export const LANDMARK_VARIANTS: Record<BiomeId, Record<PlacedLandmarkId, number>> = {
  tropical: { house: 3, station: 2, mailbox: 3, dock: 2, garden: 1 },
  northern: { house: 3, station: 2, mailbox: 3, dock: 2, garden: 1 },
  autumn: { house: 3, station: 2, mailbox: 3, dock: 2, garden: 1 },
  volcanic: { house: 3, station: 2, mailbox: 3, dock: 2, garden: 1 },
};
/** Ground points checked for occlusion per cell edge: a ¼-cell grid. */
const SAMPLES_PER_CELL = 4;

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** A footprint the generator may place, with the height its ground is levelled to. */
interface Candidate {
  footprint: Footprint;
  y: number;
  jetty: Cell[];
}

export interface Placement {
  landmarks: PlacedLandmark[];
  /** The Clients' boats, moored round the Dock's jetty. */
  boats: Boat[];
  /** The terrain with every footprint levelled. */
  terrain: Terrain;
}

/**
 * Place the five Landmarks, each on a footprint of whole cells:
 *
 * - the Station (2×2) on its Isle's high ground, levelled up to the top;
 * - the Garden (at least 3×3, one cell per tree plus paths), then the House's
 *   plot (4×4: the House 3×3 and its front yard) on the Garden's Isle;
 * - the Dock (2×1) on the shoreline, with a 2–3 cell jetty straight out to sea;
 * - the Mailbox (1×1) in the House's front yard, in the plot's south-east
 *   corner (`houseYard`); it shares the plot's ground and has none of its own.
 *
 * Every footprint is land of one Isle, levelled to one height (down to its
 * lowest cell; the Station up to its highest) if its cells differ by at most
 * `MAX_LEVELLING` voxels. Footprints keep a cell apart and stay off bridges
 * and bridge ends. No footprint (or jetty) may be hidden from the fixed
 * isometric camera by terrain, a bridge, or another Landmark's model (each
 * as tall as `LANDMARK_HEIGHT` allows). Each Landmark tries the Isles in a
 * Seed-shuffled order. Returns null if some Landmark has no valid footprint.
 */
export function placeLandmarks(
  rng: Rng,
  source: Terrain,
  isles: Isle[],
  bridges: Bridge[],
  counts: { trees: number; boats: number },
): Placement | null {
  const treeCount = counts.trees;
  const boatCount = Math.min(Math.max(0, counts.boats), MAX_BOATS);
  const terrain: Terrain = { ...source, heights: [...source.heights] };
  const { width, depth, heights, isle } = terrain;
  const index = (x: number, z: number) => z * width + x;
  const isSea = (x: number, z: number) =>
    x < 0 || z < 0 || x >= width || z >= depth || isle[index(x, z)] === -1;

  // Cells no footprint may cover: bridges, the land at their ends, and
  // (as Landmarks are placed) every footprint and jetty with a one-cell margin.
  const blocked = new Set<number>();
  // What stands over each cell besides the ground: a bridge deck, then also
  // the models of the Landmarks placed so far, each as tall as it may reach.
  const standing = new Array<number>(width * depth).fill(0);
  for (const b of bridges) {
    for (const c of b.cells) {
      standing[index(c.x, c.z)] = b.y;
      blocked.add(index(c.x, c.z));
      for (const [dx, dz] of SIDES) blocked.add(index(c.x + dx, c.z + dz));
    }
  }
  const occupy = (cells: Cell[]) => {
    for (const c of cells) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) blocked.add(index(c.x + dx, c.z + dz));
    }
  };

  const inGrid = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth;
  /** Column height an iso ray must clear: land, a bridge deck over the sea, or a placed Landmark's model. */
  const occluderHeight = (x: number, z: number) => (inGrid(x, z) ? Math.max(heights[index(x, z)]!, standing[index(x, z)]!) : 0);
  let top = Math.max(...heights, ...bridges.map((b) => b.y));

  /**
   * Is every ground point of `cells` (on a ¼-cell grid, at height `y`) in
   * plain view of the camera, with `footprint` levelled to `footprintY`
   * (`y` unless given) and `jetty` a deck at that height? The camera
   * looks along −(1, 1, 1), so the ray from a point runs towards (1, 1, 1):
   * it is hidden if it enters a column below that column's top: land, a
   * bridge, a placed Landmark's model (not its own), or `candidateModel`
   * (a candidate's model, as `modelOf` gives it).
   * The ray climbs one unit per unit of x (and of z), so only columns on the
   * diagonal band ahead, up to the highest top, can block it. Points above
   * the ground (the model) are then visible too: their rays run higher.
   */
  const inView = (cells: Cell[], y: number, footprint: Footprint, footprintY = y, jetty: Cell[] = [], candidateModel?: Map<number, number>) => {
    const { origin, width: w, depth: d } = footprint;
    const deck = new Set(jetty.map((c) => index(c.x, c.z)));
    const levelled = (x: number, z: number) =>
      (x >= origin.x && x < origin.x + w && z >= origin.z && z < origin.z + d) || (inGrid(x, z) && deck.has(index(x, z)))
        ? footprintY
        : Math.max(occluderHeight(x, z), (inGrid(x, z) && candidateModel?.get(index(x, z))) || 0);
    const reach = Math.max(top, ...(candidateModel?.values() ?? [])) - y + 2;
    for (const c of cells) {
      for (let i = 0; i <= SAMPLES_PER_CELL; i++) {
        for (let k = 0; k <= SAMPLES_PER_CELL; k++) {
          const px = c.x + i / SAMPLES_PER_CELL;
          const pz = c.z + k / SAMPLES_PER_CELL;
          for (let s = 0; s <= reach; s++) {
            for (let a = -1; a <= 1; a++) {
              for (let b = -1; b <= 1; b++) {
                const cx = Math.floor(px) + s + a;
                const cz = Math.floor(pz) + s + b;
                // When the ray is inside this column: t in [enter, leave).
                const enter = Math.max(cx - px, cz - pz, 0);
                const leave = Math.min(cx + 1 - px, cz + 1 - pz);
                if (enter >= leave) continue;
                if (y + enter < levelled(cx, cz)) return false;
              }
            }
          }
        }
      }
    }
    return true;
  };

  const rectangle = (origin: Cell, w: number, d: number): Footprint => {
    const cells: Cell[] = [];
    for (let z = origin.z; z < origin.z + d; z++) for (let x = origin.x; x < origin.x + w; x++) cells.push({ x, z });
    return { origin, width: w, depth: d, cells };
  };

  /** Every free, levellable footprint of size w×d on an Isle, with its ground height range. */
  const footprintsOn = (owner: Isle, w: number, d: number) => {
    const found: Array<{ footprint: Footprint; low: number; high: number }> = [];
    const { minX, maxX, minZ, maxZ } = owner.bounds;
    for (let z = minZ; z + d - 1 <= maxZ; z++) {
      for (let x = minX; x + w - 1 <= maxX; x++) {
        const footprint = rectangle({ x, z }, w, d);
        let low = Infinity;
        let high = -Infinity;
        let ok = true;
        for (const c of footprint.cells) {
          const i = index(c.x, c.z);
          if (isle[i] !== owner.id || blocked.has(i)) {
            ok = false;
            break;
          }
          low = Math.min(low, heights[i]!);
          high = Math.max(high, heights[i]!);
        }
        if (ok && high - low <= MAX_LEVELLING) found.push({ footprint, low, high });
      }
    }
    return found;
  };

  /**
   * The model a Landmark on `candidate` stands up to, as columns: the top it
   * may reach over each cell (`LANDMARK_HEIGHT`). The House stands on its
   * plot's 3×3, and the Mailbox in its yard is placed with it; the Dock's
   * model covers its jetty too.
   */
  const modelOf = (id: PlacedLandmarkId, candidate: Candidate) => {
    const { footprint, y, jetty } = candidate;
    const tops = new Map<number, number>();
    if (id === 'house') {
      const { origin } = footprint;
      for (const c of rectangle(origin, HOUSE_CELLS, HOUSE_CELLS).cells) tops.set(index(c.x, c.z), y + LANDMARK_HEIGHT.house);
      const mailbox = mailboxCorner(origin);
      tops.set(index(mailbox.x, mailbox.z), y + LANDMARK_HEIGHT.mailbox);
    } else {
      for (const c of [...footprint.cells, ...jetty]) tops.set(index(c.x, c.z), y + LANDMARK_HEIGHT[id]);
    }
    return tops;
  };

  /**
   * Pick one candidate at random that the camera sees in full, and whose model
   * hides none of the Landmarks placed so far. Visibility is the costly check,
   * so it runs only on the candidates drawn.
   */
  const pickInView = (id: PlacedLandmarkId, candidates: Candidate[], fits: (c: Candidate) => boolean = () => true): Candidate | null => {
    const pool = [...candidates];
    while (pool.length > 0) {
      const k = Math.floor(rng() * pool.length);
      const candidate = pool[k]!;
      if (inView([...candidate.footprint.cells, ...candidate.jetty], candidate.y, candidate.footprint) && fits(candidate)) {
        const model = modelOf(id, candidate);
        const cells = [...model.keys()].map((i) => ({ x: i % width, z: Math.floor(i / width) }));
        const east = Math.max(...cells.map((c) => c.x));
        const south = Math.max(...cells.map((c) => c.z));
        // Rays run towards +x and +z: a model wholly west or north of a Landmark cannot hide it.
        const hidesNone = placed.every((p) => {
          const ground = [...p.footprint.cells, ...p.jetty];
          if (east < Math.min(...ground.map((c) => c.x)) || south < Math.min(...ground.map((c) => c.z))) return true;
          return inView(ground, p.y, p.footprint, p.y, p.jetty, model);
        });
        if (hidesNone) return candidate;
      }
      pool.splice(k, 1);
    }
    return null;
  };

  const placed: PlacedLandmark[] = [];
  const settle = (id: PlacedLandmarkId, owner: Isle, candidate: Candidate, trees: Cell[] = []) => {
    for (const c of candidate.footprint.cells) heights[index(c.x, c.z)] = candidate.y;
    const model = modelOf(id, candidate);
    for (const [i, t] of model) standing[i] = Math.max(standing[i]!, t);
    top = Math.max(top, ...model.values());
    occupy([...candidate.footprint.cells, ...candidate.jetty]);
    const landmark: PlacedLandmark = {
      id,
      isle: owner.id,
      footprint: candidate.footprint,
      y: candidate.y,
      variant: 1,
      door: null,
      trees,
      jetty: candidate.jetty,
    };
    placed.push(landmark);
    return landmark;
  };
  /** Every Isle, in an order the Seed shuffles: a Landmark tries each in turn. */
  const islesInTurn = () => {
    const order = [...isles];
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [order[k], order[j]] = [order[j]!, order[k]!];
    }
    return order;
  };
  /** The first Isle, in turn, with a candidate in view, and that candidate. */
  const firstInView = (id: PlacedLandmarkId, candidatesOn: (owner: Isle) => Candidate[][], fits?: (c: Candidate) => boolean) => {
    for (const owner of islesInTurn()) {
      for (const candidates of candidatesOn(owner)) {
        const picked = pickInView(id, candidates, fits);
        if (picked) return { owner, picked };
      }
    }
    return null;
  };
  /** Footprints levelled down to their lowest cell. */
  const levelledDown = (owner: Isle, w: number, d: number): Candidate[] =>
    footprintsOn(owner, w, d).map(({ footprint, low }) => ({ footprint, y: low, jetty: [] }));

  // The Station: levelled up to its Isle's top height, so it stands on the high ground.
  const station = firstInView('station', (owner) => {
    const isleTop = Math.max(...heights.filter((_, i) => isle[i] === owner.id));
    return [
      footprintsOn(owner, 2, 2)
        .filter(({ high }) => high === isleTop)
        .map(({ footprint, high }) => ({ footprint, y: high, jetty: [] })),
    ];
  });
  if (!station) return null;
  settle('station', station.owner, station.picked);

  // The Garden, the largest footprint, goes next; the House joins it on its Isle.
  const layout = gardenLayout(Math.min(Math.max(0, treeCount), MAX_TREES));
  const across = rng() < 0.5;
  const garden = firstInView('garden', (owner) => {
    // Try one orientation first, chosen by the Seed; either will do.
    const upright = levelledDown(owner, layout.width, layout.depth);
    const turned = layout.width === layout.depth ? [] : levelledDown(owner, layout.depth, layout.width);
    return across ? [turned, upright] : [upright, turned];
  });
  if (!garden) return null;
  const home = garden.owner;
  const { origin } = garden.picked.footprint;
  const turned = garden.picked.footprint.width !== layout.width;
  const trees = layout.trees.map(({ x, z }) => (turned ? { x: origin.x + z, z: origin.z + x } : { x: origin.x + x, z: origin.z + z }));
  settle('garden', home, garden.picked, trees);

  const house = pickInView('house', levelledDown(home, HOUSE_PLOT, HOUSE_PLOT));
  if (!house) return null;
  const placedHouse = settle('house', home, house);
  // Its door faces the way the Seed says; `generateWorld` turns it if the path cannot reach it.
  placedHouse.door = rng() < 0.5 ? 'south' : 'east';

  // The Dock: a 2×1 footprint on the shore with a jetty straight out to sea,
  // at the water's level if it can.
  const jettyFrom = (footprint: Footprint, y: number): Candidate[] =>
    footprint.cells.flatMap((c) =>
      SIDES.flatMap(([dx, dz]) => {
        const jetty: Cell[] = [];
        for (let k = 1; k <= 3; k++) {
          const x = c.x + dx * k;
          const z = c.z + dz * k;
          if (!isSea(x, z) || x < 1 || z < 1 || x >= width - 1 || z >= depth - 1 || blocked.has(index(x, z))) break;
          jetty.push({ x, z });
        }
        return jetty.length >= 2 ? [{ footprint, y, jetty }] : [];
      }),
    );
  // Its berths: sea cells beside the jetty and off its tip, nearest first,
  // clear of bridges and in plain view at sea level. The Dock needs one per boat.
  const berthsOf = (candidate: Candidate): Boat[] => {
    const { jetty, footprint } = candidate;
    const first = jetty[0]!;
    const dx = Math.sign(jetty[1]!.x - first.x);
    const dz = Math.sign(jetty[1]!.z - first.z);
    const facing: Facing = dx === 1 ? 'east' : dx === -1 ? 'west' : dz === 1 ? 'south' : 'north';
    const found: Array<{ cell: Cell; ring: number; along: number; side: number }> = [];
    for (let along = 0; along < jetty.length + BERTH_REACH; along++) {
      for (let side = -BERTH_REACH; side <= BERTH_REACH; side++) {
        const ring = Math.max(Math.abs(side), along - (jetty.length - 1));
        if (ring === 0) continue;
        // Across the jetty: (dz, dx) is perpendicular to (dx, dz).
        const x = first.x + dx * along + dz * side;
        const z = first.z + dz * along + dx * side;
        if (!isSea(x, z) || (inGrid(x, z) && blocked.has(index(x, z)))) continue;
        found.push({ cell: { x, z }, ring, along, side });
      }
    }
    found.sort((a, b) => a.ring - b.ring || a.along - b.along || Math.abs(a.side) - Math.abs(b.side) || a.side - b.side);
    const berths: Boat[] = [];
    for (const { cell } of found) {
      if (berths.length === boatCount) break;
      if (inView([cell], 0, footprint, candidate.y, jetty)) berths.push({ cell, facing });
    }
    return berths;
  };
  const dock = firstInView(
    'dock',
    (owner) => {
      const all = [...levelledDown(owner, 2, 1), ...levelledDown(owner, 1, 2)].flatMap(({ footprint, y }) =>
        jettyFrom(footprint, y),
      );
      return [all.filter((c) => c.y === 1), all.filter((c) => c.y !== 1)];
    },
    (c) => berthsOf(c).length === boatCount,
  );
  if (!dock) return null;
  // Before settling, which blocks the jetty's surroundings. Nothing placed later goes to sea.
  const boats = berthsOf(dock.picked);
  settle('dock', dock.owner, dock.picked);

  // The Mailbox: in the House's front yard, on the plot's ground (already levelled and in view).
  placed.push({
    id: 'mailbox',
    isle: home.id,
    footprint: rectangle(houseYard(placedHouse).mailbox, 1, 1),
    y: house.y,
    variant: 1,
    door: null,
    trees: [],
    jetty: [],
  });

  // Lowering ground never hides anything, the Station (the only raise) came
  // first, and each Landmark was checked against every model placed before
  // and after it (the Mailbox's with the House), so every Landmark is in view.
  terrain.surface = surfaceOf(terrain, isles);
  return { landmarks: placed, boats, terrain };
}

/**
 * The House's plot, cell by cell, for a door facing `door` (default: the
 * House's own): the House's 3×3 at the plot's origin; `door`, the yard
 * cell in front of the door (the door is in the middle of the front wall);
 * `approach`, the cell just outside the plot in line with it, where the
 * path from the Dock ends; and `mailbox`, the plot's south-east corner,
 * where the Mailbox stands whichever way the door faces. The camera looks
 * along (−1, −1, −1), so the Mailbox never hides the door; it stands in
 * front of the House's middle, low enough to leave the room in view.
 */
export function houseYard(house: PlacedLandmark, door: Facing = house.door ?? 'south') {
  const { x, z } = house.footprint.origin;
  const along = (a: number, b: number): Cell => (door === 'south' ? { x: x + a, z: z + b } : { x: x + b, z: z + a });
  return {
    house: { origin: { x, z }, width: HOUSE_CELLS, depth: HOUSE_CELLS },
    door: along(1, HOUSE_CELLS),
    approach: along(1, HOUSE_PLOT),
    mailbox: mailboxCorner(house.footprint.origin),
  };
}

/** The House plot's south-east corner, where the Mailbox stands: the plot's corner nearest the camera. */
const mailboxCorner = (origin: Cell): Cell => ({ x: origin.x + HOUSE_PLOT - 1, z: origin.z + HOUSE_PLOT - 1 });

/** The Garden's tree rows (local z) for a depth: two rows of trees, then a path row, repeating. */
const treeRows = (depth: number) => Array.from({ length: depth }, (_, z) => z).filter((z) => z % 3 !== 2);

/**
 * The Garden's shape for `count` trees: pairs of tree rows with a path row
 * between them, at least 3×3, as small and square as it can be, and always
 * with room for a path. Trees fill the rows in order, so tree `k` is always
 * in the same place.
 */
function gardenLayout(count: number): { width: number; depth: number; trees: Cell[] } {
  let best: { width: number; depth: number } | null = null;
  for (let area = 9; !best; area++) {
    for (let depth = 3; depth <= area / 3; depth++) {
      if (area % depth !== 0) continue;
      const width = area / depth;
      if (width < 3 || Math.abs(width - depth) > 2) continue;
      if (width * treeRows(depth).length < count || area <= count) continue;
      if (!best || Math.abs(width - depth) < Math.abs(best.width - best.depth)) best = { width, depth };
    }
  }
  const rows = treeRows(best.depth);
  const trees: Cell[] = [];
  for (let k = 0; k < count; k++) trees.push({ x: k % best.width, z: rows[Math.floor(k / best.width)]! });
  return { ...best, trees };
}
