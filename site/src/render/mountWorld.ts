/**
 * The scene runtime: renderer, camera, lights and the render-on-demand loop.
 * The World's meshes come from `worldMeshes.ts` (mesher + soft-voxel material).
 *
 * - `WebGPURenderer` with the automatic WebGL 2 fallback.
 * - One directional light (the sun) whose shadow map renders only when the
 *   World changes, plus a hemisphere sky light.
 * - Frames render only on request (mount, resize, a new World, a camera move);
 *   nothing renders while idle. Each frame bumps `canvas.dataset.frames` and
 *   writes `canvas.dataset.camera` (target x, z and zoom), for checks.
 * - The camera rig (`cameraRig.ts`) pans and zooms within the World's bounds;
 *   Landmark hotspots (`landmarkHotspots.ts`) and Data Cards (`dataCards.ts`)
 *   follow the camera.
 * - `setViewCentre(at)` says where the visitor looks (beside a panel), for
 *   choosing the Data Card.
 * - `focus(landmark)` flies (or cuts) the camera to a Landmark
 *   (`landmarkFocus.ts`), optionally off centre to leave room for a panel.
 * - `show(world)` swaps in another World (a new Seed) and disposes the old one.
 * - DPR is capped at 1.5 on touch devices and 2 elsewhere.
 */
import * as THREE from 'three/webgpu';
import type { LandmarkId, World } from '../world';
import { FIXED_COLOURS, LOOK, oklchToLinear, type FixedColour } from './palette';
import { createCameraRig, type CameraRig } from './cameraRig';
import { createLandmarkHotspots } from './landmarkHotspots';
import { createDataCards } from './dataCards';
import { landmarkFocus } from './landmarkFocus';
import { stateShowing, type CameraState } from './cameraMath';
import { buildWorldObjects, type WorldObjects } from './worldMeshes';
import type { MeshedWorld } from './worldVoxels';

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

export interface WorldView {
  /**
   * Swap in another World: disposes the old World's geometry and materials,
   * re-frames the camera, re-aims the sun and renders its shadow map once.
   * Pass `meshed` when the World was meshed in the Web Worker.
   */
  show(world: World, meshed?: MeshedWorld): void;
  /** The camera rig: its state, cuts and flights to other states. */
  readonly camera: CameraRig;
  /** The camera state that shows a Landmark of the World on show; see `focus`. */
  focusState(id: LandmarkId, at?: ScreenOffset): CameraState;
  /**
   * Fly the camera to a Landmark over `ms` (0 cuts). `at` is where on the
   * frame the Landmark should end up, in CSS px from the frame's centre
   * (y down): the middle of the part a panel leaves free. Resolves on landing.
   */
  focus(id: LandmarkId, options: { at?: ScreenOffset; ms: number }): Promise<void>;
  /**
   * Where the visitor looks, in CSS px from the frame's centre (y down): the
   * middle of the part a section panel leaves free, or 0 with no panel. The
   * Data Card shown is the one of the near Landmark seen closest to it.
   */
  setViewCentre(at: ScreenOffset): void;
  dispose(): void;
}

/** CSS px from the centre of the World's frame, x right and y down. */
export interface ScreenOffset {
  x: number;
  y: number;
}

export interface WorldFrame {
  /** The element round the canvas that takes pan and zoom input and holds the hotspots. */
  frame: HTMLElement;
  /** Hotspot links over the canvas, each with `data-hotspot="<placed landmark id>"`. */
  hotspots: HTMLElement[];
  /** Data Cards over the canvas, each with `data-card="<placed landmark id>"`. */
  cards?: HTMLElement[];
}

/** Closest zoom: about this many world units from the centre to the edge of the frame. */
const CLOSEST_HALF_HEIGHT = 3;

export async function mountWorld(
  canvas: HTMLCanvasElement,
  world: World,
  meshed?: MeshedWorld,
  ui: WorldFrame = { frame: canvas.parentElement ?? canvas, hotspots: [] },
): Promise<WorldView> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio());
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = fixedColour('sky');

  scene.add(new THREE.HemisphereLight(fixedColour('skyLight'), fixedColour('groundLight'), LOOK.skyIntensity));
  const sun = new THREE.DirectionalLight(fixedColour('sunLight'), LOOK.sunIntensity);
  scene.add(sun, sun.target);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  /** Overview radius of the World on show; the camera frames it. */
  let radius = 1;

  /**
   * `render()` starts three's internal animation loop, which then ticks
   * `requestAnimationFrame` forever (it only advances node time; nothing here
   * animates by node time). Stop it after each frame so an idle World
   * schedules no frames at all; the next `render()` starts it again.
   * `_animation` is internal, so this is guarded.
   */
  const idleRenderer = () => (renderer as unknown as { _animation?: { stop?: () => void } })._animation?.stop?.();

  // Render on demand: a request schedules at most one frame.
  let frame = 0;
  let frames = 0;
  const requestRender = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      // The overlays project through the camera's matrices: bring them up to date first.
      camera.updateMatrixWorld();
      hotspots.place(camera);
      cards.place(camera, rig.state, viewCentre);
      renderer.render(scene, camera);
      idleRenderer();
      canvas.dataset.frames = String(++frames);
      const { target, zoom } = rig.state;
      canvas.dataset.camera = `${target.x.toFixed(2)} ${target.z.toFixed(2)} ${zoom.toFixed(3)}`;
    });
  };
  const rig = createCameraRig({ element: ui.frame, camera, onChange: requestRender });
  const hotspots = createLandmarkHotspots(ui.frame, ui.hotspots, (target) => rig.jumpTo({ target, zoom: rig.state.zoom }));
  const cards = createDataCards(ui.frame, ui.cards ?? []);
  let viewCentre: ScreenOffset = { x: 0, y: 0 };

  const frameCamera = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const aspect = w / h;
    // A square of half-size r spans r·√2 each side horizontally in isometric view.
    const halfHeight = Math.max(radius * 0.9, (radius * Math.SQRT2) / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    frameCamera();
    requestRender();
  };

  let objects: WorldObjects | null = null;
  let current = world;
  const show = (next: World, nextMeshed?: MeshedWorld) => {
    current = next;
    // Free the old World's GPU buffers and materials before building the new one.
    if (objects) {
      scene.remove(objects.group);
      objects.dispose();
    }
    objects = buildWorldObjects(next, nextMeshed);
    scene.add(objects.group);

    const { width, depth } = next.terrain;
    const centre = new THREE.Vector3(width / 2, 0, depth / 2);
    placeSun(sun, centre, Math.hypot(width, depth) / 2 + 2);

    // Pan bounds are the union of the Isles' footprints; zoom runs from the Overview in to a close-up.
    const { target } = next.views.overview;
    radius = next.views.overview.radius;
    frameCamera();
    hotspots.setWorld(next);
    cards.setWorld(next);
    rig.reset(
      {
        minX: Math.min(...next.isles.map((i) => i.bounds.minX)),
        maxX: Math.max(...next.isles.map((i) => i.bounds.maxX)) + 1,
        minZ: Math.min(...next.isles.map((i) => i.bounds.minZ)),
        maxZ: Math.max(...next.isles.map((i) => i.bounds.maxZ)) + 1,
        minZoom: 1,
        maxZoom: Math.max(2, radius / CLOSEST_HALF_HEIGHT),
      },
      { target: { x: target.x, z: target.z }, zoom: 1 },
      radius * 4,
    );

    canvas.dataset.seed = next.seed;
    canvas.dataset.triangles = String(objects.triangles);
    requestRender();
  };

  show(world, meshed);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  canvas.dataset.backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';

  const focusState = (id: LandmarkId, at: ScreenOffset = { x: 0, y: 0 }) => {
    const { point, zoom } = landmarkFocus(current, id);
    // CSS px to frame units (world units at zoom 1), y up.
    const k = (camera.top - camera.bottom) / Math.max(1, ui.frame.clientHeight);
    return stateShowing(point, zoom, { x: at.x * k, y: -at.y * k }, rig.limits);
  };

  return {
    show,
    camera: rig,
    focusState,
    focus: (id, { at, ms }) => rig.flyTo(focusState(id, at), ms),
    setViewCentre: (at) => {
      viewCentre = at;
      requestRender();
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      rig.dispose();
      hotspots.dispose();
      observer.disconnect();
      objects?.dispose();
      renderer.dispose();
    },
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
