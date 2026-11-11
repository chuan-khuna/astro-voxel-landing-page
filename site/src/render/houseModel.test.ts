import { describe, expect, it } from 'vitest';
import { VoxelGrid } from './mesher';
import {
  DEVELOPER_PARTS,
  HOUSE_INTERIOR,
  SCREEN,
  developerExtent,
  drawDeveloperPart,
  drawHouseRoom,
  type HouseDraw,
} from './houseModel';

type Voxel = { x: number; y: number; z: number };

/** Every voxel one part of the House draws, in the House's local ¼ voxels. */
function voxelsOf(paint: (draw: HouseDraw) => void): Voxel[] {
  const grid = new VoxelGrid(1);
  paint({
    box: (x0, y0, z0, x1, y1, z1, colour) => grid.box(x0, y0, z0, x1, y1, z1, colour),
    set: (x, y, z, colour) => grid.set(x, y, z, colour),
  });
  return [...grid.voxels()].map(({ x, y, z }) => ({ x, y, z }));
}

const colours = { fixed: () => 0, biome: () => 0 };
const room = voxelsOf((draw) => drawHouseRoom(draw, colours));
const developer = DEVELOPER_PARTS.flatMap((part) => voxelsOf((draw) => drawDeveloperPart(part, draw, colours)));

const key = (v: Voxel) => `${v.x},${v.y},${v.z}`;
const { min, max } = HOUSE_INTERIOR;
const inInterior = (v: Voxel) => v.x >= min.x && v.x < max.x && v.y >= min.y && v.y < max.y && v.z >= min.z && v.z < max.z;

describe('the room', () => {
  it('fits the interior space, furniture and developer alike', () => {
    for (const v of [...room, ...developer]) expect(inInterior(v), key(v)).toBe(true);
  });

  it('never overlaps the developer’s moving parts', () => {
    const roomKeys = new Set(room.map(key));
    for (const v of developer) expect(roomKeys.has(key(v)), key(v)).toBe(false);
  });

  it('has a screen on the face of the computer, facing the camera side (+x)', () => {
    const roomKeys = new Set(room.map(key));
    // The computer is solid right behind every ¼ voxel of the screen.
    for (let y = Math.floor(SCREEN.y0); y < Math.ceil(SCREEN.y1); y++) {
      for (let z = Math.floor(SCREEN.z0); z < Math.ceil(SCREEN.z1); z++) {
        expect(roomKeys.has(`${SCREEN.x - 1},${y},${z}`), `${y},${z}`).toBe(true);
        expect(roomKeys.has(`${SCREEN.x},${y},${z}`), `${y},${z} in front`).toBe(false);
      }
    }
  });

  it('gives the developer a box round every voxel of them, for their link', () => {
    const { min: a, max: b } = developerExtent();
    const body = room.filter((v) => v.x >= a.x && v.x < b.x && v.y >= a.y && v.y < b.y && v.z >= a.z && v.z < b.z);
    expect(body.length).toBeGreaterThan(0); // the seated body is drawn with the room
    for (const v of developer) {
      expect(v.x >= a.x && v.x < b.x && v.y >= a.y && v.y < b.y && v.z >= a.z && v.z < b.z, key(v)).toBe(true);
    }
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(a[axis]).toBeGreaterThanOrEqual(min[axis]);
      expect(b[axis]).toBeLessThanOrEqual(max[axis]);
    }
  });
});
