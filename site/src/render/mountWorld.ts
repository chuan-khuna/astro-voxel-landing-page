/**
 * The scene runtime: renderer, camera, lights and the render loop.
 * The World's meshes come from `worldMeshes.ts` (mesher + soft-voxel material).
 *
 * - `WebGPURenderer` with the automatic WebGL 2 fallback.
 * - One directional light (the sun) whose shadow map renders only when the
 *   World changes, plus a hemisphere sky light.
 * - The render loop has two modes (ADR 0005, `ambientLife.ts`). While
 *   Ambient Life is alive (the tab shown, the canvas on screen, motion
 *   allowed and a tier that moves) the World renders continuously, at most
 *   30 fps on phones or at the reduced life tier, and the shared clock
 *   runs: the sea bobs, the plants sway, leaves fall, the boats and ships
 *   rock on the swell, the Partners' ships sail and the developer works
 *   in the House (`objects.step`), and the Guide idles. Every frame shows
 *   as many leaves as the life tier allows (`objects.setLife`). Otherwise it
 *   renders on demand: only on request (mount, resize, a new World, a
 *   camera move) and while a one-off motion plays (the House's lid lifting
 *   or lowering, the Guide assembling, dissolving or flying), and an idle
 *   World schedules no `requestAnimationFrame` at all. Each continuous
 *   frame's time feeds the life tier watch (`lib/lifeTier.ts`), which drops
 *   full to reduced to still on a slow device; `canvas.dataset.life` says
 *   which tier is on show. Each frame bumps `canvas.dataset.frames` and
 *   writes `canvas.dataset.clock` (the clock's seconds) and
 *   `canvas.dataset.camera` (target x, z and zoom) and
 *   `canvas.dataset.clouds` (how much of the clouds shows at that zoom,
 *   0–1: they fade out in a Landmark's close-up), for checks;
 *   `canvas.dataset.fish`, `.animals` and `.birds` say how many fish, land
 *   animals and birds (or bats) the life tier (and theme) shows;
 *   `canvas.dataset.outline` lists the models outlined (`outline.ts`).
 * - The camera rig (`cameraRig.ts`) pans and zooms within the World's bounds;
 *   Landmark hotspots (`landmarkHotspots.ts`) and Data Cards (`dataCards.ts`)
 *   follow the camera. The model of a hotspot (or of the Guide's button)
 *   that is hovered, focused from the keyboard or the page open is
 *   outlined (`outline.ts`, `outlineModels.ts`): the links are invisible.
 * - `setViewCentre(at)` says where the visitor looks (the middle of the part
 *   the floating cards leave free), for choosing the Data Card; the pan
 *   bounds hold the ground seen there (`CameraLimits.at`).
 * - `focus(landmark)` flies (or cuts) the camera to a Landmark
 *   (`landmarkFocus.ts`), optionally off centre to leave room for a panel.
 * - `setInterior(open, ms)` opens the House (its lid lifts, the developer's
 *   link appears) or shuts it. The House Interior is part of the World: its
 *   room and the developer (`house.ts`, 1/16 unit) show from the moment the
 *   lid starts to lift until it is down again, the same meshes all the way,
 *   and the camera dives in and out as for any other Landmark close-up.
 * - `show(world)` swaps in another World (a new Seed) and disposes the old one.
 * - The Guide (`guide.ts`) lives for the whole visit: it assembles at the
 *   Station's spot (`guideSpot`) when the World mounts and dissolves and
 *   re-forms there on every `show` (a cut under reduced motion or on a
 *   hidden page). Frames render while it assembles or dissolves, and while
 *   it idles (bobbing and blinking) while Ambient Life is alive. `guide.say(lines)` talks in its speech bubble; on the Tour
 *   `guide.flyTo(guideSpot(id), ms)` sends it ahead to each Landmark,
 *   rendering frames while it flies.
 * - `setTheme(theme)` switches Day and Night (`data/theme.ts`): the sky,
 *   the lights' colours and strengths, the water's colour, and at Night the
 *   House's windows and the buoys' lamps glow. Nothing moves, so the shadow
 *   map is kept; one frame is rendered.
 * - DPR is capped at 1.5 on touch devices and 2 elsewhere.
 * - The render tier (`lib/renderTier.ts`): phones get the reduced tier (no
 *   MSAA, a 1024 px shadow map, ambient motion at 30 fps, half the
 *   Decoration); camera moves always render every frame. A tier never
 *   removes a Landmark, plant, boat, ship or buoy.
 *   `ui.tierOverride` (`?tier=full|reduced`) picks one for measuring, and
 *   `ui.lifeOverride` (`?life=full|reduced|still`) pins a life tier;
 *   `canvas.dataset.tier` and `WorldView.tier` say which is on.
 * - `ui.onLeaveHouse` hears the visitor zoom back out of the open House, or
 *   pan it off screen, once the camera has been inside it (`houseLeave.ts`:
 *   the margin keeps a camera still diving in from leaving); the page
 *   closes the section.
 * - `ui.onExplore` hears the visitor pan, zoom or tab to a Landmark off
 *   screen: free exploration, which stops the Tour.
 * - `onFrame(listener)` hears about every frame that renders anyway (its
 *   time, triangles and draw calls), for the render stats overlay; it never
 *   asks for a frame. `backend` says WebGPU or WebGL 2.
 */
import * as THREE from 'three/webgpu';
import type { LandmarkId, PlacedLandmarkId, Vec3, World } from '@/world';
import { LOOK, oklchToLinear } from './palette';
import { THEME_TOKENS } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import type { Oklch } from '@/world';
import { createCameraRig, type CameraRig } from './cameraRig';
import { createLandmarkHotspots } from './landmarkHotspots';
import { createDataCards } from './dataCards';
import { landmarkFocus } from './landmarkFocus';
import { insideHouse, outOfHouse } from './houseLeave';
import { stateShowing, type CameraState } from './cameraMath';
import { buildWorldObjects, type LifeShown, type WorldObjects } from './worldMeshes';
import { openingStep } from './houseMotion';
import type { MeshedWorld } from './worldVoxels';
import type { Rect, ScreenOffset } from './freeArea';
import { createGuide, type GuideView } from './guide';
import { guideSpot } from './guideMotion';
import { ambientFrameDue, pixelRatio, renderTier, type Device, type RenderTierName } from '@/lib/renderTier';
import type { LifeTierName } from '@/lib/lifeTier';
import { createAmbientLife } from './ambientLife';
import { createOutline, watchOutlineLinks } from './outline';
import { createOutlineModels, type OutlineModels } from './outlineModels';

export type { ScreenOffset, GuideView };

const setColour = (target: THREE.Color, colour: Oklch) => {
  const [r, g, b] = oklchToLinear(colour);
  target.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
};

/** This device, for its render tier and pixel-ratio cap. */
function currentDevice(): Device {
  return {
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  };
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
  /**
   * The camera state that shows a Landmark of the World on show; see `focus`.
   * `zoomScale` scales its close-up's zoom (below 1 stands further back), within the zoom limits.
   */
  focusState(id: LandmarkId, at?: ScreenOffset, zoomScale?: number): CameraState;
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
  /**
   * Open the House (its lid lifts off over `ms` and the developer's link
   * shows) or shut it (the lid comes down). 0 cuts. Kept across `show`.
   */
  setInterior(open: boolean, ms: number): void;
  /**
   * Open the House part-way (0 shut, 1 open): the Story Scroll leads the lid
   * with the page. The lid moves there at the rate of a full lift over `ms`
   * (0 cuts). `setInterior(open, ms)` is `setOpening(open ? 1 : 0, ms)`.
   */
  setOpening(amount: number, ms: number): void;
  /**
   * Which Data Card may show: the one of the Landmark seen nearest where the
   * visitor looks (undefined, the default), only this Landmark's (if it is
   * near), or none (null). The Story Scroll shows only its section's.
   * `top` (CSS px from the frame's top, default 0) is where the free part
   * begins: a card that would stand above it hangs below its Landmark instead.
   */
  setDataCardFocus(id: PlacedLandmarkId | null | undefined, top?: number): void;
  /** Show the World by Day or by Night. Kept across `show`. */
  setTheme(theme: Theme): void;
  /**
   * The Guide: it assembles at the Station when the World mounts, and
   * dissolves and re-forms there on every `show`. `guide.formed` resolves
   * once it has; `guide.say(lines)` talks in its speech bubble.
   */
  readonly guide: GuideView;
  /** Where the Guide floats beside a placed Landmark of the World on show (`guideSpot`), for `guide.flyTo`. */
  guideSpot(id: PlacedLandmarkId): Vec3;
  /**
   * Hear about each frame after it renders (the render stats overlay).
   * Never causes a frame: only frames that render anyway are reported.
   * Returns a function that stops listening.
   */
  onFrame(listener: (frame: FrameInfo) => void): () => void;
  /** The renderer's backend: WebGPU, or the WebGL 2 fallback. */
  readonly backend: 'webgpu' | 'webgl2';
  /** The render tier on this device (`lib/renderTier.ts`). */
  readonly tier: RenderTierName;
  /** The Ambient Life tier on show (`lib/lifeTier.ts`): it may drop during the visit, and is still under reduced motion. */
  readonly lifeTier: LifeTierName;
  dispose(): void;
}

/** One rendered frame, as `onFrame` reports it. */
export interface FrameInfo {
  /** The frame's `requestAnimationFrame` time, ms. */
  now: number;
  /** Triangles and draw calls in this frame (the shadow map's pass included when it rendered). */
  triangles: number;
  drawCalls: number;
}


export interface WorldFrame {
  /** The element round the canvas that takes pan and zoom input and holds the hotspots. */
  frame: HTMLElement;
  /** Hotspot links over the canvas, each with `data-hotspot="<placed landmark id>"`. */
  hotspots: HTMLElement[];
  /** Data Cards over the canvas, each with `data-card="<placed landmark id>"`. */
  cards?: HTMLElement[];
  /** Day or Night from the first frame (default Day). */
  theme?: Theme;
  /** The Guide's button and speech bubble over the canvas, the cards its bubble keeps clear of and the Landmarks it keeps off (client px). */
  guide?: { button?: HTMLElement | null; bubble?: HTMLElement | null; covers?: () => Rect[]; landmarks?: () => Rect[] };
  /** The visitor explores on their own: pans or zooms the World, or tabs to a Landmark off screen (the Tour stops for it). */
  onExplore?: () => void;
  /**
   * The visitor zooms back out past the open House's own close-up, or pans
   * it off screen, after the camera has been inside it (`houseLeave.ts`):
   * they have left it. Heard once per visit inside, on that pan or zoom,
   * before `onExplore`; never for flights, cuts or the keyboard.
   */
  onLeaveHouse?: () => void;
  /** `?tier=full` or `?tier=reduced`: that render tier whatever the device (for measuring); anything else is ignored. */
  tierOverride?: string | null;
  /** `?life=full`, `?life=reduced` or `?life=still`: that Ambient Life tier, never dropped (for measuring); anything else is ignored. */
  lifeOverride?: string | null;
}

/** Closest zoom: about this many world units from the centre to the edge of the frame. */
const CLOSEST_HALF_HEIGHT = 3;

export async function mountWorld(
  canvas: HTMLCanvasElement,
  world: World,
  meshed?: MeshedWorld,
  ui: WorldFrame = { frame: canvas.parentElement ?? canvas, hotspots: [] },
): Promise<WorldView> {
  const tier = renderTier(currentDevice(), ui.tierOverride);
  canvas.dataset.tier = tier.name;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: tier.antialias });
  renderer.setPixelRatio(pixelRatio(currentDevice()));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();

  const scene = new THREE.Scene();
  const sky = new THREE.Color();
  scene.background = sky;
  const hemisphere = new THREE.HemisphereLight();
  // The sun by Day, the moon by Night: always from the same direction, so shadows stay put.
  const sun = new THREE.DirectionalLight();
  scene.add(hemisphere, sun, sun.target);
  let theme: Theme = ui.theme ?? 'day';
  /** Colour the sky and the lights for the theme; the World's own parts follow in `objects.setTheme`. */
  const lightFor = (next: Theme) => {
    const tokens = THEME_TOKENS[next].world;
    setColour(sky, tokens.sky);
    setColour(hemisphere.color, tokens.skyLight);
    setColour(hemisphere.groundColor, tokens.groundLight);
    hemisphere.intensity = tokens.skyIntensity;
    setColour(sun.color, tokens.sunLight);
    sun.intensity = tokens.sunIntensity;
    canvas.dataset.theme = next;
  };
  lightFor(theme);

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

  // Two modes (ADR 0005). While Ambient Life is alive (the World seen, motion allowed, a tier that
  // moves) every frame asks for the next: the World renders continuously. Otherwise it renders on
  // demand: a request schedules at most one frame, and an idle World schedules none.
  let frame = 0;
  let frames = 0;
  /** A frame was asked for (a camera move, a new World, a resize): it renders at once, whatever the tier. */
  let asked = false;
  // Seen again (the tab shown, the canvas back on screen, motion allowed): start the loop. Unseen: it stops by itself.
  const life = createAmbientLife({ canvas, render: tier, override: ui.lifeOverride, onChange: () => life.seen() && requestRender() });
  const { clock } = life;
  /** The House: how far its lid is heading (1 open, 0 shut, part-way on the Story Scroll), how far it is lifted (0–1) and how long a lift takes. */
  let openTarget = 0;
  let opening = 0;
  let openingMs = 0;
  const lifting = () => opening !== openTarget;
  /** The House is open, or opening: more open than shut. */
  const houseOpen = () => openTarget > 0.5;
  /** The camera has been inside the open House (`houseLeave.ts`), so zooming or panning out of it leaves it. */
  let inHouse = false;
  /** Half the frame in frame units at zoom 1. */
  const halfFrame = () => ({ x: camera.right, y: camera.top });
  // The Guide assembles and dissolves whenever it does; it bobs and blinks only while Ambient Life is alive.
  const moving = () => life.alive() || lifting() || guide.moving(life.alive());
  /** The time of the last frame while something moved (0 when nothing did). */
  let lastTick = 0;
  const frameListeners = new Set<(frame: FrameInfo) => void>();
  const requestRender = () => {
    asked = true;
    schedule();
  };
  /** The next animation frame: an asked frame renders; one only ambient motion wants renders when due on this tier. */
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame((now) => {
      frame = 0;
      if (!asked && !ambientFrameDue(now, lastTick, life.ambientFps())) {
        if (moving()) schedule();
        return;
      }
      asked = false;
      const alive = life.alive();
      // A continuous frame's time tells the tier watch how this device keeps up.
      if (alive && lastTick) life.frame(now - lastTick);
      // At most a tenth of a second a frame, so nothing leaps after a pause.
      const dt = lastTick ? Math.min(100, now - lastTick) : 0;
      if (alive) {
        // The shared clock: the sea bobs, the plants sway, leaves fall, the vessels rock and the ships sail, the developer works. Frozen otherwise.
        clock.advance(dt / 1000);
        objects?.step(clock.seconds);
      }
      // As many leaves as the life tier allows (it may have dropped).
      if (objects) showLife(objects.setLife(life.tier()));
      // The clouds fade as the camera zooms in on a Landmark.
      if (objects) canvas.dataset.clouds = objects.setZoom(rig.state.zoom).toFixed(2);
      if (lifting()) {
        opening = openingStep(opening, openTarget, dt, openingMs);
        objects?.house.setOpening(opening);
        // The lid casts a shadow (and the room shows or hides): redraw the static shadow map while it moves.
        sun.shadow.needsUpdate = true;
        canvas.dataset.interior = opening === 1 ? 'open' : opening === 0 ? 'shut' : 'moving';
      }
      // The overlays project through the camera's matrices: bring them up to date first.
      camera.updateMatrixWorld();
      guide.step(dt, life.alive());
      lastTick = moving() ? now : 0;
      hotspots.place(camera);
      cards.place(camera, rig.state, viewCentre, cardFocus, cardTop);
      guide.place(camera);
      outline.render();
      idleRenderer();
      if (frameListeners.size > 0) {
        // `render()` restarts three's animation loop, which resets the counts first: they are this frame's.
        const info = { now, triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.drawCalls };
        for (const listener of frameListeners) listener(info);
      }
      canvas.dataset.frames = String(++frames);
      canvas.dataset.clock = clock.seconds.toFixed(2);
      const { target, zoom } = rig.state;
      canvas.dataset.camera = `${target.x.toFixed(2)} ${target.z.toFixed(2)} ${zoom.toFixed(3)}`;
      if (moving()) schedule();
    });
  };
  const rig = createCameraRig({
    element: ui.frame,
    camera,
    onChange: () => {
      // The camera has come inside the open House (a flight, a cut or the visitor): from now on it can leave it.
      if (houseOpen() && !inHouse) inHouse = insideHouse(rig.state, landmarkFocus(current, 'house'), halfFrame());
      requestRender();
    },
    onInput: () => {
      // Zoomed or panned out of the open House: heard before `onExplore`, so the page still knows whether the Tour ran.
      if (inHouse && outOfHouse(rig.state, landmarkFocus(current, 'house'), halfFrame())) {
        inHouse = false;
        ui.onLeaveHouse?.();
      }
      ui.onExplore?.();
    },
  });
  const hotspots = createLandmarkHotspots(ui.frame, ui.hotspots, (target) => {
    rig.jumpTo({ target, zoom: rig.state.zoom });
    ui.onExplore?.();
  });
  const cards = createDataCards(ui.frame, ui.cards ?? []);
  // The model of a hovered, focused or open link is outlined (`outline.ts`); its box stays invisible.
  const outline = createOutline(renderer, scene, camera);
  outline.setTheme(theme);
  let outlineModels: OutlineModels | null = null;
  let outlineKeys: string[] = [];
  /** Outline the models these keys name in the World on show; `canvas.dataset.outline` lists the ones it has, for checks. */
  const showOutline = () => {
    const shown = outlineKeys.filter((key) => (outlineModels?.proxies(key).length ?? 0) > 0);
    outline.set(shown.flatMap((key) => outlineModels?.proxies(key) ?? []));
    canvas.dataset.outline = shown.join(' ');
    requestRender();
  };
  // The Guide lives for the whole visit; each World only moves it (`show`).
  const guide = createGuide({ frame: ui.frame, ...ui.guide, onChange: requestRender });
  scene.add(guide.object);
  let viewCentre: ScreenOffset = { x: 0, y: 0 };
  /** Which Data Card may show: the nearest (undefined), only this Landmark's, or none (null). */
  let cardFocus: PlacedLandmarkId | null | undefined;
  /** CSS px from the frame's top that a standing Data Card keeps below (a bar across the top), else it hangs. */
  let cardTop = 0;

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

  /** CSS px from the frame's centre (y down) to frame units (world units at zoom 1, y up). */
  function toFrameUnits(at: ScreenOffset) {
    const k = (camera.top - camera.bottom) / Math.max(1, ui.frame.clientHeight);
    return { x: at.x * k, y: -at.y * k };
  }
  /** The pan bounds hold the ground where the visitor looks, not the frame's centre. Again after any re-framing. */
  function lookAtViewCentre() {
    rig.lookAt(toFrameUnits(viewCentre));
  }

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(pixelRatio(currentDevice()));
    renderer.setSize(w, h, false);
    frameCamera();
    lookAtViewCentre();
    requestRender();
  };

  let objects: WorldObjects | null = null;
  /** Say how many fish, land animals and birds (or bats) show, for checks. */
  const showLife = ({ fish, animals, birds }: LifeShown) => {
    canvas.dataset.fish = String(fish);
    canvas.dataset.animals = String(animals);
    canvas.dataset.birds = String(birds);
  };
  let current = world;
  const show = (next: World, nextMeshed?: MeshedWorld) => {
    current = next;
    // Free the old World's GPU buffers and materials before building the new one.
    if (objects) {
      scene.remove(objects.group);
      outline.set([]);
      outlineModels?.dispose();
      objects.dispose();
    }
    clock.setWind(next.wind);
    objects = buildWorldObjects(next, nextMeshed, tier.name, clock);
    objects.setTheme(theme);
    objects.step(clock.seconds);
    showLife(objects.setLife(life.tier()));
    objects.house.setOpening(opening);
    scene.add(objects.group);

    const { width, depth } = next.terrain;
    const centre = new THREE.Vector3(width / 2, 0, depth / 2);
    placeSun(sun, centre, Math.hypot(width, depth) / 2 + 2, tier.shadowMapSize);

    // Pan bounds are the union of the Isles' footprints; zoom runs from the Overview in to a close-up.
    const { target } = next.views.overview;
    radius = next.views.overview.radius;
    frameCamera();
    lookAtViewCentre();
    hotspots.setWorld(next, objects.house.developer);
    hotspots.setInterior(houseOpen());
    // A new World: the camera has yet to come inside its House.
    inHouse = false;
    outlineModels = createOutlineModels({ world: next, objects, guide: guide.object, plantCell: hotspots.plantCell });
    showOutline();
    cards.setWorld(next);
    // The Guide (dis)assembles in flight only where it can be seen; otherwise it is simply there.
    guide.formAt(guideSpot(next, 'station'), life.seen());
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
    canvas.dataset.roomTriangles = String(objects.house.roomTriangles);
    requestRender();
  };

  show(world, meshed);
  canvas.dataset.interior = 'shut';
  const stopOutlineLinks = watchOutlineLinks([...ui.hotspots, ...(ui.guide?.button ? [ui.guide.button] : [])], (keys) => {
    outlineKeys = keys;
    showOutline();
  });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  canvas.dataset.backend = backend;


  /** Open the House `amount` of the way (1 open, 0 shut) over `ms` per full lift; 0 cuts. */
  const setOpening = (amount: number, ms: number) => {
    if (amount === openTarget && ms === openingMs) return;
    openTarget = amount;
    openingMs = ms;
    // The developer's link shows once the House is more open than shut.
    hotspots.setInterior(houseOpen());
    if (!houseOpen()) inHouse = false;
    if (!lifting()) canvas.dataset.interior = amount === 1 ? 'open' : amount === 0 ? 'shut' : 'moving';
    requestRender();
  };

  const focusState = (id: LandmarkId, at: ScreenOffset = { x: 0, y: 0 }, zoomScale = 1) => {
    const { point, zoom } = landmarkFocus(current, id);
    return stateShowing(point, zoom * zoomScale, toFrameUnits(at), rig.limits);
  };

  return {
    show,
    camera: rig,
    focusState,
    focus: (id, { at, ms }) => rig.flyTo(focusState(id, at), ms),
    setInterior: (open, ms) => setOpening(open ? 1 : 0, ms),
    setOpening,
    setDataCardFocus: (id, top = 0) => {
      if (id === cardFocus && top === cardTop) return;
      cardFocus = id;
      cardTop = top;
      requestRender();
    },
    guide,
    guideSpot: (id) => guideSpot(current, id),
    setTheme: (next) => {
      if (next === theme) return;
      theme = next;
      lightFor(theme);
      objects?.setTheme(theme);
      outline.setTheme(theme);
      requestRender();
    },
    onFrame: (listener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    backend,
    tier: tier.name,
    get lifeTier() {
      return life.tier();
    },
    setViewCentre: (at) => {
      viewCentre = at;
      lookAtViewCentre();
      requestRender();
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      frameListeners.clear();
      life.dispose();
      rig.dispose();
      hotspots.dispose();
      stopOutlineLinks();
      outlineModels?.dispose();
      outline.dispose();
      guide.dispose();
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
function placeSun(sun: THREE.DirectionalLight, centre: THREE.Vector3, reach: number, mapSize: number): void {
  const az = THREE.MathUtils.degToRad(LOOK.sunAzimuth);
  const el = THREE.MathUtils.degToRad(LOOK.sunElevation);
  const direction = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  sun.position.copy(centre).addScaledVector(direction, reach * 2);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mapSize, mapSize);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: reach * 4 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  // Static shadow map: rendered on the next frame, then only when asked again.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
}
