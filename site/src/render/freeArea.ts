/**
 * Where on the full-screen World the visitor can see past the floating UI:
 * pure, on screen boxes, so it is tested directly.
 *
 * Each card over the World is either a band across the frame (the top bar,
 * a bottom sheet, the dice row above it: wider, as a share of the frame,
 * than it is tall), which takes a strip off the top or bottom, or a column
 * (a side panel), which takes a strip off the left or right. It takes the
 * strip on its far side from the larger free part that is left, and the
 * larger cards cut first, so the dice just above a tall sheet comes off the
 * bottom with it. A card spanning less than half the frame both ways (the
 * company name, the dice in a desktop corner) leaves the frame free round
 * it, and is ignored.
 */

/** Share of the frame a card must span, across or down, to take a strip off it. */
const BAND = 0.5;

/** A box on screen in CSS px, like `getBoundingClientRect()`. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** CSS px from the centre of the frame, x right and y down. */
export interface ScreenOffset {
  x: number;
  y: number;
}

/**
 * The middle of the part of `frame` the `covers` leave free, as an offset
 * from the frame's centre: where a focused Landmark should sit.
 */
export function freeCentre(frame: Rect, covers: Rect[]): ScreenOffset {
  // Copy each side: a DOMRect's sides are getters, which a spread would drop.
  const free = { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom };
  const width = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  const area = (c: Rect) => (c.right - c.left) * (c.bottom - c.top);
  for (const c of covers.toSorted((a, b) => area(b) - area(a))) {
    const across = (Math.min(c.right, frame.right) - Math.max(c.left, frame.left)) / width;
    const down = (Math.min(c.bottom, frame.bottom) - Math.max(c.top, frame.top)) / height;
    if (Math.max(across, down) < BAND) continue;
    if (across >= down) {
      if (c.top - free.top >= free.bottom - c.bottom) free.bottom = Math.min(free.bottom, c.top);
      else free.top = Math.max(free.top, c.bottom);
    } else if (c.left - free.left >= free.right - c.right) free.right = Math.min(free.right, c.left);
    else free.left = Math.max(free.left, c.right);
  }
  if (free.right <= free.left || free.bottom <= free.top) return { x: 0, y: 0 };
  const midX = (frame.left + frame.right) / 2;
  const midY = (frame.top + frame.bottom) / 2;
  return { x: (free.left + free.right) / 2 - midX, y: (free.top + free.bottom) / 2 - midY };
}
