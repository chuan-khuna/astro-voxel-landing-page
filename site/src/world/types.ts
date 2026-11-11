/**
 * World data: everything one Seed generates. Plain, serialisable data with no
 * three.js and no DOM, so it can cross a Web Worker boundary later.
 *
 * Grid coordinates: x runs east, z runs south, both in whole terrain voxels
 * (1 unit). y is height in terrain voxels; 0 is the sea floor / sea level.
 */

/** What the generator needs from content: counts only, never the copy. */
export interface ContentCounts {
  projects: number;
  clients: number;
  partners: number;
}

/** The five Landmarks that are places in the World. */
export const PLACED_LANDMARK_IDS = ['station', 'house', 'garden', 'dock', 'mailbox'] as const;
export type PlacedLandmarkId = (typeof PLACED_LANDMARK_IDS)[number];

/** The two Landmarks that are camera views derived from the layout. */
export const VIEW_LANDMARK_IDS = ['overview', 'house-interior'] as const;
export type ViewLandmarkId = (typeof VIEW_LANDMARK_IDS)[number];

export const LANDMARK_IDS = [...PLACED_LANDMARK_IDS, ...VIEW_LANDMARK_IDS] as const;
export type LandmarkId = (typeof LANDMARK_IDS)[number];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Cell {
  x: number;
  z: number;
}

/** One landmass. Its cells are those in `World.terrain.isle` equal to `id`. */
export interface Isle {
  id: number;
  /** Inclusive cell bounds of the footprint. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  cellCount: number;
}

/**
 * What the top voxel of a column is made of. `sea` for sea cells; `sand` for
 * low land at the water's edge; `peak` for the high ground of a tall Isle;
 * `grass` elsewhere.
 */
export type SurfaceKind = 'sea' | 'sand' | 'grass' | 'peak';

/**
 * The World's height grid, row-major (`index = z * width + x`).
 * `heights[i]` is the top of the land column in whole voxels (0 = sea);
 * `isle[i]` is the Isle id owning the cell, or -1 for sea;
 * `surface[i]` is what the column's top voxel is made of.
 */
export interface Terrain {
  width: number;
  depth: number;
  heights: number[];
  isle: number[];
  surface: SurfaceKind[];
}

/**
 * The rock layer of a voxel below a column's top, by absolute height:
 * `strata[y]` is the layer of every buried voxel at height `y` (0 is the
 * voxel just above the sea floor). Shared by every column, so cliffs show
 * the same layered cross-section all round the World.
 */
export type StratumKind = 'soil' | 'rock' | 'rockDark';

/**
 * A straight bridge over the sea between two Isles. `cells` are the sea
 * cells it spans, in order from the `from` Isle to the `to` Isle; the land
 * cells at both ends have height `y`, and so does the deck.
 */
export interface Bridge {
  from: number;
  to: number;
  cells: Cell[];
  y: number;
}

/**
 * A walkable path between two placed Landmarks: 4-connected cells from the
 * `from` Landmark's cell to the `to` Landmark's cell, crossing land and
 * bridges. Each step changes height by at most one voxel.
 */
export interface Path {
  from: PlacedLandmarkId;
  to: PlacedLandmarkId;
  cells: Cell[];
}

/** Compass direction on the grid: north is -z, east is +x. */
export type Facing = 'north' | 'east' | 'south' | 'west';

/**
 * Stairs on the lower cell of a single-step height change along a Path.
 * `y` is the lower cell's height; the stairs climb towards `facing`.
 */
export interface Stair {
  cell: Cell;
  y: number;
  facing: Facing;
}

export const BIOME_IDS = ['tropical', 'northern', 'autumn', 'volcanic'] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

/** An OKLCH colour: lightness 0–1, chroma, hue in degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** The colour roles every Biome fills. */
export const BIOME_COLOUR_ROLES = [
  'sand',
  'grass',
  'peak',
  'foliage',
  'soil',
  'rock',
  'rockDark',
  'path',
  'bridge',
  'waterShallow',
  'waterDeep',
  'accent',
] as const;
export type BiomeColourRole = (typeof BIOME_COLOUR_ROLES)[number];

/** A muted, hand-tuned colour set for the whole World. Every chroma is at most 0.10. */
export interface Biome {
  id: BiomeId;
  colours: Record<BiomeColourRole, Oklch>;
}

/**
 * The ground a placed Landmark stands on: a rectangle of whole cells.
 * `origin` is its min (north-west) corner cell; `width` runs east (x),
 * `depth` south (z); `cells` lists every cell it covers.
 */
export interface Footprint {
  origin: Cell;
  width: number;
  depth: number;
  cells: Cell[];
}

export interface PlacedLandmark {
  id: PlacedLandmarkId;
  isle: number;
  /** Flat land of one Isle, all at height `y`; it overlaps nothing else. */
  footprint: Footprint;
  /** Ground height under the whole footprint, in voxels. */
  y: number;
  /** Which model variant to draw. Every Landmark has only variant 0 for now. */
  variant: number;
  /** Garden only (empty otherwise): one cell per tree, in Project order, inside the footprint. */
  trees: Cell[];
  /**
   * Dock only (empty otherwise): the jetty's sea cells, in a straight line
   * from the one beside the footprint outwards. Its deck is at height `y`.
   */
  jetty: Cell[];
}

/**
 * A Client's boat, moored at the Dock: a sea cell beside the jetty (or just
 * beyond it), the bow pointing out to sea along the jetty. A berth may lie
 * past the terrain grid's edge, in the open sea around it.
 */
export interface Boat {
  cell: Cell;
  facing: Facing;
}

/**
 * A Partner's ship and the loop it sails: `cells` are sea cells, each an
 * 8-neighbour of the one before and the last of the first, sailed in order
 * and round again. Every cell keeps clear of land, bridges, the jetty and
 * the moored boats. Cells may lie past the terrain grid's edge. `phase`
 * (0–1) is how far round the loop the ship starts, so ships sharing a loop
 * keep apart.
 */
export interface ShipRoute {
  cells: Cell[];
  phase: number;
}

/** A camera view: what to look at and how much of the World to fit. */
export interface View {
  target: Vec3;
  /** Half-extent, in world units, that the view should keep in frame. */
  radius: number;
}

export interface World {
  /** The Seed actually used: the given Seed, or the default Seed if it fell back. */
  seed: string;
  /** How many layouts were tried; 1 means the first layout kept every rule. */
  attempts: number;
  biome: Biome;
  terrain: Terrain;
  strata: StratumKind[];
  isles: Isle[];
  bridges: Bridge[];
  paths: Path[];
  stairs: Stair[];
  landmarks: PlacedLandmark[];
  /** One boat per Client, in Client order, up to `MAX_BOATS`. */
  boats: Boat[];
  /** One sailing ship per Partner, in Partner order. */
  ships: ShipRoute[];
  /** Buoys: sea cells, each with a buoy whose lamp glows at Night. Clear of the ships, boats, jetty and bridges. */
  buoys: Cell[];
  views: Record<ViewLandmarkId, View>;
}
