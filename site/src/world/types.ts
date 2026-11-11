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
 * The World's height grid, row-major (`index = z * width + x`).
 * `heights[i]` is the top of the land column in voxels (0 = sea);
 * `isle[i]` is the Isle id owning the cell, or -1 for sea.
 */
export interface Terrain {
  width: number;
  depth: number;
  heights: number[];
  isle: number[];
}

export interface PlacedLandmark {
  id: PlacedLandmarkId;
  isle: number;
  cell: Cell;
  /** Ground height under the Landmark, in voxels. */
  y: number;
  /** Which model variant to draw. Every Landmark has only variant 0 for now. */
  variant: number;
}

/** A camera view: what to look at and how much of the World to fit. */
export interface View {
  target: Vec3;
  /** Half-extent, in world units, that the view should keep in frame. */
  radius: number;
}

export interface World {
  seed: string;
  terrain: Terrain;
  isles: Isle[];
  landmarks: PlacedLandmark[];
  views: Record<ViewLandmarkId, View>;
}
