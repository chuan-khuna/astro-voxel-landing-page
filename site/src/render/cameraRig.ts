/**
 * The camera rig: owns the isometric camera's state (a ground target and a
 * zoom) and turns pointer and wheel input into pan and zoom, clamped to the
 * World's bounds. The isometric angle never changes: there is no rotation.
 *
 * - Mouse: drag pans; the wheel (or a trackpad pinch, sent as ctrl+wheel) zooms toward the cursor.
 * - Touch: one finger pans; two fingers pan and pinch-zoom about their midpoint.
 * - Every change calls `onChange` once; the caller renders on demand. Nothing
 *   runs between input events, so an idle World renders no frames.
 *
 * - `flyTo` tweens the camera to a state (`flightState`, one `jumpTo` per
 *   animation frame); any pan or zoom input stops a flight where it is. A
 *   cut is one `jumpTo`.
 */
import * as THREE from 'three/webgpu';
import { clampState, flightState, panBy, zoomAt, type CameraLimits, type CameraState } from './cameraMath';

/** Direction from the target to the camera: true isometric (azimuth 45°, elevation ≈35.26°). */
export const ISO_DIRECTION = new THREE.Vector3(1, 1, 1).normalize();

/** A pointer must move this far (CSS px) before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

export interface CameraRig {
  readonly state: CameraState;
  /** New bounds and zoom limits (a new World) and a cut to `state`. */
  reset(limits: CameraLimits, state: CameraState, distance: number): void;
  /** The limits the state is clamped to (the World's bounds and zoom range). */
  readonly limits: CameraLimits;
  /**
   * Where the visitor looks (`CameraLimits.at`, frame units from the centre,
   * y up): from now on the bounds hold the ground seen there. Kept across
   * `reset`. Does not move the camera.
   */
  lookAt(at: { x: number; y: number }): void;
  /** Cut to a state, clamped to the limits. Stops a flight. */
  jumpTo(state: CameraState): void;
  /** Fly to a state over `ms` milliseconds (a cut when `ms` is 0). Resolves when it lands or is stopped. */
  flyTo(state: CameraState, ms: number): Promise<void>;
  dispose(): void;
}

interface Options {
  /** The element that takes the input: the World's frame, which also holds the Landmark hotspots. */
  element: HTMLElement;
  camera: THREE.OrthographicCamera;
  /** Called after every camera change; it should request one frame. */
  onChange: () => void;
}

export function createCameraRig({ element, camera, onChange }: Options): CameraRig {
  let limits: CameraLimits = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, minZoom: 1, maxZoom: 1 };
  let state: CameraState = { target: { x: 0, z: 0 }, zoom: 1 };
  let distance = 100;

  /** The flight in progress: its animation frame and how to end it. */
  let flight: { frame: number; done: () => void } | null = null;
  const stopFlight = () => {
    if (!flight) return;
    cancelAnimationFrame(flight.frame);
    flight.done();
    flight = null;
  };

  const flyTo = (to: CameraState, ms: number): Promise<void> => {
    stopFlight();
    const from = state;
    const end = clampState(to, limits);
    if (ms <= 0) {
      apply(end);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / ms);
        apply(flightState(from, end, t));
        if (t < 1 && flight) flight.frame = requestAnimationFrame(step);
        else stopFlight();
      };
      flight = { frame: requestAnimationFrame(step), done: resolve };
    });
  };

  const apply = (next: CameraState) => {
    state = clampState(next, limits);
    const target = new THREE.Vector3(state.target.x, 0, state.target.z);
    camera.position.copy(target).addScaledVector(ISO_DIRECTION, distance);
    camera.lookAt(target);
    camera.zoom = state.zoom;
    camera.updateProjectionMatrix();
    onChange();
  };

  /** Frame units (world units at zoom 1) per CSS pixel. */
  const unitsPerPixel = () => (camera.top - camera.bottom) / Math.max(1, element.clientHeight);

  /** A client position as frame units from the element's centre, y up. */
  const toFrame = (clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const k = unitsPerPixel();
    return { x: (clientX - rect.left - rect.width / 2) * k, y: -(clientY - rect.top - rect.height / 2) * k };
  };

  // Active pointers by id, in client px.
  const pointers = new Map<number, { x: number; y: number }>();
  let pressStart: { x: number; y: number } | null = null;
  let dragging = false;
  /** Set after a drag so the click that ends it does not follow a Landmark link. */
  let swallowClick = false;

  const centroid = () => {
    let x = 0;
    let y = 0;
    for (const p of pointers.values()) {
      x += p.x;
      y += p.y;
    }
    return { x: x / pointers.size, y: y / pointers.size };
  };
  const spread = (c: { x: number; y: number }) => {
    let sum = 0;
    for (const p of pointers.values()) sum += Math.hypot(p.x - c.x, p.y - c.y);
    return sum / pointers.size;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopFlight();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      pressStart = { x: event.clientX, y: event.clientY };
      dragging = false;
      swallowClick = false;
    } else {
      // A second finger always means a gesture, never a click.
      startDrag();
    }
  };

  const startDrag = () => {
    if (!dragging) {
      dragging = true;
      element.dataset.dragging = '';
    }
    for (const id of pointers.keys()) {
      if (!element.hasPointerCapture(id)) {
        try {
          element.setPointerCapture(id);
        } catch {
          // The pointer may already be gone; its pointerup will clean up.
        }
      }
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    if (!dragging) {
      if (!pressStart || Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) < DRAG_THRESHOLD) return;
      startDrag();
    }
    const before = centroid();
    const spreadBefore = spread(before);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = centroid();
    const k = unitsPerPixel();
    let next = panBy(state, (after.x - before.x) * k, -(after.y - before.y) * k, limits);
    if (pointers.size > 1 && spreadBefore > 0) {
      next = zoomAt(next, toFrame(after.x, after.y), spread(after) / spreadBefore, limits);
    }
    apply(next);
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size > 0) return;
    if (dragging) {
      swallowClick = true;
      dragging = false;
      delete element.dataset.dragging;
    }
    pressStart = null;
  };

  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    stopFlight();
    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
    // A trackpad pinch arrives as ctrl+wheel with small deltas: zoom faster per unit.
    const rate = event.ctrlKey ? 0.01 : 0.0015;
    const factor = Math.exp(-event.deltaY * lines * rate);
    apply(zoomAt(state, toFrame(event.clientX, event.clientY), factor, limits));
  };

  // Native link and image drags would steal a drag that starts on a Landmark hotspot.
  const onDragStart = (event: DragEvent) => event.preventDefault();

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerEnd);
  element.addEventListener('pointercancel', onPointerEnd);
  element.addEventListener('click', onClick, true);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('dragstart', onDragStart);

  return {
    get state() {
      return state;
    },
    get limits() {
      return limits;
    },
    lookAt(at) {
      limits = { ...limits, at };
    },
    reset(nextLimits, nextState, nextDistance) {
      stopFlight();
      limits = { at: limits.at, ...nextLimits };
      distance = nextDistance;
      apply(nextState);
    },
    jumpTo(next) {
      stopFlight();
      apply(next);
    },
    flyTo,
    dispose() {
      stopFlight();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerEnd);
      element.removeEventListener('pointercancel', onPointerEnd);
      element.removeEventListener('click', onClick, true);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('dragstart', onDragStart);
    },
  };
}
