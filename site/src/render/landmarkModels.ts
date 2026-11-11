/**
 * Code-built Landmark models in ¼-unit voxels, one per placed Landmark. The
 * Station's and the Mailbox's are real models (tickets 09 and 12); the
 * Garden's and the Dock's are simple placeholders. Each moves to an ASCII
 * structure at ⅛ unit (`structureModels.ts`) in a later polish ticket. The
 * House already has: its structure is drawn by `structureModels.ts` and
 * `house.ts`, and only its room (`houseModel.ts`) is drawn here.
 *
 * Each model fills its Landmark's footprint, but for the House's, whose
 * plot holds the House structure, its front yard and the Mailbox. It is drawn into the detail
 * grid with its origin at the min corner of the footprint's origin cell, on
 * top of the ground: local x runs 0 to `4 × width`, local z 0 to `4 × depth`,
 * and local y = 0 is the first voxel above the ground.
 */
import { HOUSE_CELLS, type Cell, type PlacedLandmark, type PlacedLandmarkId } from '@/world';
import type { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';
import { drawHouseRoom, type HouseDraw } from './houseModel';
import { HOUSE_HEIGHT } from './structureModels';

interface Origin {
  x: number;
  y: number;
  z: number;
}

type Draw = HouseDraw;

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

/** How tall a Garden tree is, in ¼ voxels. */
const TREE_HEIGHT = 8;

const MODELS: Record<PlacedLandmarkId, Model> = {
  /**
   * The data station (2×2, so 8×8 here): a concrete pad; a metal control hut
   * with a blue door and windows on the faces the camera sees, a flat roof
   * and a dish on it; a lattice mast at the back topped by an accent light;
   * and, in the front yard, two server cabinets with status lights and a
   * data tank. Taller parts stand at the back (low x and z) so they never
   * hide the hut's door.
   */
  station: ({ box, set }, { fixed, biome }, { w, d }) => {
    box(0, 0, 0, w, 1, d, fixed('concrete'));
    // The hut, its roof overhanging on the back and the sides.
    box(1, 1, 1, 6, 6, 5, fixed('metal'));
    box(0, 6, 0, 7, 7, 6, fixed('metalDark'));
    box(2, 1, 4, 4, 5, 5, fixed('blueDoor'));
    box(4, 3, 4, 5, 5, 5, fixed('glass'));
    box(5, 3, 2, 6, 5, 4, fixed('glass'));
    // A dish on the roof, its feed in the middle.
    box(4, 7, 3, 5, 8, 4, fixed('metal'));
    box(3, 8, 2, 6, 9, 5, fixed('whitewash'));
    box(4, 9, 3, 5, 10, 4, fixed('metalDark'));
    // The mast: a thin post through the roof's back corner, a crossbar and the accent light.
    box(1, 7, 1, 2, 16, 2, fixed('metal'));
    box(0, 12, 1, 3, 13, 2, fixed('metalDark'));
    box(1, 12, 0, 2, 13, 3, fixed('metalDark'));
    box(1, 16, 1, 2, 17, 2, biome('accent'));
    // Server cabinets in the front yard, each with a status light.
    for (const x of [1, 4]) {
      box(x, 1, 6, x + 2, 4, 7, fixed('metalDark'));
      set(x, 3, 6, biome('accent'));
    }
    // A data tank in the front corner.
    box(w - 2, 1, d - 3, w, 4, d - 1, fixed('whitewash'));
    box(w - 2, 4, d - 3, w, 5, d - 1, fixed('metal'));
  },
  /** The House's room (`houseModel.ts`); the House round it is a structure (`structureModels.ts`). */
  house: (draw, colours) => {
    drawHouseRoom(draw, colours);
  },
  /** One tree per Project, each filling its cell, and a flower in every other cell. */
  garden: ({ box, set }, { biome, fixed }, { w, d, trees }) => {
    const treeAt = new Set(trees.map((t) => `${t.x},${t.z}`));
    for (let z = 0; z < d; z += GROUND_DETAIL) {
      for (let x = 0; x < w; x += GROUND_DETAIL) {
        if (treeAt.has(`${x},${z}`)) {
          box(x + 1, 0, z + 1, x + 3, 3, z + 3, fixed('trunk'));
          box(x, 3, z, x + 4, 7, z + 4, biome('foliage'));
          box(x + 1, 7, z + 1, x + 3, TREE_HEIGHT, z + 3, biome('foliage', 0.04));
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
      box(c.x, -1, c.z, c.x + GROUND_DETAIL, 0, c.z + GROUND_DETAIL, fixed('plank'));
      for (const [px, pz] of [
        [0, 0],
        [GROUND_DETAIL - 1, GROUND_DETAIL - 1],
      ] as const) {
        box(c.x + px, -ground, c.z + pz, c.x + px + 1, -1, c.z + pz + 1, fixed('trunk'));
      }
    }
  },
  /**
   * The Mailbox (1×1, so 4×4 here; 8 tall): a flagstone pad; a wooden post;
   * a blue box on it, long front to back, with a darker lid and a darker door
   * on its front (+z), and a letter poking out above the door; a red flag
   * raised on its +x side, the side the camera sees, up to the model's top;
   * and a flower at the pad's front corner.
   */
  mailbox: ({ box, set }, { fixed, biome }) => {
    box(0, 0, 0, 4, 1, 4, fixed('concrete'));
    box(1, 1, 1, 3, 4, 3, fixed('trunk'));
    box(1, 4, 0, 3, 6, 3, fixed('blueTrim'));
    box(1, 6, 0, 3, 7, 3, fixed('blueDoor'));
    box(1, 4, 3, 3, 6, 4, fixed('blueDoor'));
    set(1, 6, 3, fixed('sail'));
    // The flag: an arm up the box's side, its red pennant at the top.
    box(3, 4, 1, 4, 7, 2, fixed('metalDark'));
    box(3, 7, 1, 4, 8, 3, fixed('flagRed'));
    set(0, 1, 3, fixed('bougainvillea'));
    set(3, 1, 3, biome('foliage', -0.04));
  },
};

function shapeOf(landmark: PlacedLandmark): Shape {
  const { origin, width, depth } = landmark.footprint;
  const local = (c: Cell) => ({ x: (c.x - origin.x) * GROUND_DETAIL, z: (c.z - origin.z) * GROUND_DETAIL });
  return {
    w: width * GROUND_DETAIL,
    d: depth * GROUND_DETAIL,
    ground: landmark.y * GROUND_DETAIL,
    trees: landmark.trees.map(local),
    jetty: landmark.jetty.map(local),
    variant: landmark.variant,
  };
}

/** Where a Landmark's model starts in the detail grid: its footprint's min corner, on the ground. */
export function landmarkOrigin(landmark: PlacedLandmark): Origin {
  const { origin } = landmark.footprint;
  return { x: origin.x * GROUND_DETAIL, y: landmark.y * GROUND_DETAIL, z: origin.z * GROUND_DETAIL };
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
 * draws, and at least the whole footprint and jetty; for the House, the
 * House itself (its 3×3 and its roof), not its yard, where the Mailbox
 * stands. Used to size the Landmark's hotspot over the canvas (so it covers
 * the whole footprint), the Guide's spot beside it and its Data Card.
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
  // The ground the Landmark stands on: its footprint (the House's own 3×3), plus the jetty's deck.
  const ground = landmark.id === 'house' ? HOUSE_CELLS * GROUND_DETAIL : null;
  cover(0, 0, 0, ground ?? shape.w, 0, ground ?? shape.d);
  for (const c of shape.jetty) cover(c.x, -1, c.z, c.x + GROUND_DETAIL, 0, c.z + GROUND_DETAIL);
  // Models only pick colours through `biome` and `fixed`; any id will do here.
  const anyColour = () => 0;
  const colours = { biome: anyColour, fixed: anyColour } as Omit<WorldColours, 'table'> as WorldColours;
  MODELS[landmark.id](draw, colours, shape);
  // The House's structure, up to its roof (the tallest Variant's), is part of what a visitor clicks.
  if (ground !== null) cover(0, 0, 0, ground, HOUSE_HEIGHT * GROUND_DETAIL, ground);
  // Posts reaching down to the sea floor are not part of what a visitor clicks.
  min.y = Math.max(min.y, -1);
  const unit = (v: number) => v / GROUND_DETAIL;
  return {
    min: { x: unit(min.x), y: unit(min.y), z: unit(min.z) },
    max: { x: unit(max.x), y: unit(max.y), z: unit(max.z) },
  };
}

/**
 * The box one Garden tree covers, in world units relative to the Garden's
 * model origin (like `landmarkExtent`): its cell, from the ground to the top
 * of its canopy. Used to size the tree's own hotspot.
 */
export function treeExtent(garden: PlacedLandmark, tree: Cell): ModelExtent {
  const x = tree.x - garden.footprint.origin.x;
  const z = tree.z - garden.footprint.origin.z;
  return { min: { x, y: 0, z }, max: { x: x + 1, y: TREE_HEIGHT / GROUND_DETAIL, z: z + 1 } };
}
