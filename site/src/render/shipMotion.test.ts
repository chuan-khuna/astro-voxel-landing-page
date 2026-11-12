import { describe, expect, it } from 'vitest';
import { sailingPath, shipPose } from './shipMotion';

/** A 4×4 square of cells, sailed clockwise on screen (east along the top, then south). */
const square = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 2, z: 0 },
  { x: 3, z: 0 },
  { x: 3, z: 1 },
  { x: 3, z: 2 },
  { x: 3, z: 3 },
  { x: 2, z: 3 },
  { x: 1, z: 3 },
  { x: 0, z: 3 },
  { x: 0, z: 2 },
  { x: 0, z: 1 },
];

describe('sailingPath', () => {
  it('rounds the corners of the loop through the cell centres, so it is a little shorter than the cell loop', () => {
    const path = sailingPath(square);
    // The cell loop is 12 long; cutting its four corners shortens it.
    expect(path.length).toBeGreaterThan(10);
    expect(path.length).toBeLessThan(12);
    for (const p of path.points) {
      expect(p.x).toBeGreaterThanOrEqual(0.5);
      expect(p.x).toBeLessThanOrEqual(3.5);
      expect(p.z).toBeGreaterThanOrEqual(0.5);
      expect(p.z).toBeLessThanOrEqual(3.5);
    }
  });
});

describe('shipPose', () => {
  const path = sailingPath(square);

  it('sails the middle of the first side heading east, along the cell centres', () => {
    const start = shipPose(path, 0);
    const later = shipPose(path, 1);
    expect(later.z).toBeCloseTo(0.5, 5);
    expect(later.x).toBeGreaterThan(start.x);
    // Heading east: +x.
    expect(Math.cos(later.heading)).toBeCloseTo(1, 1);
    expect(Math.sin(later.heading)).toBeCloseTo(0, 1);
  });

  it('heads south down the second side', () => {
    const pose = shipPose(path, path.length * 0.37);
    expect(pose.x).toBeCloseTo(3.5, 5);
    expect(Math.sin(pose.heading)).toBeCloseTo(1, 1);
  });

  it('wraps round the loop, forwards and backwards', () => {
    const at = shipPose(path, 2.5);
    for (const s of [2.5 + path.length, 2.5 - path.length, 2.5 + 3 * path.length]) {
      const wrapped = shipPose(path, s);
      expect(wrapped.x).toBeCloseTo(at.x, 6);
      expect(wrapped.z).toBeCloseTo(at.z, 6);
      expect(wrapped.heading).toBeCloseTo(at.heading, 6);
    }
  });

  it('turns smoothly: the heading never jumps far between nearby points', () => {
    const step = 0.05;
    for (let s = 0; s < path.length; s += step) {
      const a = shipPose(path, s).heading;
      const b = shipPose(path, s + step).heading;
      const turn = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
      expect(turn, `at ${s.toFixed(2)}`).toBeLessThan(0.2);
    }
  });
});
