/**
 * Which Landmark a route belongs to, from the Landmark list in the site data
 * module. Plain functions over paths; no DOM.
 */
import { site, type Landmark } from '../data/site';
import type { LandmarkId } from '../world';

/** `/about/`, `/about/index.html` and `/about` are the same route. */
function normalise(pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/**
 * The Landmark whose route is `pathname`, or whose route it sits under
 * (`/garden/<slug>` belongs to the Garden). `null` for any other route.
 */
export function landmarkForPath(pathname: string, landmarks: readonly Landmark[] = site.landmarks): LandmarkId | null {
  const path = normalise(pathname);
  let best: Landmark | null = null;
  for (const landmark of landmarks) {
    const route = normalise(landmark.route);
    const matches = path === route || (route !== '/' && path.startsWith(`${route}/`));
    if (matches && (!best || route.length > normalise(best.route).length)) best = landmark;
  }
  return best?.id ?? null;
}

/** What the World shows for a route's Landmark. */
export interface RouteView {
  /** The Landmark the camera goes to. */
  focus: LandmarkId;
  /** Whether the House is open: its roof lifted and its room in view. */
  interior: boolean;
}

/**
 * About and Team both open the House: the roof lifts and the camera dives
 * into the room, with the panel beside it. Every other route keeps the House
 * shut and sends the camera to its own Landmark.
 */
export function routeView(id: LandmarkId): RouteView {
  const interior = id === 'house' || id === 'house-interior';
  return { focus: interior ? 'house-interior' : id, interior };
}
