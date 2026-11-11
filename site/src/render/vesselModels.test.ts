import { describe, expect, it } from 'vitest';
import { generateWorld } from '../world';
import { VoxelGrid } from './mesher';
import { drawBoat, shipVoxels, SHIP_ORIGIN } from './vesselModels';
import { worldColours } from './worldVoxels';
import { GROUND_DETAIL } from './voxelTiers';

const world = generateWorld('harbour', { projects: 6, clients: 12, partners: 3 });
const colours = worldColours(world);

/** The ¼-voxel box a grid's voxels fill. */
const extent = (grid: VoxelGrid) => {
  const all = [...grid.voxels()];
  const span = (axis: 'x' | 'y' | 'z') => Math.max(...all.map((v) => v[axis])) - Math.min(...all.map((v) => v[axis])) + 1;
  return { x: span('x'), y: span('y'), z: span('z'), min: Math.min(...all.map((v) => v.y)) };
};

describe('vessel models', () => {
  it('draws each boat inside its own cell, floating from the sea floor up', () => {
    for (const boat of world.boats) {
      const grid = new VoxelGrid(1 / GROUND_DETAIL);
      drawBoat(boat, grid, colours);
      expect(grid.count).toBeGreaterThan(0);
      for (const v of grid.voxels()) {
        expect(Math.floor(v.x / GROUND_DETAIL)).toBe(boat.cell.x);
        expect(Math.floor(v.z / GROUND_DETAIL)).toBe(boat.cell.z);
        expect(v.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('points each boat along its facing: longer that way than across', () => {
    for (const boat of world.boats) {
      const grid = new VoxelGrid(1 / GROUND_DETAIL);
      drawBoat(boat, grid, colours);
      const { x, z } = extent(grid);
      if (boat.facing === 'east' || boat.facing === 'west') expect(x).toBeGreaterThan(z);
      else expect(z).toBeGreaterThan(x);
    }
  });

  it('makes a ship larger than a boat every way: longer, wider and taller', () => {
    const boat = new VoxelGrid(1 / GROUND_DETAIL);
    drawBoat({ cell: { x: 0, z: 0 }, facing: 'east' }, boat, colours);
    const ship = extent(shipVoxels(colours));
    const small = extent(boat);
    expect(ship.x).toBeGreaterThanOrEqual(small.x * 2);
    expect(ship.z).toBeGreaterThan(small.z);
    expect(ship.y).toBeGreaterThan(small.y * 2);
    expect(ship.min).toBe(0);
  });

  it('centres the ship on its origin, bow towards +x', () => {
    const ship = shipVoxels(colours);
    const all = [...ship.voxels()];
    const xs = all.map((v) => v.x + 0.5 - SHIP_ORIGIN.x);
    const zs = all.map((v) => v.z + 0.5 - SHIP_ORIGIN.z);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 5);
    expect(Math.min(...zs) + Math.max(...zs)).toBeCloseTo(0, 5);
  });
});
