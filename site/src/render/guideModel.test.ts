import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { GUIDE_MOODS } from '@/lib/guideLines';
import { GUIDE_BODY, GUIDE_FACES, GUIDE_SCREEN, guideVoxels } from './guideModel';
import { worldColours } from './worldVoxels';

const colours = worldColours(generateWorld('lighthouse', { projects: 6, clients: 6, partners: 3 }));

describe('the Guide model', () => {
  const grid = guideVoxels(colours);
  const voxels = [...grid.voxels()];

  it('is a cube of ¼-unit voxels, centred on its origin, with an antenna on top', () => {
    expect(grid.size).toBe(0.25);
    const half = GUIDE_BODY / 2;
    // The body: every voxel of its outer shell is there.
    for (let i = 0; i < GUIDE_BODY; i++) {
      expect(grid.has(i - half, -half, -half)).toBe(true);
      expect(grid.has(half - 1, i - half, half - 1)).toBe(true);
    }
    // The antenna stands above the body, and nothing hangs below it.
    expect(Math.max(...voxels.map((v) => v.y))).toBeGreaterThan(half);
    expect(Math.min(...voxels.map((v) => v.y))).toBe(-half);
  });

  it('frames its screen in a dark bezel on its +x face, inside the face', () => {
    const half = GUIDE_BODY / 2;
    expect(GUIDE_SCREEN.min.y).toBeGreaterThan(-half);
    expect(GUIDE_SCREEN.max.y).toBeLessThan(half);
    expect(GUIDE_SCREEN.min.z).toBeGreaterThan(-half);
    expect(GUIDE_SCREEN.max.z).toBeLessThan(half);
    expect(grid.get(half - 1, 0, 0)).toBe(colours.fixed('screenDark'));
  });
});

describe('the Guide faces', () => {
  const faces = [...GUIDE_MOODS, 'blink' as const].map((mood) => GUIDE_FACES[mood]);

  it('has a face for every mood and a blink, each a full pixel grid with two eyes lit', () => {
    for (const face of faces) {
      expect(face).toHaveLength(GUIDE_FACES.neutral.length);
      for (const row of face) expect(row).toHaveLength(GUIDE_FACES.neutral[0]!.length);
      const width = face[0]!.length;
      const lit = (from: number, to: number) => face.some((row) => row.slice(from, to).includes('#'));
      // An eye in each half.
      expect(lit(0, width / 2)).toBe(true);
      expect(lit(width / 2, width)).toBe(true);
    }
  });

  it('shows every mood as a different face', () => {
    const drawn = new Set(faces.map((face) => face.join('\n')));
    expect(drawn.size).toBe(faces.length);
  });
});
