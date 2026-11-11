/**
 * The ¼-unit parts of the Landmarks, drawn into the detail grid: the Dock's
 * plank deck and jetty on posts (ground detail, ADR 0006). Everything else a
 * Landmark shows is its Variant's ⅛-unit structure (`structureModels.ts`):
 * the House, the Station, the Mailbox, the things on the Dock's deck and
 * the Garden's fence. The House's room is the House Interior's, drawn at ⅛
 * unit (`interiorModel.ts`); the Garden's plants are instanced structures
 * (`gardenPlants.ts`).
 *
 * A model is drawn with its origin at the min corner of the footprint's
 * origin cell, on top of the ground: local x runs 0 to `4 × width`, local z
 * 0 to `4 × depth`, and local y = 0 is the first voxel above the ground.
 */
import { HOUSE_CELLS, type Cell, type PlacedLandmark, type PlacedLandmarkId, type World } from '@/world';
import type { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';
import { GROUND_DETAIL, STRUCTURE } from './voxelTiers';
import { drawStructure, landmarkPlacement, landmarkStructure } from './structureModels';
import { gardenPlantsOf, plantExtent } from './gardenPlants';

interface Origin {
  x: number;
  y: number;
  z: number;
}

/** Draws ¼ voxels: `box` fills [x0, x1) × [y0, y1) × [z0, z1). */
interface Draw {
  box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number | null) => void;
  set: (x: number, y: number, z: number, colour: number) => void;
}

/** What a model needs to know about its Landmark, in local ¼ voxels. */
interface Shape {
  /** Footprint size along x and z. */
  w: number;
  d: number;
  /** Ground height in ¼ voxels (how far down the sea floor is). */
  ground: number;
  /** Dock: the min corner of each jetty cell. */
  jetty: Array<{ x: number; z: number }>;
  variant: number;
}

type Model = (draw: Draw, colours: WorldColours, shape: Shape) => void;

const MODELS: Record<PlacedLandmarkId, Model> = {
  /** The Station is a structure (`structureModels.ts`): nothing at ¼ unit. */
  station: () => {},
  /** The House is a structure (`structureModels.ts`), its room the House Interior's (`interiorModel.ts`): nothing at ¼ unit. */
  house: () => {},
  /** The Garden's fence is a structure, its plants instanced structures (`gardenPlants.ts`): nothing at ¼ unit. */
  garden: () => {},
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
  /** The Mailbox is a structure (`structureModels.ts`), in the House's yard: nothing at ¼ unit. */
  mailbox: () => {},
};

function shapeOf(landmark: PlacedLandmark): Shape {
  const { origin, width, depth } = landmark.footprint;
  const local = (c: Cell) => ({ x: (c.x - origin.x) * GROUND_DETAIL, z: (c.z - origin.z) * GROUND_DETAIL });
  return {
    w: width * GROUND_DETAIL,
    d: depth * GROUND_DETAIL,
    ground: landmark.y * GROUND_DETAIL,
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
 * (the min corner of its footprint, on the ground): everything its ¼-unit
 * model and its Variant's structure draw (the House with its lid on, the
 * Garden with its plants), and at least the whole footprint and jetty; for the House, the
 * House itself (its 3×3 and its roof), not its yard, where the Mailbox
 * stands. Used to size the Landmark's hotspot over the canvas (so it covers
 * the whole footprint), the Guide's spot beside it and its Data Card.
 */
export interface ModelExtent {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export function landmarkExtent(world: Pick<World, 'biome' | 'landmarks'>, landmark: PlacedLandmark): ModelExtent {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  /** Cover a box given in voxels of `per` to a unit, from the model's origin. */
  const cover = (per: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    min.x = Math.min(min.x, x0 / per, x1 / per);
    min.y = Math.min(min.y, y0 / per, y1 / per);
    min.z = Math.min(min.z, z0 / per, z1 / per);
    max.x = Math.max(max.x, x0 / per, x1 / per);
    max.y = Math.max(max.y, y0 / per, y1 / per);
    max.z = Math.max(max.z, z0 / per, z1 / per);
  };
  const draw: Draw = {
    box: (x0, y0, z0, x1, y1, z1) => cover(GROUND_DETAIL, x0, y0, z0, x1, y1, z1),
    set: (x, y, z) => cover(GROUND_DETAIL, x, y, z, x + 1, y + 1, z + 1),
  };
  const shape = shapeOf(landmark);
  // The ground the Landmark stands on: its footprint (the House's own 3×3), plus the jetty's deck.
  const houseSide = landmark.id === 'house' ? HOUSE_CELLS * GROUND_DETAIL : null;
  cover(GROUND_DETAIL, 0, 0, 0, houseSide ?? shape.w, 0, houseSide ?? shape.d);
  for (const c of shape.jetty) cover(GROUND_DETAIL, c.x, -1, c.z, c.x + GROUND_DETAIL, 0, c.z + GROUND_DETAIL);
  // Models only pick colours through `biome` and `fixed`; any id will do here.
  const anyColour = () => 0;
  const colours = { biome: anyColour, fixed: anyColour } as Omit<WorldColours, 'table'> as WorldColours;
  MODELS[landmark.id](draw, colours, shape);
  // The Landmark's Variant (the whole House, its lid on), at ⅛ unit.
  const { origin } = landmark.footprint;
  const at = { x: origin.x * STRUCTURE, y: landmark.y * STRUCTURE, z: origin.z * STRUCTURE };
  drawStructure(landmarkStructure(world, landmark), landmarkPlacement(world, landmark), colours, (x, y, z) =>
    cover(STRUCTURE, x - at.x, y - at.y, z - at.z, x - at.x + 1, y - at.y + 1, z - at.z + 1),
  );
  // The Garden's plants.
  if (landmark.id === 'garden') {
    for (const plant of gardenPlantsOf(world)) {
      const { min: lo, max: hi } = plantExtent(landmark, plant);
      cover(1, lo.x, lo.y, lo.z, hi.x, hi.y, hi.z);
    }
  }
  // Posts reaching down to the sea floor are not part of what a visitor clicks.
  min.y = Math.max(min.y, -1 / GROUND_DETAIL);
  return { min, max };
}
