/**
 * The Ambient Life tier (ADR 0005): how much of the World moves on its own.
 * Three tiers: full, reduced and still. A desktop starts at full and a phone
 * (the reduced render tier, `renderTier.ts`) at reduced. The watch drops one
 * tier when a whole window of frames runs slower than the tier's target,
 * and never climbs back during the visit. Reduced motion shows still,
 * whatever the watch says, and follows the media query both ways.
 *
 * Still stops every motion (the shared clock freezes) and the World goes
 * back to rendering on demand. Counts of living things follow `share`;
 * still keeps the reduced share, frozen where it stands.
 *
 * Plain functions over frame times; no DOM.
 */
import type { RenderTierName } from './renderTier';

export type LifeTierName = 'full' | 'reduced' | 'still';

export interface LifeTier {
  name: LifeTierName;
  /** Ambient Life moves: the clock runs and the World renders continuously while visible. */
  moves: boolean;
  /** Frames a second for ambient frames; 0: every frame. Camera moves always get every frame. */
  ambientFps: number;
  /** Below this average frame rate over a whole window the tier drops (0: it cannot drop). */
  minFps: number;
  /** The share (0–1) of each kind of living thing shown. */
  share: number;
}

export const LIFE_TIERS: Record<LifeTierName, LifeTier> = {
  full: { name: 'full', moves: true, ambientFps: 0, minFps: 40, share: 1 },
  reduced: { name: 'reduced', moves: true, ambientFps: 30, minFps: 20, share: 0.5 },
  still: { name: 'still', moves: false, ambientFps: 0, minFps: 0, share: 0.5 },
};

/** The window of frames the watch averages over before it may drop a tier, ms. */
export const TIER_WINDOW_MS = 3000;
/** A longer time between two frames is a gap (a hidden tab, an idle World), not a frame. */
const MAX_FRAME_MS = 1000;

const NEXT: Record<LifeTierName, LifeTierName> = { full: 'reduced', reduced: 'still', still: 'still' };

/** The tier a visit starts at: from the render tier, or `override` (`?life=full|reduced|still`). */
export function startingLifeTier(render: RenderTierName, override?: string | null): LifeTierName {
  if (override === 'full' || override === 'reduced' || override === 'still') return override;
  return render === 'reduced' ? 'reduced' : 'full';
}

/** The tier on show: still under reduced motion, else the watch's. */
export function lifeTierShown(watched: LifeTierName, reducedMotion: boolean): LifeTierName {
  return reducedMotion ? 'still' : watched;
}

export interface LifeTierWatch {
  /** The tier now (never higher than it started). */
  readonly tier: LifeTierName;
  /** A continuous frame rendered `ms` after the last one; returns the tier after it. */
  frame(ms: number): LifeTierName;
}

/** Watch frame times from `start`; `pinned` (an override, for measuring) never drops. */
export function createLifeTierWatch(start: LifeTierName, { pinned = false }: { pinned?: boolean } = {}): LifeTierWatch {
  let tier = start;
  let elapsed = 0;
  let frames = 0;
  return {
    get tier() {
      return tier;
    },
    frame(ms) {
      const { minFps } = LIFE_TIERS[tier];
      if (pinned || minFps === 0 || ms <= 0 || ms > MAX_FRAME_MS) return tier;
      elapsed += ms;
      frames += 1;
      if (elapsed >= TIER_WINDOW_MS) {
        if (elapsed / frames > 1000 / minFps) tier = NEXT[tier];
        elapsed = 0;
        frames = 0;
      }
      return tier;
    },
  };
}
