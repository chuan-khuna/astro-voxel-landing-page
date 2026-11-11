import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clampState, flightState, panBy, screenOffsetOf, stateShowing, zoomAt, type CameraLimits, type CameraState } from './cameraMath';

const limits: CameraLimits = { minX: 0, maxX: 40, minZ: 0, maxZ: 30, minZoom: 1, maxZoom: 6 };
const start: CameraState = { target: { x: 20, z: 15 }, zoom: 2 };
const HALF = 10; // frame half-size at zoom 1

/** A real three.js isometric camera for a state, framed like the site's. */
function cameraFor(state: CameraState): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 1000);
  const target = new THREE.Vector3(state.target.x, 0, state.target.z);
  camera.position.copy(target).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), 100);
  camera.lookAt(target);
  camera.zoom = state.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

/** A ground point on screen, in frame units from the centre (y up). */
function onScreen(state: CameraState, x: number, z: number) {
  const p = new THREE.Vector3(x, 0, z).project(cameraFor(state));
  return { x: p.x * HALF, y: p.y * HALF };
}

describe('panBy', () => {
  it('moves the ground under the pointer by exactly the drag', () => {
    const before = onScreen(start, 22, 14);
    const after = onScreen(panBy(start, 1.5, -0.75, limits), 22, 14);
    expect(after.x - before.x).toBeCloseTo(1.5, 6);
    expect(after.y - before.y).toBeCloseTo(-0.75, 6);
  });

  it('stops the target at the World bounds', () => {
    const far = panBy(start, -1000, 1000, limits);
    expect(far.target.x).toBeGreaterThanOrEqual(limits.minX);
    expect(far.target.x).toBeLessThanOrEqual(limits.maxX);
    expect(far.target.z).toBeGreaterThanOrEqual(limits.minZ);
    expect(far.target.z).toBeLessThanOrEqual(limits.maxZ);
  });
});

describe('zoomAt', () => {
  it('keeps the ground point under the focus in place', () => {
    const focus = { x: 3, y: -2 };
    // The ground point under the focus before zooming.
    const camera = cameraFor(start);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(focus.x / HALF, focus.y / HALF), camera);
    const ground = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ground);

    const zoomed = zoomAt(start, focus, 1.5, limits);
    expect(zoomed.zoom).toBeCloseTo(3);
    const after = onScreen(zoomed, ground.x, ground.z);
    expect(after.x).toBeCloseTo(focus.x, 6);
    expect(after.y).toBeCloseTo(focus.y, 6);
  });

  it('clamps the zoom to its limits', () => {
    expect(zoomAt(start, { x: 0, y: 0 }, 100, limits).zoom).toBe(limits.maxZoom);
    expect(zoomAt(start, { x: 0, y: 0 }, 0.01, limits).zoom).toBe(limits.minZoom);
  });
});

describe('clampState', () => {
  it('leaves a state inside the limits unchanged', () => {
    expect(clampState(start, limits)).toEqual(start);
  });
});

/** A 3D point on screen, in frame units from the centre (y up). */
function pointOnScreen(state: CameraState, x: number, y: number, z: number) {
  const p = new THREE.Vector3(x, y, z).project(cameraFor(state));
  return { x: p.x * HALF, y: p.y * HALF };
}

describe('stateShowing', () => {
  it('puts a raised point at the screen centre', () => {
    const state = stateShowing({ x: 18, y: 3, z: 12 }, 2.5, { x: 0, y: 0 }, limits);
    expect(state.zoom).toBe(2.5);
    const seen = pointOnScreen(state, 18, 3, 12);
    expect(seen.x).toBeCloseTo(0, 6);
    expect(seen.y).toBeCloseTo(0, 6);
  });

  it('puts the point at a given screen offset, e.g. the middle of the part a panel leaves free', () => {
    const at = { x: -2.5, y: 1 };
    const state = stateShowing({ x: 22, y: 2, z: 16 }, 3, at, limits);
    const seen = pointOnScreen(state, 22, 2, 16);
    expect(seen.x).toBeCloseTo(at.x, 6);
    expect(seen.y).toBeCloseTo(at.y, 6);
  });

  it('stays inside the limits', () => {
    const state = stateShowing({ x: 100, y: 0, z: -50 }, 50, { x: 0, y: 0 }, limits);
    expect(state).toEqual(clampState(state, limits));
    expect(state.zoom).toBe(limits.maxZoom);
  });
});

describe('flightState', () => {
  const from: CameraState = { target: { x: 4, z: 6 }, zoom: 1 };
  const to: CameraState = { target: { x: 24, z: 2 }, zoom: 4 };

  it('starts where the camera was and ends at the destination', () => {
    expect(flightState(from, to, 0)).toEqual(from);
    expect(flightState(from, to, 1)).toEqual(to);
  });

  it('is halfway at half time, with the zoom halfway on a log scale', () => {
    const mid = flightState(from, to, 0.5);
    expect(mid.target.x).toBeCloseTo(14, 6);
    expect(mid.target.z).toBeCloseTo(4, 6);
    expect(mid.zoom).toBeCloseTo(2, 6);
  });

  it('eases in and out: slow at both ends, never overshooting', () => {
    let last = from.target.x;
    for (let i = 1; i <= 20; i++) {
      const x = flightState(from, to, i / 20).target.x;
      expect(x).toBeGreaterThanOrEqual(last);
      expect(x).toBeLessThanOrEqual(to.target.x);
      last = x;
    }
    const firstStep = flightState(from, to, 0.05).target.x - from.target.x;
    const middleStep = flightState(from, to, 0.525).target.x - flightState(from, to, 0.475).target.x;
    expect(firstStep).toBeLessThan(middleStep / 4);
  });
});

describe('screenOffsetOf', () => {
  it('is where a World point is seen, in frame units from the screen centre (y up), the offset stateShowing takes', () => {
    const state: CameraState = { target: { x: 17, z: 13 }, zoom: 2.5 };
    for (const p of [
      { x: 20, y: 0, z: 9 },
      { x: 14, y: 3, z: 16 },
      { x: 17, y: 1.5, z: 13 },
    ]) {
      const seen = pointOnScreen(state, p.x, p.y, p.z);
      const offset = screenOffsetOf(state, p);
      expect(offset.x).toBeCloseTo(seen.x, 6);
      expect(offset.y).toBeCloseTo(seen.y, 6);
    }
  });
});
