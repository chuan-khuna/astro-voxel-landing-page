/**
 * How the House moves, as pure functions of time: the lid lifting off and
 * the developer at work. No three.js; `house.ts` applies them to meshes.
 */
import type { DeveloperPart } from '@/structures/roles';
import { INTERIOR } from './voxelTiers';

/** How high the lid lifts when the House opens, in world units: clear of the room as the camera sees it. */
export const ROOF_LIFT = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Cubic ease in and out, like the camera's flights. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** How high the lid is (world units) when the House is `opening` open: 0 shut, 1 fully open. */
export function roofLift(opening: number): number {
  return ROOF_LIFT * ease(clamp01(opening));
}

/**
 * The next opening after `dt` ms, moving towards `target` (1 open, 0 shut, or
 * part-way while the Story Scroll leads the lid) at a rate that takes `ms`
 * from shut to open. With `ms` 0 it cuts.
 */
export function openingStep(opening: number, target: number, dt: number, ms: number): number {
  if (ms <= 0) return target;
  const step = dt / ms;
  return opening < target ? Math.min(target, opening + step) : Math.max(target, opening - step);
}

/** Offsets of the developer's moving parts from their rest pose, in world units. */
export type DeveloperPose = Record<DeveloperPart, { y: number }>;

/** One typing and reading cycle, in seconds: typing for the first part, then a pause. */
const CYCLE = 5;
const TYPING = 3.6;
/** Key taps a second, per hand. */
const TAPS = 3;
/** Highest a hand lifts: one 1/16-unit voxel of the Interior. */
const TAP_HEIGHT = 1 / INTERIOR;
/** Deepest nod: two thirds of a 1/16-unit voxel. */
const NOD = (2 / 3) * (1 / INTERIOR);

/**
 * The developer `seconds` into their work: bursts of typing (the hands tap
 * in turn, never both up together) and pauses to read the screen (hands
 * still, a slow nod). Smooth everywhere; the rest pose at 0.
 */
export function developerPose(seconds: number): DeveloperPose {
  const t = ((seconds % CYCLE) + CYCLE) % CYCLE;
  // Fade the taps in and out at the burst's ends so the hands never jump.
  const envelope = t < TYPING ? Math.sin((Math.PI * t) / TYPING) : 0;
  const wave = Math.sin(2 * Math.PI * TAPS * t);
  const tap = (s: number) => Math.max(0, s) * envelope * TAP_HEIGHT;
  // A nod while reading: down and back up over the pause.
  const reading = t >= TYPING ? (t - TYPING) / (CYCLE - TYPING) : 0;
  return {
    head: { y: Math.sin(Math.PI * reading) * NOD },
    leftHand: { y: tap(wave) },
    rightHand: { y: tap(-wave) },
  };
}
