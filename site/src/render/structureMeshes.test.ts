import { describe, expect, it } from 'vitest';
import { instanceMatrix } from './structureMeshes';

/** Apply a column-major 4×4 matrix to a point. */
const apply = (m: number[], [x, y, z]: [number, number, number]) => [
  m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
  m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
  m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
];
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));

describe('instanceMatrix', () => {
  it('moves a structure\'s pivot to the placement point', () => {
    const m = instanceMatrix({ x: 5, y: 1, z: -2, turns: 0 }, { x: 1.5, y: 0, z: 1.5 });
    close(apply(m, [1.5, 0, 1.5]), [5, 1, -2]);
    close(apply(m, [0, 0, 0]), [3.5, 1, -3.5]);
  });

  it('turns a quarter turn at a time about the pivot: a face towards +z comes to face +x', () => {
    const m = instanceMatrix({ x: 0, y: 0, z: 0, turns: 1 }, { x: 0, y: 0, z: 0 });
    close(apply(m, [0, 0, 1]), [1, 0, 0]);
    close(apply(m, [1, 0, 0]), [0, 0, -1]);
    const twice = instanceMatrix({ x: 0, y: 0, z: 0, turns: 2 }, { x: 0, y: 0, z: 0 });
    close(apply(twice, [0, 2, 1]), [0, 2, -1]);
  });
});

describe('instanceMatrix with a tilt (a vessel rocking)', () => {
  const pivot = { x: 0.5, y: 0, z: 1.5 };

  it('lifts the pivot by the heave and keeps it in place otherwise', () => {
    const m = instanceMatrix({ x: 4, y: 0, z: 7, turns: 1, heave: 0.03, roll: 0.1, pitch: -0.05 }, pivot);
    close(apply(m, [0.5, 0, 1.5]), [4, 0.03, 7]);
  });

  it('rolls about the vessel’s own length: its +x side rises, whichever way it faces', () => {
    const roll = 0.2;
    for (const turns of [0, 1, 2, 3, 0.4]) {
      const m = instanceMatrix({ x: 0, y: 0, z: 0, turns, roll }, { x: 0, y: 0, z: 0 });
      expect(apply(m, [1, 0, 0])[1]).toBeCloseTo(Math.sin(roll), 9);
      expect(apply(m, [0, 0, 1])[1]).toBeCloseTo(0, 9);
    }
  });

  it('pitches about its beam: its bow (+z) rises, whichever way it faces', () => {
    const pitch = 0.1;
    for (const turns of [0, 1, 3]) {
      const m = instanceMatrix({ x: 0, y: 0, z: 0, turns, pitch }, { x: 0, y: 0, z: 0 });
      expect(apply(m, [0, 0, 1])[1]).toBeCloseTo(Math.sin(pitch), 9);
      expect(apply(m, [1, 0, 0])[1]).toBeCloseTo(0, 9);
    }
  });

  it('is the plain placement with no tilt', () => {
    const plain = instanceMatrix({ x: 2, y: 1, z: 3, turns: 2 }, pivot);
    const zero = instanceMatrix({ x: 2, y: 1, z: 3, turns: 2, heave: 0, roll: 0, pitch: 0 }, pivot);
    expect(zero).toEqual(plain);
  });
});
