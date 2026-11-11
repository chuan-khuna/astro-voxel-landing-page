/**
 * The World's voxel sizes (ADR 0006), as voxels per world unit along each
 * axis. Each kind of thing is drawn at one tier:
 *
 * - `TERRAIN` (1 unit): ground, sea, clouds.
 * - `GROUND_DETAIL` (¼ unit): bridges, stairs, path edging, the Dock's deck
 *   and jetty, and (until they are redrawn as structures) the
 *   Garden, boats and buoys.
 * - `STRUCTURE` (⅛ unit): predefined structures (`structures/`): Landmarks,
 *   plants, boats, ships, Decoration, creatures. Particles share this size.
 * - `INTERIOR` (1/16 unit): the House Interior's rooms (`structures/room/`), a
 *   scene of its own (`interior.ts`).
 *
 * The mesher and the soft-voxel material take any voxel size: seams and
 * bevels are fractions of one voxel, so they scale with it.
 */
export const TERRAIN = 1;
export const GROUND_DETAIL = 4;
export const STRUCTURE = 8;
export const INTERIOR = 16;
