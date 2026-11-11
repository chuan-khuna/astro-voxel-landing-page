import { describe, expect, it } from 'vitest';
import { PLACED_LANDMARK_IDS } from '../world';
import { landmarkExtent } from './landmarkModels';

describe('landmarkExtent', () => {
  it('measures the box each model draws, in world units', () => {
    // The Station mast: a 4×4 base in one cell, 10 quarter-voxels tall.
    expect(landmarkExtent('station')).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2.5, z: 1 } });
  });

  it('gives every placed Landmark a non-empty box', () => {
    for (const id of PLACED_LANDMARK_IDS) {
      const { min, max } = landmarkExtent(id);
      expect(max.x).toBeGreaterThan(min.x);
      expect(max.y).toBeGreaterThan(min.y);
      expect(max.z).toBeGreaterThan(min.z);
    }
  });
});
