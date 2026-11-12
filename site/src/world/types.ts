/**
 * World data: everything one Seed generates. Plain, serialisable data with no
 * three.js and no DOM, so it can cross a Web Worker boundary later.
 *
 * Grid coordinates: x runs east, z runs south, both in whole terrain voxels
 * (1 unit). y is height in terrain voxels; 0 is the sea floor / sea level.
 */

/** What the generator needs from content: counts and stable ids only, never the copy. */
export interface ContentCounts {
  projects: number;
  /** How many of the Projects are Pinned Projects (default 0): they take the Garden's places first, as flowers. */
  pinned?: number;
  clients: number;
  partners: number;
  /** The Clients' ids, in Client order (by id): each boat's kind comes from its Client's id. Stand-ins (`client-<n>`) fill any gap. */
  clientIds?: readonly string[];
  /** The Partners' ids, in id order (the Dock's list sorts Partners by tier first; the order only decides which loop each ship sails): each ship's kind comes from its Partner's id. Stand-ins (`partner-<n>`) fill any gap. */
  partnerIds?: readonly string[];
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
  /**
   * The radius, in cells, the Isle was shaped from: noise moves its coast up
   * to 30% of it in or out. Its range depends on how many Isles the World
   * has (`ISLE_RADIUS` in `terrain.ts`).
   */
  radius: number;
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
  /** Its Landmark Variant: 1 to its count in the Biome's style (`LANDMARK_VARIANTS`), picked by the Seed. */
  variant: number;
  /**
   * The House and the Garden only (null otherwise): the way the House's
   * door, or the Garden's gate, faces: south (+z) or east (+x), the two
   * sides the camera sees. The House fills the north-west 3×3 of its 4×4
   * plot (`footprint`); the other seven cells are its front yard, and the
   * Dock-to-House path ends just outside the yard, in line with the door
   * (`houseYard`). The Garden's gate is in the middle of its fence on the
   * side facing the House.
   */
  door: Facing | null;
  /**
   * Garden only (empty otherwise): one cell per Pinned Project that blooms
   * as a flower, in Garden order (`gardenPlants`), in the bed's front two
   * rows (`GARDEN_BED`).
   */
  flowers: Cell[];
  /**
   * Garden only (empty otherwise): one cell per Project that grows as a
   * tree, in Garden order after the flowers, in the bed's back row.
   */
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
  /** Its kind, 1 to `BOAT_KINDS`, from its Client's id (`vesselKind`): the same in every World. */
  kind: number;
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
  /** The ship's kind, 1 to `SHIP_KINDS`, from its Partner's id (`vesselKind`): the same in every World. */
  kind: number;
}

/**
 * The kinds of Decoration, each a structure kind (`structures/<kind>/`)
 * drawn in every Biome's style: tufts of grass, a flower clump, a rock
 * pile, a bush and a small tree (a smaller species than the Garden's), then
 * the minor buildings: a fence run, a lamp, a shed and a windmill.
 */
export const DECORATION_KINDS = ['grass', 'clump', 'rocks', 'bush', 'sapling', 'fence', 'lamp', 'shed', 'windmill'] as const;
export type DecorationKind = (typeof DECORATION_KINDS)[number];

/**
 * One piece of Decoration: scenery that stands for nothing and cannot be
 * clicked, on one land cell, turned to `facing` (its structure is drawn
 * facing south, +z).
 */
export interface Decoration {
  kind: DecorationKind;
  cell: Cell;
  facing: Facing;
}

/**
 * The kinds of Ambient Life particle (ADR 0005): single-colour ⅛-unit cubes
 * moved in the shader, with no structure file. Which are out depends on the
 * Biome and on Day or Night (`PARTICLE_SETS` in `particles.ts`). Leaves are
 * particles too, but fall from the trees (`render/fallingLeaves.ts`).
 */
export const PARTICLE_KINDS = ['butterfly', 'firefly', 'snow', 'ash'] as const;
export type ParticleKind = (typeof PARTICLE_KINDS)[number];

/**
 * Where a swarm of one kind of particle lives: a box of air over the land.
 * Its particles never leave it. Across the ground it is the square
 * `centre` ± `radius` (world units); upwards it runs from `floor` to `top`
 * (absolute heights, in units). It covers no footprint or jetty, no sea, no
 * bridge and nothing taller than its floor, and no Landmark's sight line
 * to the camera passes below its top.
 */
export interface ParticleArea {
  kind: ParticleKind;
  centre: { x: number; z: number };
  radius: number;
  /** The ground under its centre: no cell under the box is higher. */
  ground: number;
  floor: number;
  top: number;
}

/**
 * A cloud (`clouds.ts`): a slightly translucent mass of 1-unit voxels that
 * drifts high over the sea, down the wind, from `from` to `to` and again,
 * fading in at the start and out at the end. Its body never passes over an
 * Isle, nor between the camera and one.
 */
export interface Cloud {
  /** Its voxels, 1 unit each: cells of its box, x and z across from its corner, y up from its base. */
  voxels: Array<{ x: number; y: number; z: number }>;
  /** Its box, in voxels: across (x), up (y), across (z). */
  size: { x: number; y: number; z: number };
  /** The height of its underside, in units. */
  base: number;
  /** Where its box's corner starts and ends a drift (world units): `to − from` runs down the wind. */
  from: { x: number; z: number };
  to: { x: number; z: number };
  /** Seconds a drift from `from` to `to` takes. */
  period: number;
  /** How far through a drift it is at time 0, 0–1. */
  phase: number;
}

/**
 * A school of fish (`fish.ts`): 3–5 fish of the Biome's species swimming in
 * the shallows, inside the square of water `centre` ± `radius` (world units;
 * the centre is a grid corner). Every cell under it is open shallow sea.
 */
export interface FishSchool {
  centre: { x: number; z: number };
  radius: number;
  /** How many fish swim in it: 3–5. */
  size: number;
}

/**
 * The land animals, one species a Biome (`ANIMAL_SPECIES` in `animals.ts`),
 * each a ⅛-unit structure (`structures/animal/<biome>-1`).
 */
export const ANIMAL_SPECIES_IDS = ['junglefowl', 'deer', 'squirrel', 'goat'] as const;
export type AnimalSpecies = (typeof ANIMAL_SPECIES_IDS)[number];

/**
 * A land animal (`animals.ts`): it rests at `rest`, walks its short `route`
 * (4-connected cells, `route[0]` is `rest`) to the end and back, grazing or
 * looking round on the way. Every cell of the route is level land of its
 * Isle at height `y`.
 */
export interface LandAnimal {
  species: AnimalSpecies;
  isle: number;
  rest: Cell;
  route: Cell[];
  /** The ground under its whole route, in units. */
  y: number;
}

/** Which kinds of creature are out (`CREATURE_SETS`): the land animals, birds or bats. */
export type CreatureKind = 'animal' | 'bird' | 'bat';

/**
 * A bird (or a bat) circling over an Isle (`birds.ts`): round the circle
 * `centre` ± `radius` (world units) at `height`, higher than every Landmark
 * and lower than every cloud.
 */
export interface BirdFlight {
  /** A bird by Day, or a bat at Night: whichever its Biome has. */
  kind: 'bird' | 'bat';
  centre: { x: number; z: number };
  radius: number;
  /** The middle of its body, in units. */
  height: number;
  /** Radians a second it goes round (its sign, which way). */
  turn: number;
  /** Where round the circle it is at time 0, radians. */
  phase: number;
}

/** The World's wind (`wind.ts`): which way it blows across the ground, a unit vector in x and z. Gusts are added at runtime. */
export interface Wind {
  direction: { x: number; z: number };
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
  /** One sailing ship per Partner, in the order of `partnerIds` (by id). */
  ships: ShipRoute[];
  /** Buoys: sea cells, each with a buoy whose lamp glows at Night. Clear of the ships, boats, jetty and bridges. */
  buoys: Cell[];
  /** Decoration, in the order it was placed (`decoration.ts`): never on a footprint, a path, a bridge end or in the Garden, never in front of a Landmark. */
  decoration: Decoration[];
  /** Where the Biome's particles live (`particles.ts`): by Day and at Night; the renderer shows the ones out. */
  particles: ParticleArea[];
  /** The clouds (`clouds.ts`): drifting down the wind high over the sea, never over an Isle. */
  clouds: Cloud[];
  /** The fish schools (`fish.ts`): in the shallows, clear of the jetty, the boats and the ships. */
  fish: FishSchool[];
  /** The land animals (`animals.ts`): at most 3 an Isle, round-robin by Isle, so the first few are on different Isles. */
  animals: LandAnimal[];
  /** The birds or bats (`birds.ts`): circling over the Isles, above every Landmark, out of every Landmark's view. */
  birds: BirdFlight[];
  /** The wind, from the Seed alone: Ambient Life sways and drifts with it. */
  wind: Wind;
  views: Record<ViewLandmarkId, View>;
}
