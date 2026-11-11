/**
 * The Guide in the scene: its voxel body, its screen face, the voxels that
 * fly in to assemble it, and its speech bubble and button over the canvas.
 * It lives for the whole visit: a new World does not rebuild it, it
 * dissolves and re-forms at the new World's Station (`formAt`).
 *
 * - The body is one mesh with the soft-voxel material in local space (so
 *   its seams bob and turn with it), turned to face the camera. It casts no
 *   shadow: the sun's shadow map is static.
 * - The screen is a plane over the bezel showing a pixel-eye face
 *   (`GUIDE_FACES`) from a tiny texture, lit pixel by pixel with a gap round
 *   each so it reads as a pixel screen; unlit, so it glows by Night too.
 * - Assembling: one small cube per voxel (an instanced mesh) flies in on
 *   its arc (`voxelFlights`); once all have landed the body takes over.
 *   Dissolving plays the same flights backwards.
 * - On the Tour it flies ahead to each Landmark (`flyTo`, along
 *   `travelPoint`), and holds its last line up (`say(lines, { hold })`).
 * - The speech bubble (`say`) is HTML, placed beside the Guide on screen
 *   (`placeBubble`) and never under a card floating over the World; it is
 *   a polite live region, so its lines are read out. The button over the
 *   Guide takes clicks and keyboard focus; it lies under the Landmark
 *   hotspots, so it never takes a click meant for a Landmark.
 */
import * as THREE from 'three/webgpu';
import { fract, mix, step, texture, uv, vec2, vec3 } from 'three/tsl';
import type { Vec3 } from '@/world';
import type { GuideLine, GuideMood } from '@/lib/guideLines';
import { readingMs } from '@/lib/guideLines';
import { meshVoxels, VoxelGrid } from './mesher';
import { FIXED_COLOURS, LOOK, oklchToLinear } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { ColourTable } from './worldVoxels';
import { GUIDE_BODY, GUIDE_FACES, GUIDE_SCREEN, guideVoxels } from './guideModel';
import { blinking, flightPoint, GUIDE_REACH, hoverPose, travelPoint, voxelFlights } from './guideMotion';
import { placeBubble } from './speechBubble';
import type { Rect } from './freeArea';

/** How long the Guide takes to assemble, and to dissolve, in ms. */
export const FORM_MS = 1600;
export const DISSOLVE_MS = 700;

/** The face's pixel grid: the faces' 12 × 10, padded to a square. */
const FACE_SIZE = 12;
/** The lit pixels' colour: a pale cyan, near the brand's hue. */
const FACE_LIT = { l: 0.88, c: 0.09, h: 205 };

/** What the page sees of the Guide: whether it has formed, and its voice. */
export interface GuideView {
  /** Resolves once the Guide has (re-)formed, now or after its assembly. */
  readonly formed: Promise<void>;
  /**
   * Say these lines, one bubble after another, each for its reading time.
   * Stops anything it was saying. With `hold`, the last line stays up until
   * the next `say` or `hush` (the Tour waits for the visitor).
   */
  say(lines: readonly GuideLine[], options?: { hold?: boolean }): void;
  /** Stop talking and put the bubble away. */
  hush(): void;
  /**
   * Fly to `spot` over `ms` (0 cuts), arcing up on the way (`travelPoint`),
   * and stay there: the Tour sends it ahead to each Landmark. If it is not
   * formed yet, it forms there instead. Resolves when it arrives, or when a
   * later flight or a new World takes over.
   */
  flyTo(spot: Vec3, ms: number): Promise<void>;
}

export interface Guide extends GuideView {
  object: THREE.Group;
  /** Triangles in the body and the screen. */
  triangles: number;
  /** Form at `home`: assemble there (dissolving first, if formed elsewhere), or with `animate` false cut to it. */
  formAt(home: Vec3, animate: boolean): void;
  /**
   * Advance `dt` ms. `idle`: motion is allowed and the page visible, so the
   * formed Guide bobs and blinks. Returns whether it is assembling or dissolving.
   */
  step(dt: number, idle: boolean): boolean;
  /** Whether the next frame moves it: assembling or dissolving, or (with `idle`) bobbing while formed. */
  moving(idle: boolean): boolean;
  /** Lay the bubble and the button over the Guide as `camera` sees it. */
  place(camera: THREE.OrthographicCamera): void;
  dispose(): void;
}

export interface GuideOptions {
  /** The World's frame: the bubble and the button are in it. */
  frame: HTMLElement;
  /** The button over the Guide (clicks are the page's to handle). */
  button?: HTMLElement | null;
  /** The speech bubble; its text goes in its `[data-guide-say]` child. */
  bubble?: HTMLElement | null;
  /** The cards floating over the World, in client px: the bubble keeps clear of them. */
  covers?: () => Rect[];
  /** The Landmarks' boxes on screen (their hotspots), in client px: the bubble keeps off them when it can. */
  landmarks?: () => Rect[];
  /** Something changed that needs a frame (a new line, a new face). */
  onChange: () => void;
}

type Phase = 'gone' | 'forming' | 'formed' | 'dissolving';

export function createGuide({ frame, button, bubble, covers = () => [], landmarks = () => [], onChange }: GuideOptions): Guide {
  const root = new THREE.Group();
  root.name = 'guide';
  root.visible = false;
  // Face the camera: the screen's +x turned to look along the camera's azimuth, (1, 0, 1).
  const body = new THREE.Group();
  root.add(body);

  // The body: its voxels, moved into a positive grid for the mesher, then back by whole voxels.
  const table = new ColourTable();
  const fixed = (name: keyof typeof FIXED_COLOURS) => table.id(FIXED_COLOURS[name]);
  const model = guideVoxels({ fixed });
  const offset = GUIDE_BODY;
  const grid = new VoxelGrid(model.size);
  const voxels = [...model.voxels()];
  for (const v of voxels) grid.set(v.x + offset, v.y + offset, v.z + offset, v.colour);
  const [chunk] = meshVoxels(grid, { colours: table.colours, aoStrength: LOOK.aoStrength, chunkSize: 64, solidOutside: () => false });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(chunk!.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(chunk!.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(chunk!.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(chunk!.indices, 1));
  geometry.translate(-offset * model.size, -offset * model.size, -offset * model.size);
  geometry.computeBoundingSphere();
  const material = voxelMaterial(model.size, 'local');
  const shell = new THREE.Mesh(geometry, material);
  shell.name = 'guide-body';
  shell.castShadow = false;
  shell.receiveShadow = true;

  // The screen: a plane a hair in front of the bezel, facing +x, showing the face texture.
  const q = model.size;
  const screenGeometry = new THREE.PlaneGeometry((GUIDE_SCREEN.max.z - GUIDE_SCREEN.min.z) * q, (GUIDE_SCREEN.max.y - GUIDE_SCREEN.min.y) * q);
  screenGeometry.rotateY(Math.PI / 2);
  screenGeometry.translate(GUIDE_SCREEN.x * q + 0.003, ((GUIDE_SCREEN.min.y + GUIDE_SCREEN.max.y) / 2) * q, ((GUIDE_SCREEN.min.z + GUIDE_SCREEN.max.z) / 2) * q);
  const pixels = new Uint8Array(FACE_SIZE * FACE_SIZE * 4);
  const faceTexture = new THREE.DataTexture(pixels, FACE_SIZE, FACE_SIZE, THREE.RGBAFormat);
  faceTexture.magFilter = THREE.NearestFilter;
  faceTexture.minFilter = THREE.NearestFilter;
  faceTexture.generateMipmaps = false;
  const screenMaterial = new THREE.MeshBasicNodeMaterial();
  const lit = oklchToLinear(FACE_LIT);
  const dark = oklchToLinear(FIXED_COLOURS.screenDark);
  const cell = fract(uv().mul(vec2(FACE_SIZE, FACE_SIZE)));
  // A gap round every pixel, so the face reads as a pixel screen.
  const gap = step(0.12, cell.x).mul(step(cell.x, 0.88)).mul(step(0.12, cell.y)).mul(step(cell.y, 0.88));
  const on = texture(faceTexture, uv()).r.mul(gap);
  screenMaterial.colorNode = mix(vec3(...dark).mul(1.3), vec3(...lit), on);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.name = 'guide-screen';
  body.add(shell, screen);

  // The flying voxels: one small cube each, in the body's space.
  const flights = voxelFlights(voxels.map((v) => ({ x: (v.x + 0.5) * q, y: (v.y + 0.5) * q, z: (v.z + 0.5) * q })));
  const cubeGeometry = new THREE.BoxGeometry(q, q, q);
  const cubeMaterial = new THREE.MeshStandardNodeMaterial({ roughness: LOOK.roughness });
  const cubes = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, flights.length);
  cubes.name = 'guide-voxels';
  cubes.frustumCulled = false;
  const tint = new THREE.Color();
  for (const [i, v] of voxels.entries()) {
    const [r, g, b] = table.colours[v.colour]!;
    cubes.setColorAt(i, tint.setRGB(r, g, b, THREE.LinearSRGBColorSpace));
  }
  body.add(cubes);
  const matrix = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const placeCubes = (t: number) => {
    for (const [i, flight] of flights.entries()) {
      const p = flightPoint(flight, t);
      // A cube in flight turns a little as it comes in; none at rest.
      turn.setFromAxisAngle(at.set(0, 1, 0), (1 - t) * (i % 5) * 0.6);
      matrix.compose(at.set(p.x, p.y, p.z), turn, size.setScalar(Math.max(1e-4, p.scale)));
      cubes.setMatrixAt(i, matrix);
    }
    cubes.instanceMatrix.needsUpdate = true;
  };

  // Where it is, how far formed, and its face.
  let phase: Phase = 'gone';
  let progress = 0;
  let home: Vec3 = { x: 0, y: 0, z: 0 };
  let next: Vec3 | null = null;
  let idleSeconds = 0;
  let mood: GuideMood = 'neutral';
  let shownFace = '';
  let resolveFormed: () => void = () => {};
  let formed: Promise<void> = new Promise((resolve) => (resolveFormed = resolve));
  /** A flight to another spot (the Tour), while formed: from, to, how far along (ms) and who waits for it. */
  let travel: { from: Vec3; to: Vec3; ms: number; elapsed: number; done: () => void } | null = null;
  const endTravel = () => {
    const done = travel?.done;
    travel = null;
    done?.();
  };
  /** Where it floats now, before its bob: on its way, or at home. */
  const base = (): Vec3 => (travel ? travelPoint(travel.from, travel.to, travel.elapsed / travel.ms) : home);

  const showFace = (face: keyof typeof GUIDE_FACES) => {
    if (face === shownFace) return;
    shownFace = face;
    const rows = GUIDE_FACES[face];
    const top = Math.floor((FACE_SIZE - rows.length) / 2);
    pixels.fill(0);
    for (const [r, row] of rows.entries()) {
      // Texture rows run bottom up; the plane's u runs along −z, which the camera sees left to right.
      const y = FACE_SIZE - 1 - (top + r);
      for (let c = 0; c < row.length; c++) {
        const i = (y * FACE_SIZE + c) * 4;
        const v = row[c] === '#' ? 255 : 0;
        pixels[i] = v;
        pixels[i + 1] = v;
        pixels[i + 2] = v;
        pixels[i + 3] = 255;
      }
    }
    faceTexture.needsUpdate = true;
  };
  showFace('neutral');

  const show = () => {
    const assembled = phase === 'formed';
    shell.visible = assembled;
    screen.visible = assembled;
    cubes.visible = phase === 'forming' || phase === 'dissolving';
    root.visible = phase !== 'gone';
    if (button) button.hidden = !assembled;
    const at = base();
    root.position.set(at.x, at.y, at.z);
    // For checks: gone, forming, formed or dissolving.
    frame.dataset.guide = phase;
  };
  const land = () => {
    phase = 'formed';
    progress = 1;
    show();
    resolveFormed();
  };

  // Talking: one line at a time, each for its reading time.
  let timer = 0;
  const sayText = bubble?.querySelector<HTMLElement>('[data-guide-say]') ?? bubble;
  const hush = () => {
    clearTimeout(timer);
    timer = 0;
    mood = 'neutral';
    bubble?.removeAttribute('data-shown');
    onChange();
  };
  const speak = (lines: readonly GuideLine[], i: number, hold: boolean) => {
    const line = lines[i];
    if (!line) return hush();
    mood = line.mood;
    if (sayText) sayText.textContent = line.say;
    bubble?.setAttribute('data-shown', '');
    onChange();
    // A held last line stays up until the next `say` or `hush`.
    if (hold && i === lines.length - 1) return;
    timer = window.setTimeout(() => speak(lines, i + 1, hold), readingMs(line.say));
  };

  const projected = new THREE.Vector3();

  return {
    object: root,
    triangles: chunk!.indices.length / 3 + 2,
    get formed() {
      return formed;
    },
    say: (lines, options) => {
      clearTimeout(timer);
      speak(lines, 0, options?.hold ?? false);
    },
    hush,
    flyTo(spot, ms) {
      endTravel();
      if (phase !== 'formed') {
        // Not formed yet (assembling, or re-forming for a new World): form there instead.
        if (phase === 'dissolving') next = spot;
        else home = spot;
        show();
        return formed;
      }
      const from = root.position.clone();
      home = spot;
      if (ms <= 0) {
        show();
        onChange();
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        travel = { from: { x: from.x, y: from.y, z: from.z }, to: spot, ms, elapsed: 0, done: resolve };
        onChange();
      });
    },
    formAt(spot, animate) {
      endTravel();
      if (phase === 'formed' && !animate) {
        home = spot;
        show();
        return;
      }
      // A new formation: anyone waiting hears when it lands.
      if (phase === 'formed') formed = new Promise((resolve) => (resolveFormed = resolve));
      if (!animate) {
        home = spot;
        next = null;
        land();
        return;
      }
      hush();
      if (phase === 'gone') {
        home = spot;
        phase = 'forming';
        progress = 0;
      } else {
        // Formed or on its way: dissolve where it is, then form at the new spot.
        next = spot;
        phase = 'dissolving';
      }
      placeCubes(progress);
      show();
    },
    moving: (idle) => phase === 'forming' || phase === 'dissolving' || travel !== null || (idle && phase === 'formed'),
    step(dt, idle) {
      if (phase === 'forming') {
        progress = Math.min(1, progress + dt / FORM_MS);
        if (progress >= 1) land();
        else placeCubes(progress);
      } else if (phase === 'dissolving') {
        progress = Math.max(0, progress - dt / DISSOLVE_MS);
        if (progress <= 0) {
          if (next) home = next;
          next = null;
          phase = 'forming';
        }
        placeCubes(progress);
        show();
      }
      if (travel) {
        travel.elapsed = Math.min(travel.ms, travel.elapsed + dt);
        const at = base();
        root.position.set(at.x, at.y, at.z);
        if (travel.elapsed >= travel.ms) endTravel();
      }
      if (idle && phase === 'formed') idleSeconds += dt / 1000;
      const pose = idle && phase === 'formed' ? hoverPose(idleSeconds) : { y: 0, yaw: 0 };
      root.position.y = base().y + pose.y;
      body.rotation.y = -Math.PI / 4 + pose.yaw;
      showFace(idle && phase === 'formed' && blinking(idleSeconds) ? 'blink' : mood);
      return phase === 'forming' || phase === 'dissolving';
    },
    place(camera) {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      projected.copy(root.position).project(camera);
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      const radius = (GUIDE_REACH * height * camera.zoom) / (camera.top - camera.bottom);
      if (button && !button.hidden) {
        const side = 2 * radius * 0.8;
        button.style.width = `${side}px`;
        button.style.height = `${side}px`;
        button.style.transform = `translate(${x - side / 2}px, ${y - side / 2}px)`;
      }
      if (!bubble || !bubble.hasAttribute('data-shown')) return;
      const box = frame.getBoundingClientRect();
      const inFrame = (c: Rect): Rect => ({ left: c.left - box.left, top: c.top - box.top, right: c.right - box.left, bottom: c.bottom - box.top });
      const size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
      const spot =
        phase === 'formed'
          ? placeBubble({ x, y, radius }, size, { width, height }, covers().map(inFrame), landmarks().map(inFrame))
          : null;
      bubble.toggleAttribute('data-offscreen', !spot);
      if (!spot) return;
      bubble.dataset.side = spot.side;
      bubble.style.setProperty('--tail', `${spot.tail}px`);
      bubble.style.transform = `translate(${spot.left}px, ${spot.top}px)`;
    },
    dispose() {
      clearTimeout(timer);
      endTravel();
      geometry.dispose();
      material.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      faceTexture.dispose();
      cubeGeometry.dispose();
      cubeMaterial.dispose();
      cubes.dispose();
    },
  };
}
