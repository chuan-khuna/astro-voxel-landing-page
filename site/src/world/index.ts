/**
 * The World generator: a pure, deterministic function from Seed plus content
 * counts to World data. No three.js, no DOM. `generateWorld` is the single
 * test seam.
 */
export { generateWorld } from './generateWorld';
export { BIOME_COLOUR_ROLES, BIOME_IDS, LANDMARK_IDS, PLACED_LANDMARK_IDS, VIEW_LANDMARK_IDS } from './types';
export { MAX_SEED_LENGTH } from './generateWorld';
export { MAX_BOATS, MAX_TREES } from './landmarks';
export { MAX_BUOYS } from './buoys';
export type * from './types';
