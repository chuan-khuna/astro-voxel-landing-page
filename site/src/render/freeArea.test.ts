import { describe, expect, it } from 'vitest';
import { freeCentre } from './freeArea';

/** A 1280×800 full-screen World. */
const desktop = { left: 0, top: 0, right: 1280, bottom: 800 };
/** A 390×844 phone. */
const phone = { left: 0, top: 0, right: 390, bottom: 844 };

describe('freeCentre', () => {
  it('puts the Landmark in the middle of the part left of a side panel', () => {
    const panel = { left: 864, top: 80, right: 1264, bottom: 784 };
    expect(freeCentre(desktop, [panel])).toEqual({ x: -208, y: 0 });
  });

  it('puts the Landmark between the top bar and a bottom sheet', () => {
    const bar = { left: 0, top: 0, right: 390, bottom: 64 };
    const sheet = { left: 8, top: 444, right: 382, bottom: 836 };
    // Free from y 64 to 444: its middle, 254, is 168 above the centre (422).
    expect(freeCentre(phone, [bar, sheet])).toEqual({ x: 0, y: -168 });
  });

  it('takes the dice just above a tall bottom sheet off the bottom too, though its middle is in the top half', () => {
    const bar = { left: 8, top: 8, right: 382, bottom: 51 };
    const dice = { left: 8, top: 314, right: 340, bottom: 364 };
    const sheet = { left: 8, top: 377, right: 382, bottom: 841 };
    // Free from y 51 to 314: its middle, 182.5, is 239.5 above the centre (422).
    expect(freeCentre(phone, [bar, dice, sheet])).toEqual({ x: 0, y: -239.5 });
  });
});

describe('freeCentre with small cards', () => {
  it('ignores cards in a corner, like the company name and the dice', () => {
    const brand = { left: 16, top: 16, right: 276, bottom: 68 };
    expect(freeCentre(desktop, [brand])).toEqual({ x: 0, y: 0 });
  });

  it('ignores a hidden card (an empty box)', () => {
    expect(freeCentre(desktop, [{ left: 0, top: 0, right: 0, bottom: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('stays at the centre when the cards leave nothing free', () => {
    const top = { left: 0, top: 0, right: 1280, bottom: 500 };
    const bottom = { left: 0, top: 200, right: 1280, bottom: 800 };
    expect(freeCentre(desktop, [top, bottom])).toEqual({ x: 0, y: 0 });
  });
});

describe('freeCentre on a desktop with a top bar', () => {
  it('puts the Landmark right of a panel on the left and below the bar', () => {
    const bar = { left: 0, top: 0, right: 1280, bottom: 80 };
    const panel = { left: 16, top: 96, right: 416, bottom: 784 };
    expect(freeCentre(desktop, [bar, panel])).toEqual({ x: 208, y: 40 });
  });
});

describe('freeCentre on DOMRect-like boxes', () => {
  /** Like a DOMRect: its sides are getters on the prototype, not own fields. */
  class Box {
    constructor(private readonly x: number, private readonly y: number, private readonly w: number, private readonly h: number) {}
    get left() { return this.x; }
    get top() { return this.y; }
    get right() { return this.x + this.w; }
    get bottom() { return this.y + this.h; }
  }

  it('reads boxes from getBoundingClientRect()', () => {
    const frame = new Box(0, 0, 1280, 800);
    const panel = new Box(864, 80, 400, 704);
    expect(freeCentre(frame, [panel])).toEqual({ x: -208, y: 0 });
  });
});
