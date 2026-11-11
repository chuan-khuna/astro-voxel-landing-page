/**
 * The colour roles a structure file may use (ADR 0004). A structure never
 * holds raw colours: each character in its key names a role, and the role
 * resolves to a Biome colour or a fixed colour (`render/palette.ts`), with
 * an optional OKLCH lightness shift. So every structure gets the same OKLCH,
 * per-voxel jitter and seam shading as the terrain.
 *
 * Pure data: no three.js.
 */
import type { BiomeColourRole } from '@/world';
import type { FixedColour } from '@/render/palette';

export type RoleColour = { biome: BiomeColourRole; dl?: number } | { fixed: FixedColour; dl?: number };

export const STRUCTURE_ROLES = {
  // Ground and floors.
  plinth: { fixed: 'plinth' },
  concrete: { fixed: 'concrete' },
  floor: { fixed: 'floorWood' },
  rug: { fixed: 'rug' },
  post: { fixed: 'trunk' },
  deck: { fixed: 'plank' },
  deckDark: { fixed: 'plank', dl: -0.06 },
  // Walls.
  wall: { fixed: 'whitewash' },
  wallShade: { fixed: 'whitewash', dl: -0.06 },
  bamboo: { fixed: 'bamboo' },
  bambooDark: { fixed: 'bamboo', dl: -0.07 },
  timber: { fixed: 'timber' },
  timberDark: { fixed: 'timber', dl: -0.07 },
  brick: { fixed: 'brick' },
  brickDark: { fixed: 'brick', dl: -0.06 },
  mortar: { fixed: 'concrete' },
  stone: { fixed: 'stone' },
  stoneDark: { fixed: 'stone', dl: -0.07 },
  // Roofs.
  roof: { fixed: 'roofWhite' },
  thatch: { fixed: 'thatch' },
  thatchDark: { fixed: 'thatch', dl: -0.07 },
  shingle: { fixed: 'shingle' },
  shingleDark: { fixed: 'shingle', dl: -0.06 },
  tile: { fixed: 'tile' },
  tileDark: { fixed: 'tile', dl: -0.06 },
  slate: { fixed: 'slate' },
  slateDark: { fixed: 'slate', dl: -0.05 },
  snow: { fixed: 'snow' },
  // Openings and trim.
  door: { fixed: 'blueDoor' },
  doorWood: { fixed: 'timber', dl: -0.12 },
  window: { fixed: 'glass' },
  frame: { fixed: 'whitewash' },
  trim: { fixed: 'blueTrim' },
  /** The Biome's accent: a trim, a shutter or an ember that changes with the Biome. */
  accent: { biome: 'accent' },
  metal: { fixed: 'metal' },
  metalDark: { fixed: 'metalDark' },
  /** A mailbox's red flag. */
  flag: { fixed: 'flagRed' },
  /** Pale cloth and rope: sails, awnings, a coil of rope. */
  canvas: { fixed: 'sail' },
  /** A lamp's glass. */
  lamp: { fixed: 'lamp' },
  // Plants.
  foliage: { biome: 'foliage' },
  foliageLight: { biome: 'foliage', dl: 0.05 },
  flower: { fixed: 'bougainvillea' },
  flowerLight: { fixed: 'bougainLight' },
} as const satisfies Record<string, RoleColour>;

export type StructureRole = keyof typeof STRUCTURE_ROLES;

export const isStructureRole = (role: string): role is StructureRole => Object.hasOwn(STRUCTURE_ROLES, role);

/** The parts a structure's voxels belong to. `lid` lifts off (the House's roof and front walls); everything else is `base`. */
export const STRUCTURE_PARTS = ['base', 'lid'] as const;
export type StructurePart = (typeof STRUCTURE_PARTS)[number];
