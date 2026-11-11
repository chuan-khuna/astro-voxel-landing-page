import type { Rng } from './prng';
import { surfaceOf } from './terrain';
import type { Bridge, Cell, Footprint, Isle, PlacedLandmark, PlacedLandmarkId, Terrain } from './types';

/** Most trees the Garden shows; Projects beyond the cap stay on their pages only. */
export const MAX_TREES = 24;
/** Footprints differing by more than this many voxels in height are never levelled. */
const MAX_LEVELLING = 2;
/** The Mailbox stands within this many cells of the House if it can. */
const MAILBOX_REACH = 4;
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
  /** The terrain with every footprint levelled. */
  terrain: Terrain;
}

/**
 * Place the five Landmarks, each on a footprint of whole cells:
 *
 * - the Station (2×2) on its Isle's high ground, levelled up to the top;
 * - the Garden (at least 3×3, one cell per tree plus paths), then the House
 *   (3×3) on the Garden's Isle;
 * - the Dock (2×1) on the shoreline, with a 2–3 cell jetty straight out to sea;
 * - the Mailbox (1×1), near the House if it can.
 *
 * Every footprint is land of one Isle, levelled to one height (down to its
 * lowest cell; the Station up to its highest) if its cells differ by at most
 * `MAX_LEVELLING` voxels. Footprints keep a cell apart and stay off bridges
 * and bridge ends. No footprint (or jetty) may be hidden by terrain or a
 * bridge from the fixed isometric camera. Each Landmark tries the Isles in a
 * Seed-shuffled order. Returns null if some Landmark has no valid footprint.
 */
export function placeLandmarks(
  rng: Rng,
  source: Terrain,
  isles: Isle[],
  bridges: Bridge[],
  treeCount: number,
): Placement | null {
  const terrain: Terrain = { ...source, heights: [...source.heights] };
  const { width, depth, heights, isle } = terrain;
  const index = (x: number, z: number) => z * width + x;
  const isSea = (x: number, z: number) =>
    x < 0 || z < 0 || x >= width || z >= depth || isle[index(x, z)] === -1;

  // Cells no footprint may cover: bridges, the land at their ends, and
  // (as Landmarks are placed) every footprint and jetty with a one-cell margin.
  const blocked = new Set<number>();
  const deckHeight = new Map<number, number>();
  for (const b of bridges) {
    for (const c of b.cells) {
      deckHeight.set(index(c.x, c.z), b.y);
      blocked.add(index(c.x, c.z));
      for (const [dx, dz] of SIDES) blocked.add(index(c.x + dx, c.z + dz));
    }
  }
  const occupy = (cells: Cell[]) => {
    for (const c of cells) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) blocked.add(index(c.x + dx, c.z + dz));
    }
  };

  /** Column height an iso ray must clear: land, or a bridge deck over the sea. */
  const occluderHeight = (x: number, z: number) =>
    x < 0 || z < 0 || x >= width || z >= depth ? 0 : Math.max(heights[index(x, z)]!, deckHeight.get(index(x, z)) ?? 0);
  const top = Math.max(...heights, ...bridges.map((b) => b.y));

  /**
   * Is every ground point of `cells` (on a ¼-cell grid, at height `y`) in
   * plain view of the camera, with `footprint` levelled to `y`? The camera
   * looks along −(1, 1, 1), so the ray from a point runs towards (1, 1, 1):
   * it is hidden if it enters a column below that column's top. The ray
   * climbs one unit per unit of x (and of z), so only columns on the
   * diagonal band ahead, up to the highest ground, can block it. Points above
   * the ground (the model) are then visible too: their rays run higher.
   */
  const inView = (cells: Cell[], y: number, footprint: Footprint) => {
    const { origin, width: w, depth: d } = footprint;
    const levelled = (x: number, z: number) =>
      x >= origin.x && x < origin.x + w && z >= origin.z && z < origin.z + d ? y : occluderHeight(x, z);
    const reach = top - y + 2;
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
   * Pick one candidate at random that the camera sees in full. Visibility is
   * the costly check, so it runs only on the candidates drawn.
   */
  const pickInView = (candidates: Candidate[]): Candidate | null => {
    const pool = [...candidates];
    while (pool.length > 0) {
      const k = Math.floor(rng() * pool.length);
      const candidate = pool[k]!;
      if (inView([...candidate.footprint.cells, ...candidate.jetty], candidate.y, candidate.footprint)) return candidate;
      pool.splice(k, 1);
    }
    return null;
  };

  const placed: PlacedLandmark[] = [];
  const settle = (id: PlacedLandmarkId, owner: Isle, candidate: Candidate, trees: Cell[] = []) => {
    for (const c of candidate.footprint.cells) heights[index(c.x, c.z)] = candidate.y;
    occupy([...candidate.footprint.cells, ...candidate.jetty]);
    const landmark: PlacedLandmark = {
      id,
      isle: owner.id,
      footprint: candidate.footprint,
      y: candidate.y,
      variant: 0,
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
  const firstInView = (candidatesOn: (owner: Isle) => Candidate[][]) => {
    for (const owner of islesInTurn()) {
      for (const candidates of candidatesOn(owner)) {
        const picked = pickInView(candidates);
        if (picked) return { owner, picked };
      }
    }
    return null;
  };
  /** Footprints levelled down to their lowest cell. */
  const levelledDown = (owner: Isle, w: number, d: number): Candidate[] =>
    footprintsOn(owner, w, d).map(({ footprint, low }) => ({ footprint, y: low, jetty: [] }));

  // The Station: levelled up to its Isle's top height, so it stands on the high ground.
  const station = firstInView((owner) => {
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
  const garden = firstInView((owner) => {
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

  const house = pickInView(levelledDown(home, 3, 3));
  if (!house) return null;
  settle('house', home, house);

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
  const dock = firstInView((owner) => {
    const all = [...levelledDown(owner, 2, 1), ...levelledDown(owner, 1, 2)].flatMap(({ footprint, y }) =>
      jettyFrom(footprint, y),
    );
    return [all.filter((c) => c.y === 1), all.filter((c) => c.y !== 1)];
  });
  if (!dock) return null;
  settle('dock', dock.owner, dock.picked);

  // The Mailbox: near the House if it can.
  const houseBox = house.footprint;
  const nearHouse = (c: Candidate) => {
    const { x, z } = c.footprint.origin;
    const dx = Math.max(houseBox.origin.x - x, x - (houseBox.origin.x + houseBox.width - 1), 0);
    const dz = Math.max(houseBox.origin.z - z, z - (houseBox.origin.z + houseBox.depth - 1), 0);
    return Math.max(dx, dz) <= MAILBOX_REACH;
  };
  const mailboxCandidates = levelledDown(home, 1, 1);
  const mailbox = pickInView(mailboxCandidates.filter(nearHouse)) ?? pickInView(mailboxCandidates);
  if (!mailbox) return null;
  settle('mailbox', home, mailbox);

  // Lowering ground never hides anything, and the Station (the only raise)
  // came first, so every Landmark checked above is still in view.
  terrain.surface = surfaceOf(terrain, isles);
  return { landmarks: placed, terrain };
}

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
