import { describe, expect, it } from 'vitest';
import { generateWorld, PLACED_LANDMARK_IDS, type ContentCounts, type Vec3, type World } from '@/world';
import { landmarkExtent } from './landmarkModels';
import { blinking, GUIDE_REACH, guideSpot, hoverPose, voxelFlights, flightPoint } from './guideMotion';

const counts: ContentCounts = { projects: 9, clients: 12, partners: 3 };
const worlds = ['lighthouse', '7', '42', 'harbour', '123456', '694157692', 'tide', '99'].map((seed) => generateWorld(seed, counts));

/** Where a point lands on the isometric screen (world units, y up): the camera looks along −(1, 1, 1). */
const screen = (p: Vec3) => ({ x: (p.x - p.z) / Math.SQRT2, y: (2 * p.y - p.x - p.z) / Math.sqrt(6) });

/** A placed Landmark's box on screen. */
const landmarkBox = (world: World, id: (typeof PLACED_LANDMARK_IDS)[number]) => {
  const landmark = world.landmarks.find((l) => l.id === id)!;
  const { min, max } = landmarkExtent(landmark);
  const { origin } = landmark.footprint;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < 8; i++) {
    const p = screen({
      x: origin.x + (i & 1 ? max.x : min.x),
      y: landmark.y + (i & 2 ? max.y : min.y),
      z: origin.z + (i & 4 ? max.z : min.z),
    });
    xs.push(p.x);
    ys.push(p.y);
  }
  return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
};

describe('guideSpot', () => {
  it('hovers beside each placed Landmark, close by, never in front of any Landmark on screen', () => {
    for (const world of worlds) {
      for (const id of PLACED_LANDMARK_IDS) {
        const spot = guideSpot(world, id);
        const at = screen(spot);
        const own = landmarkBox(world, id);
        // Beside its Landmark: within a few units of its box on screen.
        expect(at.x).toBeGreaterThan(own.left - 4);
        expect(at.x).toBeLessThan(own.right + 4);
        expect(at.y).toBeGreaterThan(own.bottom - 1);
        expect(at.y).toBeLessThan(own.top + 4);
        for (const other of PLACED_LANDMARK_IDS) {
          const box = landmarkBox(world, other);
          const clear =
            at.x - GUIDE_REACH >= box.right ||
            at.x + GUIDE_REACH <= box.left ||
            at.y - GUIDE_REACH >= box.top ||
            at.y + GUIDE_REACH <= box.bottom;
          expect(clear, `${world.seed}: the Guide by the ${id} covers the ${other}`).toBe(true);
        }
      }
    }
  });

  it('floats clear of the ground under it', () => {
    for (const world of worlds) {
      const spot = guideSpot(world, 'station');
      const { width, depth, heights } = world.terrain;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = Math.floor(spot.x) + dx;
          const z = Math.floor(spot.z) + dz;
          const ground = x >= 0 && z >= 0 && x < width && z < depth ? heights[z * width + x]! : 0;
          expect(spot.y - GUIDE_REACH).toBeGreaterThan(ground);
        }
      }
    }
  });

  it('is the same spot for the same World', () => {
    expect(guideSpot(worlds[0]!, 'station')).toEqual(guideSpot(generateWorld('lighthouse', counts), 'station'));
  });
});

describe('voxelFlights', () => {
  const targets = Array.from({ length: 60 }, (_, i) => ({ x: (i % 4) - 2, y: Math.floor(i / 16) - 2, z: (Math.floor(i / 4) % 4) - 2 }));
  const flights = voxelFlights(targets);

  it('starts every voxel scattered well away from its place, unseen, and ends each in its place at full size', () => {
    for (const [i, flight] of flights.entries()) {
      const start = flightPoint(flight, 0);
      const end = flightPoint(flight, 1);
      expect(Math.hypot(start.x - targets[i]!.x, start.y - targets[i]!.y, start.z - targets[i]!.z)).toBeGreaterThan(2);
      expect(start.scale).toBe(0);
      expect(end).toEqual({ ...targets[i], scale: 1 });
    }
  });

  it('sends the voxels in turn, not all at once', () => {
    const landed = flights.map((flight) => {
      const p = flightPoint(flight, 0.6);
      return p.scale === 1 && p.x === flight.to.x && p.y === flight.to.y && p.z === flight.to.z;
    });
    expect(landed.some(Boolean)).toBe(true);
    expect(landed.every(Boolean)).toBe(false);
  });

  it('flies the same way every time', () => {
    expect(voxelFlights(targets)).toEqual(flights);
  });
});

describe('hoverPose', () => {
  it('bobs gently about its spot, from rest, with no jumps', () => {
    expect(hoverPose(0)).toEqual({ y: 0, yaw: 0 });
    let last = hoverPose(0);
    for (let t = 0.05; t < 20; t += 0.05) {
      const pose = hoverPose(t);
      expect(Math.abs(pose.y)).toBeLessThanOrEqual(0.15);
      expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(0.15);
      expect(Math.abs(pose.y - last.y)).toBeLessThan(0.02);
      last = pose;
    }
  });
});

describe('blinking', () => {
  it('blinks now and then, briefly', () => {
    let closed = 0;
    let blinks = 0;
    let was = false;
    for (let t = 0; t < 30; t += 0.01) {
      const shut = blinking(t);
      if (shut) closed++;
      if (shut && !was) blinks++;
      was = shut;
    }
    expect(blinks).toBeGreaterThanOrEqual(5);
    expect(closed / 3000).toBeLessThan(0.08);
  });
});
