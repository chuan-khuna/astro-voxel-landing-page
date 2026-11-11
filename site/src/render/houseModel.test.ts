import { describe, expect, it } from 'vitest';
import { VoxelGrid } from './mesher';
import {
  DEVELOPER_PARTS,
  HOUSE_INTERIOR,
  HOUSE_SIZE,
  SCREEN,
  developerExtent,
  drawDeveloperPart,
  drawHouseBase,
  drawHouseLid,
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
const base = voxelsOf((draw) => drawHouseBase(draw, colours));
const lid = voxelsOf((draw) => drawHouseLid(draw, colours));
const room = voxelsOf((draw) => drawHouseRoom(draw, colours));
const developer = DEVELOPER_PARTS.flatMap((part) => voxelsOf((draw) => drawDeveloperPart(part, draw, colours)));

const key = (v: Voxel) => `${v.x},${v.y},${v.z}`;
const { min, max } = HOUSE_INTERIOR;
const inInterior = (v: Voxel) => v.x >= min.x && v.x < max.x && v.y >= min.y && v.y < max.y && v.z >= min.z && v.z < max.z;

describe('the House model', () => {
  it('is 3×3 cells: 12×12 quarter voxels', () => {
    expect(HOUSE_SIZE).toEqual({ w: 12, d: 12 });
  });

  it('splits into a base that stays and a lid that lifts, which never share a voxel', () => {
    const baseKeys = new Set(base.map(key));
    for (const v of lid) expect(baseKeys.has(key(v)), key(v)).toBe(false);
    expect(base.length).toBeGreaterThan(0);
    expect(lid.length).toBeGreaterThan(0);
  });

  it('keeps the interior space empty in the base and the lid, ready for a room', () => {
    for (const v of [...base, ...lid]) expect(inInterior(v), key(v)).toBe(false);
  });

  it('closes the room from above with the lid: a lid voxel over every interior column', () => {
    for (let x = min.x; x < max.x; x++) {
      for (let z = min.z; z < max.z; z++) {
        expect(lid.some((v) => v.x === x && v.z === z && v.y >= max.y), `${x},${z}`).toBe(true);
      }
    }
  });

  it('opens the room to the camera with the lid off: the base has no wall on the front (+x and +z) sides', () => {
    for (const v of base) {
      if (v.y < min.y) continue; // the plinth and floor
      expect(v.x < max.x && v.z < max.z, key(v)).toBe(true);
    }
  });

  it('stays inside its footprint', () => {
    for (const v of [...base, ...lid, ...room, ...developer]) {
      expect(v.x >= 0 && v.x < HOUSE_SIZE.w && v.z >= 0 && v.z < HOUSE_SIZE.d && v.y >= 0, key(v)).toBe(true);
    }
  });
});

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
