import { describe, expect, it } from 'vitest';
import { generateWorld, PLACED_LANDMARK_IDS } from '@/world';
import { cloudFade, cloudShadowDrift, cloudShadowStrength, cloudsShown } from './cloudMath';
import { landmarkFocus } from './landmarkFocus';

const counts = { projects: 8, clients: 5, partners: 3 };
const worlds = Array.from({ length: 40 }, (_, i) => generateWorld(`clouds-${i}`, counts));

describe('cloudMath', () => {
  it('shows clouds whole at the Overview and fades them as the camera zooms in', () => {
    for (const world of worlds) {
      expect(cloudFade(world, 1), world.seed).toBe(1);
      let before = 1;
      for (let zoom = 1; zoom < 6; zoom += 0.1) {
        const fade = cloudFade(world, zoom);
        expect(fade, world.seed).toBeLessThanOrEqual(before);
        expect(fade, world.seed).toBeGreaterThanOrEqual(0);
        before = fade;
      }
    }
  });

  it('has the clouds gone in every Landmark close-up, and in the phone Story Scroll framings a little further back', () => {
    for (const world of worlds) {
      for (const id of [...PLACED_LANDMARK_IDS, 'house-interior'] as const) {
        const { zoom } = landmarkFocus(world, id);
        expect(cloudFade(world, zoom), `${world.seed} ${id}`).toBe(0);
        expect(cloudFade(world, zoom * 0.8), `${world.seed} ${id} from further back`).toBe(0);
      }
    }
  });

  it('keeps them nearly whole a little way in from the Overview', () => {
    for (const world of worlds) expect(cloudFade(world, 1.05), world.seed).toBeGreaterThan(0.9);
  });

  it('shows the life tier\'s share of the clouds, at least one if there are any', () => {
    expect(cloudsShown(8, 'full')).toBe(8);
    expect(cloudsShown(8, 'reduced')).toBe(4);
    expect(cloudsShown(7, 'reduced')).toBe(4);
    expect(cloudsShown(8, 'still')).toBe(4);
    expect(cloudsShown(1, 'reduced')).toBe(1);
    expect(cloudsShown(0, 'full')).toBe(0);
  });

  it('drifts the shadows down the wind with the clock, and holds them where the clock is frozen', () => {
    const wind = { direction: { x: 0.6, z: 0.8 } };
    expect(cloudShadowDrift(wind, 0)).toEqual({ x: 0, z: 0 });
    const a = cloudShadowDrift(wind, 10);
    const b = cloudShadowDrift(wind, 20);
    // Down the wind, steadily.
    expect(a.x / Math.hypot(a.x, a.z)).toBeCloseTo(0.6, 9);
    expect(a.z / Math.hypot(a.x, a.z)).toBeCloseTo(0.8, 9);
    expect(b.x).toBeCloseTo(2 * a.x, 9);
    expect(Math.hypot(a.x, a.z)).toBeGreaterThan(1);
    expect(cloudShadowDrift(wind, 10)).toEqual(a);
  });

  it('casts shadows by Day and none at Night', () => {
    expect(cloudShadowStrength('day')).toBeGreaterThan(0.1);
    expect(cloudShadowStrength('day')).toBeLessThan(0.4);
    expect(cloudShadowStrength('night')).toBe(0);
  });
});
