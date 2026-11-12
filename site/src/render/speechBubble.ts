/**
 * Where the Guide's speech bubble goes on screen: pure, on CSS px boxes,
 * so it is tested directly.
 *
 * The bubble goes over the Guide, else under it, else to its right or left,
 * whichever first fits inside the frame without touching a card floating
 * over the World (the HUD's cards, which lie above the World, would hide
 * it), and clear of the Landmarks if any side is. Over or under, it slides
 * along the frame's edge to fit, and its tail keeps pointing at the Guide. With the Guide (its middle half) off screen
 * or behind a card, or no room anywhere, there is no bubble on screen.
 */
import type { Rect } from './freeArea';

export type BubbleSide = 'above' | 'below' | 'right' | 'left';

export interface BubblePlace {
  /** The bubble's top left corner, in CSS px from the frame's top left. */
  left: number;
  top: number;
  side: BubbleSide;
  /**
   * Where the tail meets the bubble: px from its left edge (above or
   * below), or from its top edge (right or left).
   */
  tail: number;
}

/** Space between the bubble and the Guide, and the frame's edge or a card, in CSS px. */
const GAP = 10;
/** The tail never comes closer than this to the bubble's corner, in CSS px. */
const TAIL_INSET = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * `guide`: the Guide's middle on screen and its radius there, in CSS px from
 * the frame's top left. `covers`: the cards over the World, in the same
 * space; `landmarks`: the Landmarks' boxes on screen, which the bubble keeps
 * off when it can (it never takes their clicks, but would hide them).
 */
export function placeBubble(
  guide: { x: number; y: number; radius: number },
  bubble: { width: number; height: number },
  frame: { width: number; height: number },
  covers: readonly Rect[],
  landmarks: readonly Rect[] = [],
): BubblePlace | null {
  const { x, y, radius } = guide;
  // The middle of the Guide (half its size) must be in sight: inside the frame, clear of every card.
  const seen = radius / 2;
  if (x - seen < 0 || y - seen < 0 || x + seen > frame.width || y + seen > frame.height) return null;
  if (covers.some((c) => x + seen > c.left && x - seen < c.right && y + seen > c.top && y - seen < c.bottom)) return null;

  const { width, height } = bubble;
  const across = clamp(x - width / 2, GAP, frame.width - GAP - width);
  const down = clamp(y - height / 2, GAP, frame.height - GAP - height);
  const tailAcross = clamp(x - across, TAIL_INSET, width - TAIL_INSET);
  const tailDown = clamp(y - down, TAIL_INSET, height - TAIL_INSET);
  const places: BubblePlace[] = [
    { left: across, top: y - radius - GAP - height, side: 'above', tail: tailAcross },
    { left: across, top: y + radius + GAP, side: 'below', tail: tailAcross },
    { left: x + radius + GAP, top: down, side: 'right', tail: tailDown },
    { left: x - radius - GAP - width, top: down, side: 'left', tail: tailDown },
  ];
  const clearOf = ({ left, top }: BubblePlace, boxes: readonly Rect[], gap: number) =>
    boxes.every((c) => left >= c.right + gap || left + width <= c.left - gap || top >= c.bottom + gap || top + height <= c.top - gap);
  const fits = (place: BubblePlace) =>
    place.left >= GAP - 0.5 &&
    place.top >= GAP - 0.5 &&
    place.left + width <= frame.width - GAP + 0.5 &&
    place.top + height <= frame.height - GAP + 0.5 &&
    clearOf(place, covers, GAP);
  return places.find((place) => fits(place) && clearOf(place, landmarks, 0)) ?? places.find(fits) ?? null;
}
