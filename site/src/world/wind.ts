import { createRng } from './prng';
import type { Wind } from './types';

/**
 * The World's wind: one direction across the ground for the whole World,
 * drawn from a sequence of the Seed's own, so it never moves the layout and
 * content counts never turn it. Ambient Life reads it through the shared
 * wind uniform (`render/ambientClock.ts`), which adds the gusts.
 */
export function windFor(seed: string): Wind {
  const angle = createRng(`${seed}/wind`)() * 2 * Math.PI;
  return { direction: { x: Math.cos(angle), z: Math.sin(angle) } };
}
