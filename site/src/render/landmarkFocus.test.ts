import { describe, expect, it } from 'vitest';
import { generateWorld, LANDMARK_IDS, PLACED_LANDMARK_IDS, type ContentCounts } from '../world';
import { landmarkFocus } from './landmarkFocus';

const counts: ContentCounts = { projects: 6, clients: 5, partners: 3 };
const worlds = ['lighthouse', '7', '42', 'harbour', '123456'].map((seed) => generateWorld(seed, counts));

describe('landmarkFocus', () => {
  it('frames the Overview exactly as the World first appears', () => {
    for (const world of worlds) {
      const focus = landmarkFocus(world, 'overview');
      expect(focus.point).toEqual(world.views.overview.target);
      expect(focus.zoom).toBe(1);
    }
  });

  it('looks at the middle of each placed Landmark’s footprint, on top of its ground', () => {
    for (const world of worlds) {
      for (const id of PLACED_LANDMARK_IDS) {
        const landmark = world.landmarks.find((l) => l.id === id)!;
        const { origin, width, depth } = landmark.footprint;
        const { point } = landmarkFocus(world, id);
        expect(point.x).toBe(origin.x + width / 2);
        expect(point.z).toBe(origin.z + depth / 2);
        expect(point.y).toBe(landmark.y);
      }
    }
  });

  it('zooms in on every Landmark but the Overview, and closest into the House', () => {
    for (const world of worlds) {
      for (const id of LANDMARK_IDS) {
        if (id === 'overview') continue;
        expect(landmarkFocus(world, id).zoom, `${world.seed} ${id}`).toBeGreaterThan(1);
      }
      const interior = landmarkFocus(world, 'house-interior');
      expect(interior.point).toEqual(world.views['house-interior'].target);
      expect(interior.zoom).toBeGreaterThan(landmarkFocus(world, 'house').zoom);
    }
  });
});
