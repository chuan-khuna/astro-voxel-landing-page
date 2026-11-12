import { describe, expect, it } from 'vitest';
import type { CameraState } from './cameraMath';
import { sectionInView, storyFraming, storyOpening, storyPosition, type StoryStop } from './storyMath';

/** Three sections: the intro (short card), a long card, and the last. */
const stops: StoryStop[] = [
  { anchor: 0, leave: 0 },
  { anchor: 800, leave: 1500 },
  { anchor: 2400, leave: 2400 },
];

describe('storyPosition', () => {
  it('holds at a section while its card is read', () => {
    expect(storyPosition(1000, stops)).toEqual({ from: 1, to: 1, t: 0 });
  });

  it('is part-way to the next section while its window of World scrolls in', () => {
    // From the long card's leave (1500) to the last anchor (2400): 1950 is half-way.
    expect(storyPosition(1950, stops)).toEqual({ from: 1, to: 2, t: 0.5 });
    // A short card is read at once: the glide starts at its anchor.
    expect(storyPosition(200, stops)).toEqual({ from: 0, to: 1, t: 0.25 });
  });

  it('holds at a section scrolled to its anchor give or take a pixel (scroll positions round)', () => {
    const fractional: StoryStop[] = [
      { anchor: 0, leave: 0 },
      { anchor: 717.4, leave: 900 },
    ];
    expect(storyPosition(717, fractional)).toEqual({ from: 1, to: 1, t: 0 });
  });

  it('holds at the first section above it and at the last below it', () => {
    expect(storyPosition(-50, stops)).toEqual({ from: 0, to: 0, t: 0 });
    expect(storyPosition(9000, stops)).toEqual({ from: 2, to: 2, t: 0 });
  });
});

describe('storyFraming', () => {
  const framings: CameraState[] = [
    { target: { x: 0, z: 0 }, zoom: 2 },
    { target: { x: 10, z: 20 }, zoom: 8 },
  ];

  it("is a section's own framing while held there", () => {
    expect(storyFraming({ from: 1, to: 1, t: 0 }, framings, false)).toEqual(framings[1]);
  });

  it('eases between two framings: half-way at the middle, barely moved near either end', () => {
    const middle = storyFraming({ from: 0, to: 1, t: 0.5 }, framings, false);
    expect(middle.target.x).toBeCloseTo(5);
    expect(middle.target.z).toBeCloseTo(10);
    // Zoom moves on a log scale: half-way from 2 to 8 is 4.
    expect(middle.zoom).toBeCloseTo(4);
    const early = storyFraming({ from: 0, to: 1, t: 0.1 }, framings, false);
    expect(early.target.x).toBeLessThan(0.5);
  });

  it('cuts under reduced motion: the section past half-way takes over', () => {
    expect(storyFraming({ from: 0, to: 1, t: 0.4 }, framings, true)).toEqual(framings[0]);
    expect(storyFraming({ from: 0, to: 1, t: 0.6 }, framings, true)).toEqual(framings[1]);
  });
});

describe('sectionInView', () => {
  it('is the section the page is nearer to', () => {
    expect(sectionInView({ from: 2, to: 3, t: 0.49 })).toBe(2);
    expect(sectionInView({ from: 2, to: 3, t: 0.5 })).toBe(3);
    expect(sectionInView({ from: 4, to: 4, t: 0 })).toBe(4);
  });
});

describe('storyOpening', () => {
  // Services (shut), About and Team (the House open), Projects (shut).
  const openings = [0, 1, 1, 0];

  it('lifts the lid as About scrolls in and lowers it as Projects does', () => {
    expect(storyOpening({ from: 0, to: 1, t: 0 }, openings, false)).toBe(0);
    expect(storyOpening({ from: 0, to: 1, t: 0.5 }, openings, false)).toBeCloseTo(0.5);
    expect(storyOpening({ from: 1, to: 2, t: 0.3 }, openings, false)).toBe(1);
    expect(storyOpening({ from: 2, to: 3, t: 0.75 }, openings, false)).toBeCloseTo(0.25);
  });

  it('cuts under reduced motion', () => {
    expect(storyOpening({ from: 0, to: 1, t: 0.45 }, openings, true)).toBe(0);
    expect(storyOpening({ from: 0, to: 1, t: 0.55 }, openings, true)).toBe(1);
  });
});
