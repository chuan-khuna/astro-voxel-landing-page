/**
 * Pure camera math for the fixed true-isometric orthographic camera: no
 * three.js, no DOM, so it is tested directly.
 *
 * The camera state is a ground point (the target the camera looks at, on the
 * World's ground plane) and a zoom factor (1 frames the Overview). Screen
 * offsets are in **frame units**: world units across the screen at zoom 1,
 * x to the right and y up, measured from the screen centre.
 */

export interface GroundPoint {
  x: number;
  z: number;
}

export interface CameraState {
  target: GroundPoint;
  zoom: number;
}

/** Where the target may go (the World's bounds) and how far the camera may zoom. */
export interface CameraLimits {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minZoom: number;
  maxZoom: number;
}

/**
 * Ground motion for one unit of screen motion. The camera looks along
 * −(1, 1, 1): screen right is (1, 0, −1)/√2 on the ground; screen up is the
 * camera's up vector slid along the view ray onto the ground, (−1, 0, −1)·√(3/2).
 */
const RIGHT: GroundPoint = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
const UP: GroundPoint = { x: -Math.sqrt(1.5), z: -Math.sqrt(1.5) };

/** The ground offset that a screen offset (frame units, y up) covers at zoom 1. */
export function screenToGround(dx: number, dy: number): GroundPoint {
  return { x: RIGHT.x * dx + UP.x * dy, z: RIGHT.z * dx + UP.z * dy };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keep the target inside the World's bounds and the zoom inside its limits. */
export function clampState(state: CameraState, limits: CameraLimits): CameraState {
  return {
    target: { x: clamp(state.target.x, limits.minX, limits.maxX), z: clamp(state.target.z, limits.minZ, limits.maxZ) },
    zoom: clamp(state.zoom, limits.minZoom, limits.maxZoom),
  };
}

/** Drag the World by a screen offset (frame units, y up): the ground under the pointer follows it. */
export function panBy(state: CameraState, dx: number, dy: number, limits: CameraLimits): CameraState {
  const move = screenToGround(dx, dy);
  return clampState(
    { target: { x: state.target.x - move.x / state.zoom, z: state.target.z - move.z / state.zoom }, zoom: state.zoom },
    limits,
  );
}

/**
 * Multiply the zoom by `factor`, keeping the ground point under `focus`
 * (frame units from the screen centre, y up) where it is, unless a bound stops it.
 */
export function zoomAt(state: CameraState, focus: { x: number; y: number }, factor: number, limits: CameraLimits): CameraState {
  const zoom = clamp(state.zoom * factor, limits.minZoom, limits.maxZoom);
  const toFocus = screenToGround(focus.x, focus.y);
  const shift = 1 / state.zoom - 1 / zoom;
  return clampState({ target: { x: state.target.x + toFocus.x * shift, z: state.target.z + toFocus.z * shift }, zoom }, limits);
}


/** A point in the World: x east, y up, z south. */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * The state that shows `point` at `at` (frame units from the screen centre,
 * y up) at `zoom`, clamped to the limits. A raised point is seen where the
 * view ray through it meets the ground, `y` back along the isometric axis.
 */
export function stateShowing(point: WorldPoint, zoom: number, at: { x: number; y: number }, limits: CameraLimits): CameraState {
  const z = clamp(zoom, limits.minZoom, limits.maxZoom);
  const offset = screenToGround(at.x, at.y);
  return clampState({ target: { x: point.x - point.y - offset.x / z, z: point.z - point.y - offset.z / z }, zoom: z }, limits);
}

/** Cubic ease in and out: slow at both ends, symmetric about the middle. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The camera `t` (0–1) of the way through a flight from `from` to `to`,
 * eased in and out. The target moves in a straight line; the zoom changes
 * on a log scale, so zooming in and out feel equally fast.
 */
export function flightState(from: CameraState, to: CameraState, t: number): CameraState {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const k = easeInOut(t);
  return {
    target: { x: from.target.x + (to.target.x - from.target.x) * k, z: from.target.z + (to.target.z - from.target.z) * k },
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * k),
  };
}
