import { describe, expect, it } from 'vitest';
import { stateShowing, type CameraLimits } from './cameraMath';
import type { LandmarkFocus } from './landmarkFocus';
import { insideHouse, outOfHouse } from './houseLeave';

const limits: CameraLimits = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, minZoom: 1, maxZoom: 10 };
/** The House's own close-up: its middle, raised on its ground, at zoom 3. */
const house: LandmarkFocus = { point: { x: 10, y: 2, z: 10 }, zoom: 3 };
/** Half the frame, in frame units at zoom 1 (a 16:9 frame). */
const half = { x: 16, y: 9 };
/** The camera showing the House at `at` (frame units from the centre, y up) at `zoom`. */
const showing = (zoom: number, at = { x: 0, y: 0 }) => stateShowing(house.point, zoom, at, limits);

describe('outOfHouse', () => {
  it('stays in at the House Interior close-up, and at the House’s own', () => {
    expect(outOfHouse(showing(7), house, half)).toBe(false);
    expect(outOfHouse(showing(3), house, half)).toBe(false);
  });

  it('is out once zoomed further back than the House’s own close-up', () => {
    expect(outOfHouse(showing(2.9), house, half)).toBe(true);
    expect(outOfHouse(showing(1), house, half)).toBe(true);
  });

  it('stays in while the House is anywhere on screen, off centre beside a panel too', () => {
    expect(outOfHouse(showing(7, { x: 15, y: 0 }), house, half)).toBe(false);
    expect(outOfHouse(showing(7, { x: -15, y: 8 }), house, half)).toBe(false);
  });

  it('is out once panned so far that the House is off screen', () => {
    expect(outOfHouse(showing(7, { x: 17, y: 0 }), house, half)).toBe(true);
    expect(outOfHouse(showing(7, { x: 0, y: -10 }), house, half)).toBe(true);
  });
});

describe('insideHouse', () => {
  it('is inside at the House Interior close-up, the House on screen', () => {
    expect(insideHouse(showing(7), house, half)).toBe(true);
    expect(insideHouse(showing(7, { x: 15, y: 0 }), house, half)).toBe(true);
  });

  it('is not yet inside at the House’s own close-up: between there and inside is the margin before leaving', () => {
    expect(insideHouse(showing(3), house, half)).toBe(false);
    expect(insideHouse(showing(3.6), house, half)).toBe(false);
    expect(insideHouse(showing(3.9), house, half)).toBe(true);
  });

  it('is not inside with the House off screen, however close', () => {
    expect(insideHouse(showing(7, { x: 17, y: 0 }), house, half)).toBe(false);
  });
});
