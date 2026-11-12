/**
 * The sea's swell, shared by the water and what floats on it. The water
 * (`seaMaterial.ts`) bobs each voxel by it in the shader; the Clients'
 * boats and the Partners' ships (`boats.ts`, `ships.ts`) ride it on the
 * CPU (`vesselRock`), in step with the water round them. Both read the
 * shared Ambient Life clock, so they hold still where it is frozen.
 *
 * The swell rises and falls once every `SWELL_PERIOD` seconds, its phase
 * turning `SWELL_STRIDE` radians a cell along x + z, so it runs across the
 * sea. Each water voxel adds a phase of its own (a hash of its cell, up to
 * half a swell), so neighbouring voxels never bob as one; a vessel rides
 * the water voxel of its cell, its own hash worked out here as the shader
 * does (`seaHash`, three's `hash`), so it rises and falls with it.
 *
 * Pure maths, no three.js.
 */
import { SEA_BOB } from './seaModel';

/** Seconds the swell takes to rise, sink and rise again. */
export const SWELL_PERIOD = 4.5;
/** Radians the swell's phase turns per cell along x + z: a slow wave across the sea. */
export const SWELL_STRIDE = 0.55;
/** Radians a vessel rolls at most (about 3°). */
export const MAX_ROLL = 0.05;
/** Radians a vessel pitches at most (about 2°). */
export const MAX_PITCH = 0.035;

/** The swell's phase at a cell, at time 0: radians. */
export const swellPhase = (cellX: number, cellZ: number): number => (cellX + cellZ) * SWELL_STRIDE;

/** The hash seed of a water voxel's cell, as `seaMaterial` makes it. */
export const seaCellSeed = (cellX: number, cellZ: number): number => cellX + 512 + (cellZ + 512) * 1024;

/**
 * three's TSL `hash` (PCG) on the CPU: a whole-number seed to [0, 1), the
 * same as the shader gives, so a vessel can match its water voxel.
 */
export function seaHash(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return (((word >>> 22) ^ word) >>> 0) / 2 ** 32;
}

/** The phase a water voxel bobs in at time 0 (`seaMaterial`): its own (a hash, up to π) plus the swell's. */
export const seaVoxelPhase = (cellX: number, cellZ: number): number =>
  seaHash(seaCellSeed(cellX, cellZ)) * Math.PI + swellPhase(cellX, cellZ);

/** How a vessel sits on the swell: `heave` world units up, `roll` and `pitch` radians (see `InstancePlacement`). */
export interface SwellPose {
  heave: number;
  roll: number;
  pitch: number;
}

/**
 * A vessel at world (x, z) on the swell `seconds` into the clock: it rises
 * and falls `SEA_BOB` with the water voxel of its cell, and rolls and
 * pitches on the swell's slope (a quarter swell after the heave, so it
 * leans most as the water passes level). Vessels stay in the grid, where
 * every water voxel bobs its whole `SEA_BOB`.
 */
export function vesselRock(x: number, z: number, seconds: number): SwellPose {
  const phase = (seconds * 2 * Math.PI) / SWELL_PERIOD + seaVoxelPhase(Math.floor(x), Math.floor(z));
  return {
    heave: SEA_BOB * Math.sin(phase),
    roll: MAX_ROLL * Math.cos(phase),
    pitch: MAX_PITCH * Math.cos(phase + 1.1),
  };
}
