/**
 * Wind in the plants (ADR 0005): the instanced plants (the Garden's trees
 * and flowers, and Decoration's grass, flower clumps, bushes and small
 * trees) sway in the vertex shader from the shared wind (`ambientClock.ts`).
 *
 * A vertex moves down the wind by the wind's strength where it stands
 * (gusts roll across the Isles, so neighbours sway in turn) times how far
 * up the canopy it is: the lower `STILL_BELOW` of the plant (its trunk or
 * stem) stays put and the top moves at most `MAX_SWAY`, half a ⅛-unit
 * voxel, so a plant never leaves its hotspot.
 * The plant leans `SWAY_LEAN` of that with the wind and flutters
 * `SWAY_FLUTTER` round it, each copy in its own phase. The sway is linear
 * in height above `STILL_BELOW`, so greedy-merged faces bend exactly unless
 * one spans that line (then it bends a little early, a fraction of 1/16). The seams ride with the voxels
 * (`voxelMaterial`'s `displace`). Everything runs on the shared clock, so a
 * frozen clock holds every plant in one pose.
 *
 * Landmarks, minor buildings and rocks never sway.
 */
import { clamp, hash, instanceIndex, positionGeometry, positionLocal, sin } from 'three/tsl';
import type { DecorationKind } from '@/world';
import type { Structure } from '@/structures';
import { windAt, type AmbientClock } from './ambientClock';
import { STRUCTURE } from './voxelTiers';
import { voxelMaterial } from './voxelMaterial';

/** World units the top of a plant moves at most: half a ⅛-unit voxel. */
export const MAX_SWAY = 0.5 / STRUCTURE;
/** Share of the sway the plant leans with the wind. */
export const SWAY_LEAN = 0.55;
/** Share of the sway it flutters either side of its lean. */
export const SWAY_FLUTTER = 0.45;
/** The share of a plant's height, from the ground, that stays still: its trunk or stem. */
export const STILL_BELOW = 0.35;
/** Seconds of one flutter. */
const FLUTTER_PERIOD = 1.8;

const SWAYING: ReadonlySet<DecorationKind> = new Set(['grass', 'clump', 'bush', 'sapling']);

/** Does this kind of Decoration sway in the wind? Plants do; buildings, fences, lamps and rocks do not. */
export const swaysInWind = (kind: DecorationKind): boolean => SWAYING.has(kind);

/** Does this kind of Decoration drop leaves (`fallingLeaves.ts`)? Its trees do: small trees and bushes. */
export const dropsLeaves = (kind: DecorationKind): boolean => kind === 'sapling' || kind === 'bush';

/** The soft-voxel material for every copy of `structure`, swaying in the clock's wind. */
export function swayMaterial(structure: Structure, clock: AmbientClock) {
  const top = (structure.size.y - structure.anchor.y) / structure.scale;
  // How far up the canopy (0 up to `STILL_BELOW` of the plant, 1 at its top), from the geometry as meshed (anchor at y = 0).
  const height = clamp(positionGeometry.y.sub(top * STILL_BELOW).div(top * (1 - STILL_BELOW)), 0, 1);
  const phase = hash(instanceIndex).mul(2 * Math.PI);
  const flutter = sin(clock.time.mul((2 * Math.PI) / FLUTTER_PERIOD).add(phase));
  // `positionLocal` here is the vertex after instancing: where it stands in the World.
  const displace = windAt(clock, positionLocal)
    .mul(flutter.mul(SWAY_FLUTTER).add(SWAY_LEAN))
    .mul(height.mul(MAX_SWAY));
  return voxelMaterial(1 / structure.scale, 'local', { displace });
}
