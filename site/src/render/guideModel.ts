/**
 * The Guide's model, in ¼-unit voxels: a small floating cube with a screen
 * face. An original design: a pale shell with blue side fins, a dark bezel
 * round a square screen on its +x face, and a thin antenna with a lamp,
 * set back from the screen. The model is centred on its origin, so it turns
 * and bobs about its middle.
 *
 * The screen is not voxels: it is a plane over the bezel (`GUIDE_SCREEN`)
 * that shows one of the pixel-eye faces (`GUIDE_FACES`), drawn by `guide.ts`.
 * Plain data, no three.js.
 */
import type { GuideMood } from '@/lib/guideLines';
import { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';

/** The body's side, in ¼ voxels: 1.5 world units. */
export const GUIDE_BODY = 6;

const HALF = GUIDE_BODY / 2;

/**
 * The screen's rectangle on the +x face, in ¼ voxels from the model's
 * centre: it lies in the plane `x`, from `min` to `max` in y and z.
 */
export const GUIDE_SCREEN = { x: HALF, min: { y: -2, z: -2 }, max: { y: 2, z: 2 } } as const;

/** Draw the Guide, centred on the origin, its screen facing +x. */
export function guideVoxels({ fixed }: Pick<WorldColours, 'fixed'>): VoxelGrid {
  const grid = new VoxelGrid(0.25);
  // The shell, with darker edges along the top so the cube reads as a cube.
  grid.box(-HALF, -HALF, -HALF, HALF, HALF, HALF, fixed('whitewash'));
  grid.box(-HALF, HALF - 1, -HALF, HALF, HALF, HALF, fixed('roofWhite'));
  grid.box(-HALF, -HALF, -HALF, HALF, -HALF + 1, HALF, fixed('plinth'));
  // The bezel round the screen: one voxel deep into the +x face.
  const { min, max } = GUIDE_SCREEN;
  grid.box(HALF - 1, min.y, min.z, HALF, max.y, max.z, fixed('screenDark'));
  // A fin on each side (±z), so it is not just a box.
  grid.box(-1, -1, -HALF - 1, 1, 1, -HALF, fixed('blueTrim'));
  grid.box(-1, -1, HALF, 1, 1, HALF + 1, fixed('blueTrim'));
  // The antenna, set back from the screen, and its lamp.
  grid.box(-2, HALF, -2, -1, HALF + 2, -1, fixed('metalDark'));
  grid.set(-2, HALF + 2, -2, fixed('blueTrim'));
  return grid;
}

/** A face on the screen: `#` lit pixels, `.` dark, rows top to bottom. */
export type GuideFace = readonly string[];

/**
 * The screen's pixel-eye faces, one per mood plus `blink` (12 × 10 pixels).
 * Eyes only; no mouth. Moods are in `lib/guideLines.ts`.
 */
export const GUIDE_FACES: Record<GuideMood | 'blink', GuideFace> = {
  neutral: [
    '............',
    '............',
    '............',
    '..##....##..',
    '..##....##..',
    '..##....##..',
    '............',
    '............',
    '............',
    '............',
  ],
  happy: [
    '............',
    '............',
    '............',
    '............',
    '..##....##..',
    '.#..#..#..#.',
    '............',
    '............',
    '............',
    '............',
  ],
  smug: [
    '............',
    '............',
    '.......####.',
    '........##..',
    '.####...##..',
    '..##....##..',
    '............',
    '............',
    '............',
    '............',
  ],
  surprised: [
    '............',
    '............',
    '..##....##..',
    '.#..#..#..#.',
    '.#..#..#..#.',
    '..##....##..',
    '............',
    '............',
    '............',
    '............',
  ],
  sleepy: [
    '............',
    '............',
    '............',
    '............',
    '.####..####.',
    '..##....##..',
    '............',
    '............',
    '............',
    '............',
  ],
  wink: [
    '............',
    '............',
    '............',
    '........##..',
    '.####...##..',
    '........##..',
    '............',
    '............',
    '............',
    '............',
  ],
  blink: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '.####..####.',
    '............',
    '............',
    '............',
    '............',
  ],
};
