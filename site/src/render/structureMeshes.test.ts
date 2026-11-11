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
