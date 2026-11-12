/**
 * Distance from the coast: from each cell of the terrain grid, and of a
 * ring `ring` cells wide round it, to the nearest land cell, centre to
 * centre (a two-pass chamfer with steps of 1 and √2, never shorter than the
 * true distance). The sea's shade and surf (`render/seaModel.ts`) and the
 * fish's shallows (`fish.ts`) read it.
 */
import type { Terrain } from './types';

/** Indexed `(z + ring) * w + (x + ring)`; 0 on land, Infinity with no land at all. */
export function coastDistance(terrain: Terrain, ring = 0): { w: number; d: number; distance: Float32Array } {
  const { width, depth, isle } = terrain;
  const w = width + 2 * ring;
  const d = depth + 2 * ring;
  const distance = new Float32Array(w * d).fill(Infinity);
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (isle[z * width + x] !== -1) distance[(z + ring) * w + x + ring] = 0;
    }
  }
  const relax = (i: number, x: number, z: number, dx: number, dz: number, step: number) => {
    const nx = x + dx;
    const nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= w || nz >= d) return;
    const via = distance[nz * w + nx]! + step;
    if (via < distance[i]!) distance[i] = via;
  };
  for (let z = 0; z < d; z++) {
    for (let x = 0; x < w; x++) {
      const i = z * w + x;
      relax(i, x, z, -1, 0, 1);
      relax(i, x, z, 0, -1, 1);
      relax(i, x, z, -1, -1, Math.SQRT2);
      relax(i, x, z, 1, -1, Math.SQRT2);
    }
  }
  for (let z = d - 1; z >= 0; z--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = z * w + x;
      relax(i, x, z, 1, 0, 1);
      relax(i, x, z, 0, 1, 1);
      relax(i, x, z, 1, 1, Math.SQRT2);
      relax(i, x, z, -1, 1, Math.SQRT2);
    }
  }
  return { w, d, distance };
}
