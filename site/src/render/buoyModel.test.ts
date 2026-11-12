import { GLOW_STEADY } from '@/structures/roles';
import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { VoxelGrid } from './mesher';
import { buoyLamp, drawBuoy } from './buoyModel';
import { worldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

const world = generateWorld('harbour', { projects: 6, clients: 5, partners: 3 });
const colours = worldColours(world);

describe('buoy model', () => {
  it('has buoys to draw in this World', () => {
    expect(world.buoys.length).toBeGreaterThan(0);
  });

  it('draws each buoy inside its own cell, floating from the sea floor up, a unit tall', () => {
    for (const cell of world.buoys) {
      const grid = new VoxelGrid(1 / GROUND_DETAIL);
      drawBuoy(cell, grid, colours);
      const voxels = [...grid.voxels()];
      expect(voxels.length).toBeGreaterThan(0);
      for (const v of voxels) {
        expect(Math.floor(v.x / GROUND_DETAIL)).toBe(cell.x);
        expect(Math.floor(v.z / GROUND_DETAIL)).toBe(cell.z);
        expect(v.y).toBeGreaterThanOrEqual(0);
      }
      expect(Math.max(...voxels.map((v) => v.y)) + 1).toBe(GROUND_DETAIL);
    }
  });

  it('puts the lamp on top: the box that glows at Night is the buoy’s lamp voxel', () => {
    const lampColour = colours.fixed('lamp', 0, GLOW_STEADY);
    for (const cell of world.buoys) {
      const grid = new VoxelGrid(1 / GROUND_DETAIL);
      drawBuoy(cell, grid, colours);
      const lamps = [...grid.voxels()].filter((v) => v.colour === lampColour);
      expect(lamps).toHaveLength(1);
      const lamp = lamps[0]!;
      const top = Math.max(...[...grid.voxels()].map((v) => v.y));
      expect(lamp.y).toBe(top);
      const q = 1 / GROUND_DETAIL;
      expect(buoyLamp(cell)).toEqual({
        min: { x: lamp.x * q, y: lamp.y * q, z: lamp.z * q },
        max: { x: (lamp.x + 1) * q, y: (lamp.y + 1) * q, z: (lamp.z + 1) * q },
      });
    }
  });
});
