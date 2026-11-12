/**
 * Falling leaves (ADR 0005): ⅛-unit single-colour cubes that drop from the
 * World's trees (the Garden's trees, and the small trees and bushes among
 * the Decoration the render tier draws), drift down the wind, tumble, lie
 * a moment and fade. This works out each leaf's path and timing once a
 * World; `leaves.ts` moves them in the shader on the shared clock.
 *
 * Each leaf starts at one of its tree's foliage voxels, coloured as that
 * voxel is (the Biome's foliage roles, or autumn's gold), and lands down
 * the World's wind on land as high as its tree's ground, never on another
 * Landmark (the Garden's own trees may drop theirs in the Garden). If the
 * wind would carry it off the land, up or down a step or onto a Landmark,
 * it lands nearer, down to straight below. Autumn's trees drop more.
 *
 * The paths and timings come from a sequence of the Seed's own
 * (`<seed>/leaves`), shuffled so the first half spreads over the whole
 * World: tiers that show fewer leaves take the first ones (`leavesShown`).
 *
 * Pure: no three.js.
 */
import type { PlacedLandmark, World } from '@/world';
import { createRng } from '@/world/prng';
import type { RenderTierName } from '@/lib/renderTier';
import { LIFE_TIERS, type LifeTierName } from '@/lib/lifeTier';
import type { Structure } from '@/structures';
import { structureVoxels } from '@/structures/parse';
import type { StructureRole } from '@/structures/roles';
import { decorationOf, decorationPlacement } from './decorationModels';
import { gardenPlantsOf, plantPlacement } from './gardenPlants';
import type { Rgb } from './palette';
import { instanceMatrix, structurePivot, transformPoint, type InstancePlacement, type Point } from './structureMeshes';
import { structureColour } from './structureModels';
import { STRUCTURE } from './voxelTiers';
import { worldColours } from './worldVoxels';
import { dropsLeaves } from './windSway';

/** A leaf's edge, in world units: one ⅛-unit voxel. */
export const LEAF_SIZE = 1 / STRUCTURE;
/** Leaves each tree drops: autumn's, and every other Biome's. */
const LEAVES_PER_TREE = { autumn: 3, other: 2 };
/** Leaves in a World at most. */
const MAX_LEAVES = 72;
/** World units a leaf falls a second. */
const FALL_SPEED = 0.28;
/** World units a leaf drifts down the wind per unit it falls: least and most. */
const DRIFT = [0.6, 1.3] as const;
/** World units a leaf drifts at most. */
const MAX_DRIFT = 2.5;
/** World units between the points checked along a leaf's way. */
const STEP = 0.25;
/** Seconds a leaf lies on the ground, fading. */
export const LEAF_FADE = 1.5;
/** Seconds a leaf waits, unseen, before it falls again: least and most. */
const WAIT = [2, 9] as const;

const FOLIAGE: ReadonlySet<StructureRole> = new Set(['foliage', 'foliageLight', 'foliageDark', 'leafGold']);

export interface FallingLeaf {
  /** Its centre where it lets go: in its tree's canopy. */
  start: Point;
  /** Its centre where it lies: on the ground, down the wind. */
  land: Point;
  /** Linear RGB. */
  colour: Rgb;
  /** Seconds from one fall to the next. */
  period: number;
  /** Seconds it takes to fall, from the start of its cycle; then it lies `LEAF_FADE` and is gone until the cycle ends. */
  fall: number;
  /** Seconds into its cycle at time 0. */
  offset: number;
  /** Whole turns it tumbles on the way down (so it lies flat), 1 to 3; the sign is which way. */
  spin: number;
}

/** A tree a leaf may fall from: its structure, placement and ground height, and the Landmark it stands in (if any). */
interface Tree {
  structure: Structure;
  placement: InstancePlacement;
  ground: number;
  within?: PlacedLandmark;
}

function treesOf(world: World, tier: RenderTierName): Tree[] {
  const garden = world.landmarks.find((l) => l.id === 'garden');
  const gardenTrees = gardenPlantsOf(world)
    .filter((p) => p.kind === 'tree')
    .map((p) => {
      const placement = plantPlacement(world, p);
      return { structure: p.structure, placement, ground: placement.y, within: garden };
    });
  const decorationTrees = decorationOf(world, tier)
    .filter(({ piece }) => dropsLeaves(piece.kind))
    .map(({ piece, structure }) => {
      const placement = decorationPlacement(world, piece);
      return { structure, placement, ground: placement.y };
    });
  return [...gardenTrees, ...decorationTrees];
}

/** Every leaf in a World, on the trees the render tier draws, shuffled (see `leavesShown`). */
export function fallingLeaves(world: World, tier: RenderTierName): FallingLeaf[] {
  const rng = createRng(`${world.seed}/leaves`);
  const between = ([lo, hi]: readonly [number, number]) => lo + rng() * (hi - lo);
  const colours = worldColours(world);
  const perTree = world.biome.id === 'autumn' ? LEAVES_PER_TREE.autumn : LEAVES_PER_TREE.other;
  const { direction } = world.wind;
  const { width, depth, heights, isle } = world.terrain;
  const footprints = new Map<number, PlacedLandmark>();
  for (const l of world.landmarks) for (const c of l.footprint.cells) footprints.set(c.z * width + c.x, l);

  /** May a leaf from `tree` pass over or lie at world (x, z)? */
  const clear = (tree: Tree, x: number, z: number) => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= width || cz >= depth) return false;
    const i = cz * width + cx;
    const on = footprints.get(i);
    return isle[i] !== -1 && heights[i] === tree.ground && (on === undefined || on === tree.within);
  };
  /** Is the whole way from (x, z) to `drift` units down the wind clear? */
  const clearWay = (tree: Tree, x: number, z: number, drift: number) => {
    for (let d = 0; ; d = Math.min(drift, d + STEP)) {
      if (!clear(tree, x + direction.x * d, z + direction.z * d)) return false;
      if (d === drift) return true;
    }
  };

  const leaves: FallingLeaf[] = [];
  for (const tree of treesOf(world, tier)) {
    const { structure } = tree;
    const canopy = [...structureVoxels(structure)].filter((v) => FOLIAGE.has(v.role));
    if (canopy.length === 0) continue;
    const m = instanceMatrix(tree.placement, structurePivot(structure));
    for (let n = 0; n < perTree; n++) {
      const voxel = canopy[Math.floor(rng() * canopy.length)]!;
      // The voxel's centre in the structure's own units (its anchor at the origin), then in the World.
      const start = transformPoint(m, {
        x: (voxel.x - structure.anchor.x + 0.5) / structure.scale,
        y: (voxel.y - structure.anchor.y + 0.5) / structure.scale,
        z: (voxel.z - structure.anchor.z + 0.5) / structure.scale,
      });
      const drop = start.y - tree.ground - LEAF_SIZE / 2;
      // As far down the wind as it would drift, then nearer until its whole way is clear.
      let drift = Math.min(MAX_DRIFT, drop * between(DRIFT));
      while (drift > 0 && !clearWay(tree, start.x, start.z, drift)) drift = Math.max(0, drift - STEP);
      const land = { x: start.x + direction.x * drift, y: tree.ground + LEAF_SIZE / 2, z: start.z + direction.z * drift };
      const fall = Math.max(1.5, drop / FALL_SPEED);
      const period = fall + LEAF_FADE + between(WAIT);
      const spin = (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 3));
      const colour = colours.table.colours[structureColour(colours, voxel.role)]!;
      leaves.push({ start, land, colour, period, fall, offset: rng() * period, spin });
    }
  }
  // Shuffle (Fisher–Yates), so any first share of them covers the World.
  for (let i = leaves.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [leaves[i], leaves[j]] = [leaves[j]!, leaves[i]!];
  }
  return leaves.slice(0, MAX_LEAVES);
}

/** How many of `total` leaves a life tier shows: its share, rounded up (the first ones of `fallingLeaves`). */
export const leavesShown = (total: number, tier: LifeTierName): number => Math.ceil(total * LIFE_TIERS[tier].share);
