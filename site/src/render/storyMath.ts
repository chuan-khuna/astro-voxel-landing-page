/**
 * The Story Scroll on phones, as pure functions of the page's scroll
 * position: no DOM, no three.js, so it is tested directly.
 *
 * Each section of the page (the intro, then each route in Story Order) is a
 * stop: a window of World (where its Landmark is framed) and then its card.
 * The camera holds at a section while its card is read, and glides to the
 * next section's framing while the next window of World scrolls in.
 */
import { flightState, type CameraState } from './cameraMath';

/** Scroll positions round to whole (or device) pixels: this close to an anchor is at it. */
const SLACK = 1;

/** Where a section sits on the page, in scroll px. */
export interface StoryStop {
  /** The scroll position at which the section's window of World fills the top of the screen. */
  anchor: number;
  /** The scroll position at which the end of its card reaches the bottom of the screen (never before `anchor`). */
  leave: number;
}

/** Where the page is between two sections: `t` (0–1, not eased) of the way from `from` to `to`. */
export interface StoryPosition {
  from: number;
  to: number;
  t: number;
}

/**
 * Where `scrollY` is among the stops: held at a section from its anchor until
 * its card has been read (its leave), then part-way to the next section
 * until the next anchor. Before the first anchor it holds at the first,
 * after the last at the last.
 */
export function storyPosition(scrollY: number, stops: readonly StoryStop[]): StoryPosition {
  for (let i = stops.length - 1; i >= 0; i--) {
    const stop = stops[i]!;
    if (scrollY < stop.anchor - SLACK && i > 0) continue;
    const next = stops[i + 1];
    if (!next || scrollY <= stop.leave) return { from: i, to: i, t: 0 };
    return { from: i, to: i + 1, t: (scrollY - stop.leave) / Math.max(1, next.anchor - stop.leave) };
  }
  return { from: 0, to: 0, t: 0 };
}

/** The section the page is nearer to: the one in view, whose route the URL follows. */
export function sectionInView({ from, to, t }: StoryPosition): number {
  return t < 0.5 ? from : to;
}

/**
 * The camera at `position`: a section's own framing while held there, and
 * between two sections part-way from one framing to the next, eased in and
 * out (`flightState`). Under reduced motion it cuts: the section in view.
 */
export function storyFraming(position: StoryPosition, framings: readonly CameraState[], reducedMotion: boolean): CameraState {
  const { from, to, t } = position;
  if (reducedMotion || from === to) return framings[sectionInView(position)]!;
  return flightState(framings[from]!, framings[to]!, t);
}

/**
 * How far the House is open at `position` (0 shut, 1 open), from each
 * section's own opening: in step with the scroll (the lid eases itself,
 * `roofLift`). Under reduced motion it cuts with the camera.
 */
export function storyOpening(position: StoryPosition, openings: readonly number[], reducedMotion: boolean): number {
  const { from, to, t } = position;
  if (reducedMotion || from === to) return openings[sectionInView(position)]!;
  return openings[from]! + (openings[to]! - openings[from]!) * t;
}
