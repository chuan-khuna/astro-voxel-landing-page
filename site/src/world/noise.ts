import type { Rng } from './prng';

/** A seeded 2D noise function returning values in roughly [-1, 1]. */
export type Noise2D = (x: number, y: number) => number;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRADIENTS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** 2D simplex noise with a permutation table shuffled by the seeded PRNG. */
export function createSimplex2D(rng: Rng): Noise2D {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;

  const corner = (gi: number, x: number, y: number) => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const [gx, gy] = GRADIENTS[gi % 8]!;
    return t * t * t * t * (gx * x + gy * y);
  };

  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const n =
      corner(perm[ii + perm[jj]!]!, x0, y0) +
      corner(perm[ii + i1 + perm[jj + j1]!]!, x1, y1) +
      corner(perm[ii + 1 + perm[jj + 1]!]!, x2, y2);
    return 70 * n;
  };
}

/** Fractal Brownian motion: octaves of noise at doubling frequency, halving amplitude. Roughly [-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}
