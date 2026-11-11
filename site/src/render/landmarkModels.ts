/**
 * Landmark models in ¼-unit voxels. These are simple placeholders, one per
 * placed Landmark, so the render path for ¼-unit models is in place; the
 * real models replace them in later tickets by changing only this module.
 *
 * Each model fills its Landmark's footprint. It is drawn into the detail
 * grid with its origin at the min corner of the footprint's origin cell, on
 * top of the ground: local x runs 0 to `4 × width`, local z 0 to `4 × depth`,
 * and local y = 0 is the first voxel above the ground.
 */
import type { Cell, PlacedLandmark, PlacedLandmarkId } from '../world';
import type { VoxelGrid } from './mesher';
import { DETAIL, type WorldColours } from './worldVoxels';

interface Origin {
  x: number;
  y: number;
  z: number;
}

type Draw = {
  box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number | null) => void;
  set: (x: number, y: number, z: number, colour: number) => void;
};

/** What a model needs to know about its Landmark, in local ¼ voxels. */
interface Shape {
  /** Footprint size along x and z. */
  w: number;
  d: number;
  /** Ground height in ¼ voxels (how far down the sea floor is). */
  ground: number;
  /** Garden: the min corner of each tree's cell. */
  trees: Array<{ x: number; z: number }>;
  /** Dock: the min corner of each jetty cell. */
  jetty: Array<{ x: number; z: number }>;
  variant: number;
}

type Model = (draw: Draw, colours: WorldColours, shape: Shape) => void;

const MODELS: Record<PlacedLandmarkId, Model> = {
  /** A paved pad with a low hut and a grey mast topped by an accent light. */
  station: ({ box }, { fixed, biome }, { w, d }) => {
    box(0, 0, 0, w, 1, d, fixed('metalDark'));
    box(1, 1, 1, w - 1, 5, d - 1, fixed('metal'));
    box(1, 5, 1, w - 1, 6, d - 1, fixed('metalDark'));
    const mx = Math.floor(w / 2) - 1;
    const mz = Math.floor(d / 2) - 1;
    box(mx, 6, mz, mx + 2, 16, mz + 2, fixed('metal'));
    box(mx - 1, 12, mz - 1, mx + 3, 13, mz + 3, fixed('metalDark'));
    box(mx, 16, mz, mx + 2, 17, mz + 2, biome('accent'));
  },
  /** A whitewashed block on a plinth, with a blue door, windows, a flat roof and a blue dome. */
  house: ({ box, set }, { fixed }, { w, d }) => {
    box(0, 0, 0, w, 1, d, fixed('plinth'));
    box(1, 1, 1, w - 1, 9, d - 1, fixed('whitewash'));
    box(0, 9, 0, w, 10, d, fixed('roofWhite'));
    const mid = Math.floor(w / 2);
    box(mid - 1, 1, d - 2, mid + 1, 6, d - 1, fixed('blueDoor'));
    for (const z of [2, d - 4]) box(w - 2, 5, z, w - 1, 7, z + 2, fixed('glass'));
    box(2, 5, d - 2, 4, 7, d - 1, fixed('glass'));
    box(mid - 2, 10, Math.floor(d / 2) - 2, mid + 2, 12, Math.floor(d / 2) + 2, fixed('blueTrim'));
    box(mid - 1, 12, Math.floor(d / 2) - 1, mid + 1, 13, Math.floor(d / 2) + 1, fixed('blueTrim'));
    set(1, 7, d - 2, fixed('bougainvillea'));
    set(1, 6, d - 2, fixed('bougainLight'));
    set(1, 8, d - 3, fixed('bougainvillea'));
  },
  /** One tree per Project, each filling its cell, and a flower in every other cell. */
  garden: ({ box, set }, { biome, fixed }, { w, d, trees }) => {
    const treeAt = new Set(trees.map((t) => `${t.x},${t.z}`));
    for (let z = 0; z < d; z += DETAIL) {
      for (let x = 0; x < w; x += DETAIL) {
        if (treeAt.has(`${x},${z}`)) {
          box(x + 1, 0, z + 1, x + 3, 3, z + 3, fixed('trunk'));
          box(x, 3, z, x + 4, 7, z + 4, biome('foliage'));
          box(x + 1, 7, z + 1, x + 3, 8, z + 3, biome('foliage', 0.04));
          set(x, 3, z, biome('foliage', -0.04));
        } else {
          set(x + 1, 0, z + 2, (x + z) % 8 === 0 ? fixed('bougainvillea') : fixed('bougainLight'));
          set(x + 2, 0, z + 1, biome('foliage', -0.04));
        }
      }
    }
  },
  /** A plank platform on the shore and a jetty on posts out over the sea. */
  dock: ({ box }, { fixed }, { w, d, ground, jetty }) => {
    box(0, 0, 0, w, 1, d, fixed('plank'));
    for (const c of jetty) {
      // The deck's top is level with the ground, like a bridge's.
      box(c.x, -1, c.z, c.x + DETAIL, 0, c.z + DETAIL, fixed('plank'));
      for (const [px, pz] of [
        [0, 0],
        [DETAIL - 1, DETAIL - 1],
      ] as const) {
        box(c.x + px, -ground, c.z + pz, c.x + px + 1, -1, c.z + pz + 1, fixed('trunk'));
      }
    }
  },
  /** A post with a blue box. */
  mailbox: ({ box }, { fixed }) => {
    box(1, 0, 1, 3, 3, 3, fixed('trunk'));
    box(0, 3, 0, 4, 6, 4, fixed('blueTrim'));
    box(1, 6, 1, 3, 7, 3, fixed('blueDoor'));
  },
};

function shapeOf(landmark: PlacedLandmark): Shape {
  const { origin, width, depth } = landmark.footprint;
  const local = (c: Cell) => ({ x: (c.x - origin.x) * DETAIL, z: (c.z - origin.z) * DETAIL });
  return {
    w: width * DETAIL,
    d: depth * DETAIL,
    ground: landmark.y * DETAIL,
    trees: landmark.trees.map(local),
    jetty: landmark.jetty.map(local),
    variant: landmark.variant,
  };
}

/** Where a Landmark's model starts in the detail grid: its footprint's min corner, on the ground. */
export function landmarkOrigin(landmark: PlacedLandmark): Origin {
  const { origin } = landmark.footprint;
  return { x: origin.x * DETAIL, y: landmark.y * DETAIL, z: origin.z * DETAIL };
}

export function buildLandmark(landmark: PlacedLandmark, grid: VoxelGrid, colours: WorldColours): void {
  const origin = landmarkOrigin(landmark);
  const draw: Draw = {
    box: (x0, y0, z0, x1, y1, z1, colour) =>
      grid.box(origin.x + x0, origin.y + y0, origin.z + z0, origin.x + x1, origin.y + y1, origin.z + z1, colour),
    set: (x, y, z, colour) => grid.set(origin.x + x, origin.y + y, origin.z + z, colour),
  };
  MODELS[landmark.id](draw, colours, shapeOf(landmark));
}

/**
 * The box a Landmark covers, in world units relative to its model's origin
 * (the min corner of its footprint, on the ground): everything the model
 * draws, and at least the whole footprint and jetty. Used to size the
 * Landmark's hotspot over the canvas, so the hotspot covers the whole
 * footprint.
 */
export interface ModelExtent {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export function landmarkExtent(landmark: PlacedLandmark): ModelExtent {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const cover = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    min.x = Math.min(min.x, x0, x1);
    min.y = Math.min(min.y, y0, y1);
    min.z = Math.min(min.z, z0, z1);
    max.x = Math.max(max.x, x0, x1);
    max.y = Math.max(max.y, y0, y1);
    max.z = Math.max(max.z, z0, z1);
  };
  const draw: Draw = {
    box: (x0, y0, z0, x1, y1, z1) => cover(x0, y0, z0, x1, y1, z1),
    set: (x, y, z) => cover(x, y, z, x + 1, y + 1, z + 1),
  };
  const shape = shapeOf(landmark);
  // The ground the Landmark stands on: its footprint, plus the jetty's deck.
  cover(0, 0, 0, shape.w, 0, shape.d);
  for (const c of shape.jetty) cover(c.x, -1, c.z, c.x + DETAIL, 0, c.z + DETAIL);
  // Models only pick colours through `biome` and `fixed`; any id will do here.
  const anyColour = () => 0;
  MODELS[landmark.id](draw, { biome: anyColour, fixed: anyColour } as Omit<WorldColours, 'table'> as WorldColours, shape);
  // Posts reaching down to the sea floor are not part of what a visitor clicks.
  min.y = Math.max(min.y, -1);
  const unit = (v: number) => v / DETAIL;
  return {
    min: { x: unit(min.x), y: unit(min.y), z: unit(min.z) },
    max: { x: unit(max.x), y: unit(max.y), z: unit(max.z) },
  };
}
