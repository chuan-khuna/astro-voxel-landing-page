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

/**
 * How a colour glows at Night (polish ticket 16): 0 not at all, `GLOW_STEADY`
 * (a lamp's glass, a lit window) or `GLOW_FLAME` (a flame, which flickers).
 * By Day it shows its plain colour.
 */
export const GLOW_STEADY = 1;
export const GLOW_FLAME = 2;
export type Glow = 0 | typeof GLOW_STEADY | typeof GLOW_FLAME;

export type RoleColour = ({ biome: BiomeColourRole; dl?: number } | { fixed: FixedColour; dl?: number }) & { glow?: Glow };

export const STRUCTURE_ROLES = {
  // Ground and floors.
  plinth: { fixed: 'plinth' },
  concrete: { fixed: 'concrete' },
  floor: { fixed: 'floorWood' },
  rug: { fixed: 'rug' },
  post: { fixed: 'trunk' },
  postDark: { fixed: 'trunk', dl: -0.08 },
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
  /** A lamp's glass, unlit (a ship's or boat's lamps glow through `glow`). */
  lamp: { fixed: 'lamp' },
  /**
   * The Light Sources' roles (polish ticket 16): a structure with either
   * glows at Night, and one that declares its light (`light:` in its
   * header) throws block light round it. `flame` flickers; `glow` (a
   * lamp's glass) shines steady.
   */
  flame: { fixed: 'fire', glow: GLOW_FLAME },
  glow: { fixed: 'lamp', glow: GLOW_STEADY },
  // Boats and ships: painted hulls (wood hulls use `bamboo`, `timber`; iron ones `slate`).
  hullRed: { fixed: 'hullRed' },
  hullRedDark: { fixed: 'hullRed', dl: -0.08 },
  hullNavy: { fixed: 'hullNavy' },
  hullNavyDark: { fixed: 'hullNavy', dl: -0.07 },
  // Decoration (polish 08): rock piles in the Biome's stone, and tufts of its grass.
  rock: { biome: 'rock' },
  rockDark: { biome: 'rockDark' },
  turf: { biome: 'grass', dl: -0.08 },
  turfLight: { biome: 'grass', dl: 0.05 },
  // Plants.
  foliage: { biome: 'foliage' },
  foliageLight: { biome: 'foliage', dl: 0.05 },
  foliageDark: { biome: 'foliage', dl: -0.05 },
  /** Autumn's turning leaves, beside the Biome's foliage. */
  leafGold: { fixed: 'leafGold' },
  flower: { fixed: 'bougainvillea' },
  flowerLight: { fixed: 'bougainLight' },
  // The Garden's flowers: stems and leaves, petals and the pollen at their heart.
  stem: { fixed: 'stem' },
  stemLight: { fixed: 'stem', dl: 0.05 },
  stemDark: { fixed: 'stem', dl: -0.06 },
  petalWhite: { fixed: 'petalWhite' },
  petalYellow: { fixed: 'petalYellow' },
  petalOrange: { fixed: 'petalOrange' },
  petalRed: { fixed: 'petalRed' },
  petalBlue: { fixed: 'petalBlue' },
  petalBlueLight: { fixed: 'petalBlue', dl: 0.07 },
  pollen: { fixed: 'pollen' },
  // The fish (polish 13), one species a Biome.
  fishOrange: { fixed: 'fishOrange' },
  fishWhite: { fixed: 'fishWhite' },
  fishSilver: { fixed: 'fishSilver' },
  fishSilverDark: { fixed: 'fishSilver', dl: -0.3 },
  fishGold: { fixed: 'fishGold' },
  fishRed: { fixed: 'petalRed', dl: 0.04 },
  fishDark: { fixed: 'fishDark' },
  fishEmber: { fixed: 'fishEmber' },
  // The land animals, birds and bats (polish 14): their heads and wings are parts of their own that move.
  furBrown: { fixed: 'furBrown' },
  furDark: { fixed: 'furDark' },
  furCream: { fixed: 'furCream' },
  furRed: { fixed: 'furRed' },
  furGrey: { fixed: 'furGrey' },
  antler: { fixed: 'antler' },
  horn: { fixed: 'horn' },
  eye: { fixed: 'eye' },
  /** A volcanic bat's glowing eye. */
  emberEye: { fixed: 'fishEmber' },
  beak: { fixed: 'beak' },
  comb: { fixed: 'comb' },
  plumeGold: { fixed: 'plumeGold' },
  plumeDark: { fixed: 'plumeDark' },
  featherWhite: { fixed: 'featherWhite' },
  featherGrey: { fixed: 'featherGrey' },
  featherBlack: { fixed: 'featherBlack' },
  batBody: { fixed: 'batBody' },
  batWing: { fixed: 'batWing' },
  // The House Interior's rooms (1/16 unit) and the developer at work.
  /** The computer's screen: the glowing code is drawn over its +x face (`interiorModel.ts`). */
  screen: { fixed: 'screenDark' },
  /** Fire in a hearth or a brazier: the room's warm light at Night. */
  fire: { fixed: 'fire' },
  desk: { fixed: 'desk' },
  chair: { fixed: 'chair' },
  skin: { fixed: 'skin' },
  hair: { fixed: 'hair' },
  shirt: { fixed: 'shirt' },
  trousers: { fixed: 'trousers' },
  shoe: { fixed: 'trousers', dl: -0.12 },
} as const satisfies Record<string, RoleColour>;

export type StructureRole = keyof typeof STRUCTURE_ROLES;

/** The roles that make a structure a Light Source. */
export const LIGHT_ROLES: readonly StructureRole[] = ['flame', 'glow'];

export const isStructureRole = (role: string): role is StructureRole => Object.hasOwn(STRUCTURE_ROLES, role);

/** The developer's moving parts (`developer/any-1`), each its own mesh in the World's open House. */
export const DEVELOPER_PARTS = ['head', 'leftHand', 'rightHand'] as const;
export type DeveloperPart = (typeof DEVELOPER_PARTS)[number];

/** A flying creature's wings (`bird/`, `bat/`), each beating about its side of the body. */
export const WING_PARTS = ['wingLeft', 'wingRight'] as const;

/**
 * The parts a structure's voxels belong to, each its own mesh where it moves:
 * `lid` lifts off (the House's roof and front walls); `head`, `leftHand` and
 * `rightHand` are the developer's moving parts (`developer/any-1`), and
 * `head` a land animal's too (it turns and dips about the neck); `wingLeft`
 * and `wingRight` a bird's or bat's; everything else is `base`.
 */
export const STRUCTURE_PARTS = ['base', 'lid', ...DEVELOPER_PARTS, ...WING_PARTS] as const;
export type StructurePart = (typeof STRUCTURE_PARTS)[number];
