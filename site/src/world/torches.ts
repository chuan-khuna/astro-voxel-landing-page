/**
 * Torches (polish ticket 16): the Light Sources that stand round the
 * Landmarks and along the paths, lit at Night. Each Biome has its own torch
 * style in two Variants (`structures/torch/`): a tall one (`TORCH_HEIGHT[1]`)
 * and a short one (`TORCH_HEIGHT[2]`) that fits beside the lowest Landmarks.
 * Placed after the Decoration, from a sequence of the Seed's own
 * (`<seed>/torches`), so they never move the layout or the Decoration.
 *
 * Rules, every one held by `generateWorld`'s tests:
 * - one or two at each Landmark: beside the House's door (either side of
 *   the path's end), the Mailbox, the Station's group, the Garden's gate and
 *   on the end of the Dock's jetty; else anywhere round it, up to five
 *   cells out, so every Landmark has at least one;
 * - a few along the path and one at an end of each bridge;
 * - never on a footprint, the jetty (but its end), a path, a bridge end, a
 *   piece of Decoration or next to another torch;
 * - never taller than the nearest Landmark (`heightCapAt`, as Decoration);
 * - never between the camera and a Landmark (`sightline.ts`). On the jetty's
 *   end the Dock's own deck does not count: the torch stands on it.
 */
import { heightCapAt } from './decoration';
import { houseYard } from './landmarks';
import { createRng } from './prng';
import { sightClearance } from './sightline';
import { type Bridge, type Cell, type Decoration, type Path, type PlacedLandmark, type PlacedLandmarkId, type Terrain, type Torch, type TorchVariant } from './types';

/** How tall each torch Variant stands, in units above its ground (⅛-unit voxels: 12 and 6). */
export const TORCH_HEIGHT: Record<TorchVariant, number> = { 1: 1.5, 2: 0.75 };
/** Most torches along the path, and the cells between them along it. */
const PATH_TORCHES = 3;
const PATH_SPACING = 5;
/** Cells round a Landmark's footprint a torch may stand in, at most, when none of its own places fit. */
const FARTHEST = 5;

/** The Landmarks in the order they get their torches. */
const TORCH_ORDER: readonly PlacedLandmarkId[] = ['mailbox', 'dock', 'house', 'garden', 'station'];

const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * The cells of a Landmark a torch must leave in view: its footprint, but for
 * the House only the House itself (its 3×3), not the open ground of its
 * yard, so a torch may stand by the yard's edge (the Mailbox keeps its own).
 */
export function torchSightCells(l: PlacedLandmark): Cell[] {
  if (l.id !== 'house') return l.footprint.cells;
  const { origin, width, depth } = houseYard(l).house;
  return l.footprint.cells.filter((c) => c.x >= origin.x && c.z >= origin.z && c.x < origin.x + width && c.z < origin.z + depth);
}

/** Place the World's torches. */
export function placeTorches(
  seed: string,
  terrain: Terrain,
  bridges: Bridge[],
  paths: Path[],
  landmarks: PlacedLandmark[],
  decoration: Decoration[],
): Torch[] {
  const { width, depth, heights, isle } = terrain;
  const index = (c: Cell) => c.z * width + c.x;
  const inGrid = (c: Cell) => c.x >= 0 && c.z >= 0 && c.x < width && c.z < depth;
  const of = (id: PlacedLandmarkId) => landmarks.find((l) => l.id === id);
  const rng = createRng(`${seed}/torches`);

  // Cells no torch may take: footprints and jetties, paths, bridge ends, Decoration.
  const blocked = new Uint8Array(width * depth);
  const block = (c: Cell) => {
    if (inGrid(c)) blocked[index(c)] = 1;
  };
  for (const l of landmarks) for (const c of [...l.footprint.cells, ...l.jetty]) block(c);
  for (const p of paths) for (const c of p.cells) block(c);
  for (const b of bridges) for (const c of b.cells) for (const [dx, dz] of SIDES) block({ x: c.x + dx, z: c.z + dz });
  for (const d of decoration) block(d.cell);

  const tallest = Math.max(...Object.values(TORCH_HEIGHT));
  const top = Math.max(...heights) + tallest;
  const clearance = sightClearance(terrain, landmarks.map((l) => ({ y: l.y, cells: [...torchSightCells(l), ...l.jetty] })), top);
  // On the jetty's end: every Landmark's sight line but the jetty's own deck.
  const jettyClearance = sightClearance(terrain, landmarks.map((l) => ({ y: l.y, cells: torchSightCells(l) })), top);

  const placed: Torch[] = [];
  const nextTo = (c: Cell) => placed.some((t) => Math.max(Math.abs(t.cell.x - c.x), Math.abs(t.cell.z - c.z)) <= 1);

  /** A torch on `cell` if one fits there, the Seed's Variant if it can (else the other). */
  const torchAt = (cell: Cell, by: Torch['by'], jetty = false): Torch | null => {
    if (!inGrid(cell) || nextTo(cell)) return null;
    const i = index(cell);
    if (!jetty && (isle[i] === -1 || blocked[i])) return null;
    const dock = of('dock');
    const y = jetty ? dock!.y : heights[i]!;
    const room = Math.min(heightCapAt(landmarks, cell), (jetty ? jettyClearance : clearance)[i]! - y);
    const first: TorchVariant = rng() < 0.5 ? 1 : 2;
    const variant = ([first, first === 1 ? 2 : 1] as const).find((v) => TORCH_HEIGHT[v] <= room);
    return variant ? { cell, y, variant, by, onJetty: jetty } : null;
  };
  const take = (torch: Torch | null) => {
    if (torch) placed.push(torch);
    return torch !== null;
  };

  /** The cells round a footprint at Chebyshev distance `r`, shuffled. */
  const ring = (cells: readonly Cell[], r: number): Cell[] => {
    const seen = new Set(cells.map((c) => `${c.x},${c.z}`));
    const out = new Map<string, Cell>();
    for (const c of cells) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const n = { x: c.x + dx, z: c.z + dz };
          const k = `${n.x},${n.z}`;
          if (seen.has(k)) continue;
          const near = cells.some((f) => Math.max(Math.abs(f.x - n.x), Math.abs(f.z - n.z)) < r);
          if (!near) out.set(k, n);
        }
      }
    }
    const list = [...out.values()];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };

  /** Each Landmark's own places for a torch, best first. */
  const ownPlaces = (l: PlacedLandmark): Cell[] => {
    const { x, z } = l.footprint.origin;
    const house = of('house');
    switch (l.id) {
      case 'house': {
        const { approach } = houseYard(l);
        return l.door === 'east' ? [{ x: approach.x, z: approach.z - 1 }, { x: approach.x, z: approach.z + 1 }] : [{ x: approach.x - 1, z: approach.z }, { x: approach.x + 1, z: approach.z }];
      }
      case 'mailbox':
        // Beside the yard's corner where the Mailbox stands, off its front (which the camera sees).
        return house ? [{ x: x + 1, z: z - 1 }, { x: x - 1, z: z + 1 }, { x: x + 1, z }, { x, z: z + 1 }] : [];
      case 'garden':
        // Either side of the gate, in the middle of the side the Garden faces.
        return l.door === 'east' ? [{ x: x + 5, z: z + 1 }, { x: x + 5, z: z + 3 }] : [{ x: x + 1, z: z + 5 }, { x: x + 3, z: z + 5 }];
      default:
        return [];
    }
  };

  // The most hemmed-in first: the Mailbox in the House's yard, the Dock on the shore.
  for (const id of TORCH_ORDER) {
    const l = of(id);
    if (!l) continue;
    const candidates: Array<{ cell: Cell; jetty?: boolean }> = [];
    const end = l.jetty.at(-1);
    if (end) candidates.push({ cell: end, jetty: true });
    for (const cell of ownPlaces(l)) candidates.push({ cell });
    for (let r = 1; r <= FARTHEST; r++) for (const cell of ring(l.footprint.cells, r)) candidates.push({ cell });
    const wants = rng() < 0.5 ? 2 : 1;
    let got = 0;
    for (const { cell, jetty } of candidates) {
      if (got === wants) break;
      if (take(torchAt(cell, id, jetty))) got++;
    }
  }

  // A few along the path, away from both ends (their Landmarks have their own).
  for (const path of paths) {
    let count = 0;
    for (let i = PATH_SPACING; i < path.cells.length - PATH_SPACING / 2 && count < PATH_TORCHES; i += PATH_SPACING) {
      const c = path.cells[i]!;
      for (const [dx, dz] of SIDES) {
        if (take(torchAt({ x: c.x + dx, z: c.z + dz }, 'path'))) {
          count++;
          break;
        }
      }
    }
  }

  // One beside an end of each bridge, on the land at its side.
  for (const b of bridges) {
    const first = b.cells[0];
    const last = b.cells.at(-1);
    if (!first || !last) continue;
    const alongX = first.z === last.z;
    const dir = alongX ? { x: Math.sign(last.x - first.x) || 1, z: 0 } : { x: 0, z: Math.sign(last.z - first.z) || 1 };
    const ends = [
      { x: first.x - dir.x, z: first.z - dir.z },
      { x: last.x + dir.x, z: last.z + dir.z },
    ];
    const beside = ends.flatMap((e) => (alongX ? [{ x: e.x, z: e.z - 1 }, { x: e.x, z: e.z + 1 }] : [{ x: e.x - 1, z: e.z }, { x: e.x + 1, z: e.z }]));
    for (const cell of beside) if (take(torchAt(cell, 'bridge'))) break;
  }
  return placed;
}
