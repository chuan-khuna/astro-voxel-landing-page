/**
 * The World generator: a pure, deterministic function from Seed plus content
 * counts to World data. No three.js, no DOM. `generateWorld` is the single
 * test seam.
 */
export { generateWorld } from './generateWorld';
export { BIOME_COLOUR_ROLES, BIOME_IDS, LANDMARK_IDS, PLACED_LANDMARK_IDS, VIEW_LANDMARK_IDS } from './types';
export { MAX_SEED_LENGTH } from './generateWorld';
export { HOUSE_CELLS, HOUSE_PLOT, LANDMARK_HEIGHT, LANDMARK_VARIANTS, MAX_BOATS, MAX_FLOWERS, MAX_TREES, GARDEN_BED, GARDEN_HEIGHT, GARDEN_SIZE, gardenCounts, houseYard } from './landmarks';
export { MAX_BUOYS } from './buoys';
export type * from './types';
