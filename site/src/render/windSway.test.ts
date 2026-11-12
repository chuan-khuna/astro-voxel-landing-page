import { describe, expect, it } from 'vitest';
import { DECORATION_KINDS } from '@/world';
import { MAX_SWAY, SWAY_FLUTTER, SWAY_LEAN, swaysInWind } from './windSway';

describe('wind sway', () => {
  it('sways the plants among the Decoration and nothing built', () => {
    expect(DECORATION_KINDS.filter(swaysInWind)).toEqual(['grass', 'clump', 'bush', 'sapling']);
  });

  it('moves a canopy at most half a ⅛-unit voxel', () => {
    expect(MAX_SWAY * (SWAY_LEAN + SWAY_FLUTTER)).toBeLessThanOrEqual(1 / 16);
  });
});
