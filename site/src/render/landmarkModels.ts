/**
 * Landmark models in ¼-unit voxels. These are simple placeholders, one per
 * placed Landmark, so the render path for ¼-unit models is in place; the
 * real models replace them in later tickets by changing only this module.
 *
 * Each model is drawn into the detail grid with its origin at the min corner
 * of the Landmark's cell, on top of the ground: local x and z run 0–3 inside
 * the cell, local y = 0 is the first voxel above the ground.
 */
import type { PlacedLandmark, PlacedLandmarkId } from '../world';
import type { VoxelGrid } from './mesher';
import type { WorldColours } from './worldVoxels';

interface Origin {
  x: number;
  y: number;
  z: number;
}

type Draw = {
  box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number | null) => void;
  set: (x: number, y: number, z: number, colour: number) => void;
};

type Model = (draw: Draw, colours: WorldColours, variant: number) => void;

const MODELS: Record<PlacedLandmarkId, Model> = {
  /** A grey mast with an accent light on top. */
  station: ({ box }, { fixed, biome }) => {
    box(0, 0, 0, 4, 1, 4, fixed('metalDark'));
    box(1, 1, 1, 3, 9, 3, fixed('metal'));
    box(0, 6, 0, 4, 7, 4, fixed('metalDark'));
    box(1, 9, 1, 3, 10, 3, biome('accent'));
  },
  /** A whitewashed block with a plinth, a blue door, a window and a blue dome. */
  house: ({ box, set }, { fixed }) => {
    box(0, 0, 0, 4, 1, 4, fixed('plinth'));
    box(0, 1, 0, 4, 5, 4, fixed('whitewash'));
    box(0, 5, 0, 4, 6, 4, fixed('roofWhite'));
    box(1, 1, 3, 2, 3, 4, fixed('blueDoor'));
    set(3, 3, 3, fixed('glass'));
    set(3, 3, 0, fixed('glass'));
    box(1, 6, 1, 3, 7, 3, fixed('blueTrim'));
    set(0, 4, 3, fixed('bougainvillea'));
    set(0, 3, 3, fixed('bougainLight'));
  },
  /** Low hedges round a flower bed. */
  garden: ({ box, set }, { biome, fixed }) => {
    box(0, 0, 0, 4, 1, 1, biome('foliage'));
    box(0, 0, 3, 4, 1, 4, biome('foliage'));
    box(0, 0, 1, 1, 1, 3, biome('foliage', -0.04));
    set(2, 0, 1, fixed('bougainvillea'));
    set(1, 0, 2, fixed('bougainLight'));
    set(3, 1, 0, biome('foliage', 0.04));
  },
  /** A plank platform on posts. */
  dock: ({ box }, { fixed }) => {
    for (const [x, z] of [
      [0, 0],
      [3, 0],
      [0, 3],
      [3, 3],
    ] as const) {
      box(x, 0, z, x + 1, 1, z + 1, fixed('trunk'));
    }
    box(0, 1, 0, 4, 2, 4, fixed('plank'));
  },
  /** A post with a blue box. */
  mailbox: ({ box }, { fixed }) => {
    box(1, 0, 1, 2, 2, 2, fixed('trunk'));
    box(1, 2, 1, 3, 4, 3, fixed('blueTrim'));
  },
};

export function buildLandmark(landmark: PlacedLandmark, grid: VoxelGrid, colours: WorldColours, origin: Origin): void {
  const draw: Draw = {
    box: (x0, y0, z0, x1, y1, z1, colour) =>
      grid.box(origin.x + x0, origin.y + y0, origin.z + z0, origin.x + x1, origin.y + y1, origin.z + z1, colour),
    set: (x, y, z, colour) => grid.set(origin.x + x, origin.y + y, origin.z + z, colour),
  };
  MODELS[landmark.id](draw, colours, landmark.variant);
}
