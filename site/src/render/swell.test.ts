import { describe, expect, it } from 'vitest';
import { MAX_PITCH, MAX_ROLL, seaHash, seaCellSeed, vesselRock } from './swell';

/** three's TSL `hash` of each cell's seed, worked out independently (PCG in Python's integers). */
const HASH = { '0,0': 0.7750048765446991, '1,0': 0.7286466509103775, '12,7': 0.01027840725146234 };

/** The time (0–4.5 s) a vessel on a cell with this phase at time 0 is at its crest. */
const crest = (phase: number) => ((((Math.PI / 2 - phase) / (2 * Math.PI)) * 4.5) % 4.5 + 4.5) % 4.5;

describe('seaHash', () => {
  it('matches the shader’s hash of a water voxel’s cell', () => {
    expect(seaHash(seaCellSeed(0, 0))).toBeCloseTo(HASH['0,0'], 12);
    expect(seaHash(seaCellSeed(1, 0))).toBeCloseTo(HASH['1,0'], 12);
    expect(seaHash(seaCellSeed(12, 7))).toBeCloseTo(HASH['12,7'], 12);
  });
});

describe('vesselRock', () => {
  it('rises and falls 0.04 with the water voxel of its cell: its own phase plus the swell’s', () => {
    const t = crest(HASH['0,0'] * Math.PI);
    expect(vesselRock(0.5, 0.5, t).heave).toBeCloseTo(0.04, 9);
    expect(vesselRock(0.5, 0.5, t + 2.25).heave).toBeCloseTo(-0.04, 9);
    // One cell along x: the swell turns 0.55 radians, and the voxel's own phase differs.
    expect(vesselRock(1.5, 0.5, crest(HASH['1,0'] * Math.PI + 0.55)).heave).toBeCloseTo(0.04, 9);
    expect(vesselRock(12.2, 7.9, crest(HASH['12,7'] * Math.PI + 19 * 0.55)).heave).toBeCloseTo(0.04, 9);
  });

  it('rocks gently and repeats every swell', () => {
    for (let t = 0; t < 9; t += 0.37) {
      const rock = vesselRock(12.5, 7.5, t);
      expect(Math.abs(rock.roll)).toBeLessThanOrEqual(MAX_ROLL);
      expect(Math.abs(rock.pitch)).toBeLessThanOrEqual(MAX_PITCH);
      const later = vesselRock(12.5, 7.5, t + 4.5);
      expect(later.heave).toBeCloseTo(rock.heave, 9);
      expect(later.roll).toBeCloseTo(rock.roll, 9);
      expect(later.pitch).toBeCloseTo(rock.pitch, 9);
    }
    expect(MAX_ROLL).toBeLessThan(0.1);
  });

  it('holds still on a frozen clock: the same moment is the same pose', () => {
    expect(vesselRock(3.5, 9.5, 0)).toEqual(vesselRock(3.5, 9.5, 0));
  });
});
