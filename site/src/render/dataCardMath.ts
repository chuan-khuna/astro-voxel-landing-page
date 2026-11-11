/**
 * Pure Data Card math, no three.js or DOM, so it is tested directly: which
 * Data Card shows, and the CSS `matrix3d` that lays it on the isometric plane.
 */
import { screenOffsetOf, type CameraState } from './cameraMath';
import type { LandmarkFocus } from './landmarkFocus';
import type { PlacedLandmark, World } from '@/world';
import { landmarkExtent } from './landmarkModels';

/** A card shows from this fraction of its Landmark's close-up zoom inwards. */
const NEAR_ZOOM = 0.7;
/** ...while its Landmark is within this fraction of the frame's half size from where the visitor looks. */
const NEAR_FRAME = 0.6;

/**
 * The one Landmark whose Data Card shows, or `null`: of the Landmarks the
 * camera is near, the one seen nearest `centre`. Near means closer in than
 * the Overview and nearly as close as the Landmark's own close-up (`focus`,
 * from `landmarkFocus`), with the Landmark within the middle part of the
 * frame round `centre`.
 *
 * - `half`: the frame's half width and height at zoom 1, in frame units.
 * - `centre`: where the visitor looks, in frame units from the frame's
 *   centre (y up): the middle of the part a section panel leaves free, or 0.
 *
 * One card at a time, so neighbouring Landmarks' cards never pile up.
 */
export function nearestDataCard<Id extends string>(
  state: CameraState,
  cards: ReadonlyArray<{ id: Id; focus: LandmarkFocus }>,
  half: { x: number; y: number },
  centre: { x: number; y: number },
): Id | null {
  if (state.zoom <= 1) return null;
  let best: Id | null = null;
  let bestDistance = Infinity;
  for (const { id, focus } of cards) {
    if (state.zoom < NEAR_ZOOM * focus.zoom) continue;
    const seen = screenOffsetOf(state, focus.point);
    const dx = (seen.x - centre.x) / half.x;
    const dy = (seen.y - centre.y) / half.y;
    if (Math.abs(dx) > NEAR_FRAME || Math.abs(dy) > NEAR_FRAME) continue;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** A 4×4 matrix, column-major (three's `Matrix4.elements` and CSS `matrix3d` order). */
type Mat4 = ArrayLike<number>;

function multiply(a: Mat4, b: Mat4): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[col * 4 + k]!;
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** The card's text runs along the World's −z axis (rising to the right on screen), its sides along −y. */
const ALONG = { x: 0, y: 0, z: -1 };
const DOWN = { x: 0, y: -1, z: 0 };

/**
 * The CSS `matrix3d` (16 numbers, column-major) that lays a Data Card on the
 * isometric plane: upright in the World, its text along the World's −z axis,
 * so it is skewed exactly like the voxels round it. Apply it to an element at
 * the frame's top left with `transform-origin: 0 0`.
 *
 * - `viewProjection` is the camera's projection × view matrix; `frame` the
 *   frame's size in CSS px. The maths is general; the site's camera is orthographic.
 * - `anchor` holds the middle of the card's bottom edge (`pin` `bottom`: the
 *   card stands on it) or of its top edge (`top`: the card hangs from it).
 * - The card keeps its own CSS size on screen at any zoom (one card px is one
 *   screen px along each edge), so its text stays crisp and readable; only
 *   its tilt and position follow the camera.
 * - Depth is flattened, so the card is a plain overlay; z passes through so
 *   the matrix stays invertible.
 */
export function dataCardTransform(
  viewProjection: Mat4,
  frame: { width: number; height: number },
  anchor: { x: number; y: number; z: number },
  card: { width: number; height: number },
  pin: 'bottom' | 'top' = 'bottom',
): number[] {
  // Clip space to frame px (y down), with depth dropped.
  const toFrame = [frame.width / 2, 0, 0, 0, 0, -frame.height / 2, 0, 0, 0, 0, 0, 0, frame.width / 2, frame.height / 2, 0, 1];
  const toScreen = multiply(toFrame, viewProjection);
  const project = (p: { x: number; y: number; z: number }) => {
    const m = toScreen;
    const w = m[3]! * p.x + m[7]! * p.y + m[11]! * p.z + m[15]!;
    return { x: (m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!) / w, y: (m[1]! * p.x + m[5]! * p.y + m[9]! * p.z + m[13]!) / w };
  };
  // World units per card px: one World unit along the card's baseline is this many screen px.
  const a = project(anchor);
  const b = project({ x: anchor.x + ALONG.x, y: anchor.y + ALONG.y, z: anchor.z + ALONG.z });
  const s = 1 / Math.hypot(b.x - a.x, b.y - a.y);
  // Card px (u, v) to World: the card's top-left corner, then along and down.
  const ox = -card.width / 2;
  const oy = pin === 'bottom' ? -card.height : 0;
  const origin = {
    x: anchor.x + (ALONG.x * ox + DOWN.x * oy) * s,
    y: anchor.y + (ALONG.y * ox + DOWN.y * oy) * s,
    z: anchor.z + (ALONG.z * ox + DOWN.z * oy) * s,
  };
  const toWorld = [ALONG.x * s, ALONG.y * s, ALONG.z * s, 0, DOWN.x * s, DOWN.y * s, DOWN.z * s, 0, 0, 0, 0, 0, origin.x, origin.y, origin.z, 1];
  const m = multiply(toScreen, toWorld);
  // Flat on the screen: no depth from u or v, and z passes through (CSS draws nothing under a
  // non-invertible transform).
  m[2] = 0;
  m[6] = 0;
  m[10] = 1;
  m[14] = 0;
  return m;
}

/** Screen gap between a Landmark and its Data Card, in World units of height. */
const CARD_GAP = 0.4;

export interface DataCardAnchors {
  /** Where the card stands, over the model. */
  above: { x: number; y: number; z: number };
  /** Where it hangs instead, under the model, when there is no room above. */
  below: { x: number; y: number; z: number };
}

/**
 * Where a Landmark's Data Card goes: over the middle of its footprint, just
 * above the highest point of its model on screen (the back of the model sits
 * higher on screen than the middle), or just below the lowest. On the
 * isometric screen a point's height goes with `2y − x − z`, which is how the
 * heights are found from the model's box (`landmarkExtent`).
 */
export function dataCardAnchors(world: Pick<World, 'biome' | 'landmarks'>, landmark: PlacedLandmark): DataCardAnchors {
  const { origin, width, depth } = landmark.footprint;
  const { min, max } = landmarkExtent(world, landmark);
  const cx = origin.x + width / 2;
  const cz = origin.z + depth / 2;
  // The box's highest corner on screen is its top back one; its lowest, the bottom front one.
  const highest = 2 * (landmark.y + max.y) - (origin.x + min.x) - (origin.z + min.z);
  const lowest = 2 * (landmark.y + min.y) - (origin.x + max.x) - (origin.z + max.z);
  return {
    above: { x: cx, y: (highest + cx + cz) / 2 + CARD_GAP, z: cz },
    below: { x: cx, y: (lowest + cx + cz) / 2 - CARD_GAP, z: cz },
  };
}

/**
 * The `matrix3d` for a Data Card: standing over its Landmark, or hanging
 * under it when the top of the frame would cut off a standing card.
 */
export function placeDataCard(
  viewProjection: Mat4,
  frame: { width: number; height: number },
  anchors: DataCardAnchors,
  card: { width: number; height: number },
): number[] {
  const standing = dataCardTransform(viewProjection, frame, anchors.above, card, 'bottom');
  // The card's highest corner is its top right: its text rises to the right.
  const top = (standing[1]! * card.width + standing[13]!) / (standing[3]! * card.width + standing[15]!);
  return top >= 0 ? standing : dataCardTransform(viewProjection, frame, anchors.below, card, 'top');
}
