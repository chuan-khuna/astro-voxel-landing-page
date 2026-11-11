/**
 * Where the camera looks for each Landmark, and how close: pure, on World
 * data, so it is tested directly. The Overview is the World's first framing
 * (zoom 1); a placed Landmark keeps its footprint plus some ground round it
 * in frame; House Interior uses the World's derived view of the House.
 */
import type { LandmarkId, World } from '../world';
import type { WorldPoint } from './cameraMath';

/** World units of ground kept in frame round a placed Landmark's footprint. */
const MARGIN = 5;

export interface LandmarkFocus {
  /** The point to look at. */
  point: WorldPoint;
  /** Camera zoom: 1 frames the Overview; larger is closer. */
  zoom: number;
}

export function landmarkFocus(world: World, id: LandmarkId): LandmarkFocus {
  const overview = world.views.overview;
  if (id === 'overview') return { point: overview.target, zoom: 1 };
  if (id === 'house-interior') {
    const view = world.views['house-interior'];
    return { point: view.target, zoom: overview.radius / view.radius };
  }
  const landmark = world.landmarks.find((l) => l.id === id);
  if (!landmark) throw new Error(`World ${world.seed} has no ${id}`);
  const { origin, width, depth } = landmark.footprint;
  const radius = Math.max(width, depth) / 2 + MARGIN;
  // The view radius is never wider than the Overview's, so a focus never zooms out.
  return {
    point: { x: origin.x + width / 2, y: landmark.y, z: origin.z + depth / 2 },
    zoom: Math.max(1, overview.radius / radius),
  };
}
