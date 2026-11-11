/**
 * The scene runtime: renderer, camera, lights and the render-on-demand loop.
 * The World's meshes come from `worldMeshes.ts` (mesher + soft-voxel material).
 *
 * - `WebGPURenderer` with the automatic WebGL 2 fallback.
 * - One directional light (the sun) whose shadow map renders only when the
 *   World changes, plus a hemisphere sky light.
 * - Frames render only on request (mount, resize); nothing renders while idle.
 * - DPR is capped at 1.5 on touch devices and 2 elsewhere.
 */
import * as THREE from 'three/webgpu';
import type { World } from '../world';
import { FIXED_COLOURS, LOOK, oklchToLinear, type FixedColour } from './palette';
import { buildWorldObjects } from './worldMeshes';

/** Direction from the target to the camera: true isometric (azimuth 45°, elevation ≈35.26°). */
const ISO_DIRECTION = new THREE.Vector3(1, 1, 1).normalize();
const SHADOW_MAP_SIZE = 2048;

const fixedColour = (name: FixedColour) => {
  const [r, g, b] = oklchToLinear(FIXED_COLOURS[name]);
  return new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
};

/** Device-pixel-ratio cap: 1.5 on phones and tablets (coarse pointer), 2 on desktop. */
function pixelRatio(): number {
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  return Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
}

export async function mountWorld(canvas: HTMLCanvasElement, world: World): Promise<() => void> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio());
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = fixedColour('sky');

  const objects = buildWorldObjects(world);
  scene.add(objects.group);

  const { width, depth } = world.terrain;
  const centre = new THREE.Vector3(width / 2, 0, depth / 2);

  scene.add(new THREE.HemisphereLight(fixedColour('skyLight'), fixedColour('groundLight'), LOOK.skyIntensity));
  const sun = new THREE.DirectionalLight(fixedColour('sunLight'), LOOK.sunIntensity);
  placeSun(sun, centre, Math.hypot(width, depth) / 2 + 2);
  scene.add(sun, sun.target);

  const { target, radius } = world.views.overview;
  const lookAt = new THREE.Vector3(target.x, target.y, target.z);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.copy(lookAt).addScaledVector(ISO_DIRECTION, radius * 4);
  camera.lookAt(lookAt);

  // Render on demand: a request schedules at most one frame.
  let frame = 0;
  const requestRender = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    const aspect = w / h;
    // A square of half-size r spans r·√2 each side horizontally in isometric view.
    const halfHeight = Math.max(radius * 0.9, (radius * Math.SQRT2) / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  canvas.dataset.triangles = String(objects.triangles);
  canvas.dataset.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    objects.dispose();
    renderer.dispose();
  };
}

/**
 * Put the sun at the approved azimuth and elevation, aim its shadow camera at
 * the whole World, and render its shadow map once. Call again (or set
 * `sun.shadow.needsUpdate`) whenever the World changes.
 */
function placeSun(sun: THREE.DirectionalLight, centre: THREE.Vector3, reach: number): void {
  const az = THREE.MathUtils.degToRad(LOOK.sunAzimuth);
  const el = THREE.MathUtils.degToRad(LOOK.sunElevation);
  const direction = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  sun.position.copy(centre).addScaledVector(direction, reach * 2);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: reach * 4 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  // Static shadow map: rendered on the next frame, then only when asked again.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
}
