/**
 * When the visitor has left the open House by moving the camera themselves:
 * pure, on camera states, so it is tested directly.
 *
 * The House is open while About or Team is (`lib/landmarkRoutes.ts`), and the
 * camera dives into its Interior. Once the camera has been inside the House
 * (`insideHouse`: well closer than the House's own close-up, the House on
 * screen), zooming back out past the House's own close-up (the whole House
 * and some ground round it in frame), or panning until the House is off
 * screen, leaves it (`outOfHouse`): the page then closes the section, as its
 * close button does, and the lid comes down. The zooms between the two are
 * the margin that keeps a camera still diving in (or wavering about the
 * line) from closing it.
 */
import { screenOffsetOf, type CameraState } from './cameraMath';
import type { LandmarkFocus } from './landmarkFocus';

/** Inside the House is this much closer than its own close-up (the Interior's close-up is over twice as close). */
export const INSIDE_ZOOM = 1.25;

/** Half the frame, in frame units at zoom 1 (the camera's right and top). */
export interface HalfFrame {
  x: number;
  y: number;
}

const onScreen = (state: CameraState, house: LandmarkFocus, half: HalfFrame) => {
  const seen = screenOffsetOf(state, house.point);
  return Math.abs(seen.x) <= half.x && Math.abs(seen.y) <= half.y;
};

/**
 * Whether the camera at `state` is inside the House: at least `INSIDE_ZOOM`
 * times its own close-up (`house`, `landmarkFocus(world, 'house')`) with
 * the House's middle on screen. Only then can the visitor leave it.
 */
export function insideHouse(state: CameraState, house: LandmarkFocus, half: HalfFrame): boolean {
  return state.zoom >= house.zoom * INSIDE_ZOOM && onScreen(state, house, half);
}

/**
 * Whether the camera at `state` has left the House: zoomed further back than
 * the House's own close-up, or the House's middle off screen.
 */
export function outOfHouse(state: CameraState, house: LandmarkFocus, half: HalfFrame): boolean {
  return state.zoom < house.zoom || !onScreen(state, house, half);
}
