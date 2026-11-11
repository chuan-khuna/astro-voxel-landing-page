import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clampState, panBy, zoomAt, type CameraLimits, type CameraState } from './cameraMath';

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
