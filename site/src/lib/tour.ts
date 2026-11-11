/**
 * The Tour: the Guide leads the camera through every Landmark in Story
 * Order. Plain logic, no DOM, so it is tested directly; `WorldPage.astro`
 * plays it on the World.
 *
 * - `tourSteps`: one step per Landmark in Story Order, each with the lines
 *   the Guide says there (`tour` in that Landmark's `pages` entry; the home
 *   page's are the Overview's).
 * - `tourAfter`: where the Tour is after start, next, previous or exit.
 * - `tourStage`: what the World shows at a step: where the camera goes,
 *   whether the House is open, and which Landmark the Guide floats beside.
 */
import type { Landmark } from '@/data/site';
import type { LandmarkId, PlacedLandmarkId } from '@/world';
import type { GuideLine } from './guideLines';

/** One stop on the Tour. */
export interface TourStep {
  landmark: LandmarkId;
  /** The Landmark's label in the menu. */
  label: string;
  /** The route of its section. */
  route: string;
  /** What the Guide says there, in order. */
  lines: GuideLine[];
}

/** A `pages` entry as the Tour needs it: its Landmark (none for the home page, the Overview's) and its Tour lines. */
export interface TourPage {
  landmark?: LandmarkId;
  tour?: GuideLine[];
}

/**
 * One step per Landmark, in Story Order. Throws when a Landmark has no Tour
 * lines, so a missing line fails the build.
 */
export function tourSteps(landmarks: readonly Landmark[], pages: readonly TourPage[]): TourStep[] {
  return landmarks
    .toSorted((a, b) => a.storyOrder - b.storyOrder)
    .map(({ id, label, route }) => {
      const lines = pages.find((page) => (page.landmark ?? 'overview') === id)?.tour ?? [];
      if (lines.length === 0) throw new Error(`No Tour lines for the ${id} Landmark: add \`tour\` to its pages entry`);
      return { landmark: id, label, route, lines };
    });
}

/** Where the Tour is: its step (from 0), or `null` when it is not running. */
export type TourState = { step: number } | null;
export type TourAction = 'start' | 'next' | 'previous' | 'exit';

/**
 * The Tour after an action, over `count` steps. Start always begins at the
 * first step; next after the last step ends it; previous at the first step
 * stays there; exit ends it at any step.
 */
export function tourAfter(state: TourState, action: TourAction, count: number): TourState {
  if (action === 'start') return { step: 0 };
  if (!state || action === 'exit') return null;
  if (action === 'next') return state.step + 1 < count ? { step: state.step + 1 } : null;
  return { step: Math.max(0, state.step - 1) };
}

/** What the World shows at a Tour step. */
export interface TourStage {
  /** The Landmark the camera goes to. */
  focus: LandmarkId;
  /** Whether the House is open. */
  interior: boolean;
  /** The placed Landmark the Guide floats beside. */
  guideAt: PlacedLandmarkId;
}

/**
 * The House is first shown shut from outside, then opened for its
 * Interior; the Guide stays by the Station for the Overview and beside the
 * House inside it. Unlike a route (`routeView`), About does not open the House.
 */
export function tourStage(id: LandmarkId): TourStage {
  if (id === 'overview') return { focus: id, interior: false, guideAt: 'station' };
  if (id === 'house-interior') return { focus: id, interior: true, guideAt: 'house' };
  return { focus: id, interior: false, guideAt: id };
}
