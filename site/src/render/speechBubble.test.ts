import { describe, expect, it } from 'vitest';
import { placeBubble } from './speechBubble';

const frame = { width: 1200, height: 800 };
const bubble = { width: 240, height: 90 };
const guide = { x: 600, y: 400, radius: 30 };

/** Does the bubble at `p` overlap the box? */
const overlaps = (p: { left: number; top: number }, r: { left: number; top: number; right: number; bottom: number }) =>
  p.left < r.right && p.left + bubble.width > r.left && p.top < r.bottom && p.top + bubble.height > r.top;

describe('placeBubble', () => {
  it('puts the bubble over the Guide, centred, its tail pointing down at it', () => {
    const p = placeBubble(guide, bubble, frame, []);
    expect(p).not.toBeNull();
    expect(p!.side).toBe('above');
    expect(p!.left + bubble.width / 2).toBe(guide.x);
    expect(p!.top + bubble.height).toBeLessThan(guide.y - guide.radius);
    expect(p!.tail).toBe(bubble.width / 2);
  });

  it('slides along the frame edge rather than off it, its tail still at the Guide', () => {
    const p = placeBubble({ ...guide, x: 60 }, bubble, frame, []);
    expect(p!.left).toBeGreaterThanOrEqual(0);
    expect(p!.left + p!.tail).toBeCloseTo(60, 0);
  });

  it('goes under the Guide when there is no room over it', () => {
    const p = placeBubble({ ...guide, y: 80 }, bubble, frame, []);
    expect(p!.side).toBe('below');
    expect(p!.top).toBeGreaterThan(80 + guide.radius);
  });

  it('never goes under a card: it takes another side, clear of every card', () => {
    const cards = [
      { left: 0, top: 0, right: 1200, bottom: 340 },
      { left: 640, top: 0, right: 1200, bottom: 800 },
    ];
    const p = placeBubble(guide, bubble, frame, cards);
    expect(p).not.toBeNull();
    for (const card of cards) expect(overlaps(p!, card)).toBe(false);
    // Over it is the top bar; under it, centred, would reach into the side panel; right is the panel.
    expect(p!.side).toBe('left');
  });

  it('hides when the Guide is off screen, behind a card, or there is no room anywhere', () => {
    expect(placeBubble({ ...guide, x: -50 }, bubble, frame, [])).toBeNull();
    expect(placeBubble(guide, bubble, frame, [{ left: 500, top: 300, right: 700, bottom: 500 }])).toBeNull();
    const all = [{ left: 0, top: 0, right: 1200, bottom: 360 }, { left: 0, top: 440, right: 1200, bottom: 800 }];
    expect(placeBubble(guide, bubble, frame, all)).toBeNull();
  });

  it('keeps off the Landmarks when it can, and speaks over them when it cannot', () => {
    const station = { left: 520, top: 200, right: 680, bottom: 360 };
    const p = placeBubble(guide, bubble, frame, [], [station]);
    expect(p!.side).toBe('below');
    const everywhere = [station, { left: 0, top: 440, right: 1200, bottom: 800 }, { left: 0, top: 0, right: 560, bottom: 800 }, { left: 640, top: 0, right: 1200, bottom: 800 }];
    expect(placeBubble(guide, bubble, frame, [], everywhere)!.side).toBe('above');
  });

  it('hides when the Guide is mostly out of sight: just past a card or the frame edge', () => {
    const card = { left: 0, top: 0, right: 590, bottom: 800 };
    expect(placeBubble({ ...guide, x: 600 }, bubble, frame, [card])).toBeNull();
    expect(placeBubble({ ...guide, x: 1190 }, bubble, frame, [])).toBeNull();
    // Clear of the card by more than half its size, it speaks.
    expect(placeBubble({ ...guide, x: 640 }, bubble, frame, [card])).not.toBeNull();
  });
});
