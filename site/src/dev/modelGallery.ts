/**
 * The Model Gallery's scene: every structure of one kind, Biomes in columns
 * and Variants in rows as the camera sees them, each on a patch of its
 * Biome's ground (on a tall screen the Biomes wrap two to a band, each
 * band's Variants down it), drawn with the World's renderer, soft-voxel material,
 * light and Day and Night tokens. Each model is an `InstancedMesh` of one
 * (`structureMeshes.ts`), its lid (if it has one) a second one that lifts.
 * A House Interior room shows furnished, the developer at their computer
 * (`furnishedRoom`), at its own 1/16 unit; a Garden fence shows planted
 * full, six flowers and three trees (`plantedGarden`); boats and ships float on
 * a patch of their Biome's sea, as in the World. Renders on demand. Dev only
 * (`/dev/models`).
 */
import * as THREE from 'three/webgpu';
import { BIOMES } from '@/world/biomes';
import { BIOME_IDS } from '@/world';
import { STRUCTURES, type Structure } from '@/structures';
import { furnishedRoom } from '@/render/interiorModel';
import { plantedGarden } from '@/render/gardenPlants';
import { seaColour, THEME_TOKENS } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { LOOK, oklchToLinear } from '@/render/palette';
import { structureInstances, type InstancePlacement } from '@/render/structureMeshes';
import { voxelMaterial } from '@/render/voxelMaterial';
import { worldColours } from '@/render/worldVoxels';
import { SEA_LEVEL } from '@/render/seaModel';
import { GROUND_DETAIL, STRUCTURE } from '@/render/voxelTiers';
import type { Oklch } from '@/world';

/** Cells between neighbouring models' centres. */
const SPACING = 6;
/** Cells between the House Interior's rooms (2×2, and low): closer, so each shows larger. */
const ROOM_SPACING = 4;
/** Cells between the boats (1×1, and low): closer, so each shows larger. */
const BOAT_SPACING = 3.5;
/** Cells between the Gardens (5×5 with their ground): wider, so their ground patches never touch. */
const GARDEN_SPACING = 8;
/** Rows (in SPACING) between one row and the next: a row step is shallower on screen than a column step, so it needs more room. */
const ROW_GAP = 1.8;
/** Biomes side by side on a tall screen. */
const PORTRAIT_COLUMNS = 2;
/** How high a lifted lid floats, in world units. */
const LID_LIFT = 2.5;

const setColour = (target: THREE.Color, colour: Oklch) => {
  const [r, g, b] = oklchToLinear(colour);
  target.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
};

export async function mountGallery(canvas: HTMLCanvasElement, labels: HTMLElement) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();

  const scene = new THREE.Scene();
  const sky = new THREE.Color();
  scene.background = sky;
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(hemisphere, sun, sun.target);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

  let turns = 0;
  let lifted = false;
  let theme: Theme = 'day';
  let shown: Array<{ structure: Structure; at: THREE.Vector3; base: ReturnType<typeof structureInstances>; lid?: ReturnType<typeof structureInstances> }> = [];
  const ground = new THREE.Group();
  scene.add(ground);
  const groundMaterial = voxelMaterial(1);
  let frame = 0;
  const render = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      layoutCamera();
      renderer.render(scene, camera);
      placeLabels();
    });
  };

  /** The models' middle on the ground, and how far the frame reaches each side of it (world units on screen). */
  let extent = { cx: 0, cz: 0, halfW: 10, halfH: 10 };
  const layoutCamera = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const half = Math.max(extent.halfH, extent.halfW / aspect);
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    camera.updateProjectionMatrix();
    const target = new THREE.Vector3(extent.cx, 1.5, extent.cz);
    const reach = Math.max(extent.halfW, extent.halfH);
    camera.position.copy(target).add(new THREE.Vector3(1, 1, 1).multiplyScalar(100));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const sunDirection = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - LOOK.sunElevation),
      THREE.MathUtils.degToRad(LOOK.sunAzimuth),
    );
    sun.position.copy(target).add(sunDirection.multiplyScalar(60));
    sun.target.position.copy(target);
    const r = reach * 1.6;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 200 });
    sun.shadow.camera.updateProjectionMatrix();
  };

  const placeLabels = () => {
    labels.replaceChildren();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const { structure, at } of shown) {
      const p = at.clone().add(new THREE.Vector3(0, -0.2, 0)).project(camera);
      const label = document.createElement('span');
      label.textContent = `${structure.biome ?? 'any'} · ${structure.variant}`;
      label.style.left = `${((p.x + 1) / 2) * w}px`;
      label.style.top = `${((1 - p.y) / 2) * h + 24}px`;
      labels.append(label);
    }
  };

  const placementOf = (at: THREE.Vector3, lift = 0): InstancePlacement => ({ x: at.x, y: at.y + lift, z: at.z, turns });

  const clear = () => {
    for (const { base, lid } of shown) {
      scene.remove(base.mesh);
      base.dispose();
      if (lid) {
        scene.remove(lid.mesh);
        lid.dispose();
      }
    }
    shown = [];
    for (const child of [...ground.children]) {
      ground.remove(child);
      (child as THREE.Mesh).geometry.dispose();
    }
  };

  const tokens = (theme: Theme) => THEME_TOKENS[theme].world;
  const applyTheme = (theme: Theme) => {
    const t = tokens(theme);
    setColour(sky, t.sky);
    setColour(hemisphere.color, t.skyLight);
    setColour(hemisphere.groundColor, t.groundLight);
    hemisphere.intensity = t.skyIntensity;
    setColour(sun.color, t.sunLight);
    sun.intensity = t.sunIntensity;
  };
  applyTheme('day');

  /** A Biome's colours for a structure (a shared one shows in the tropical Biome's). */
  const coloursOf = (s: Structure) => worldColours({ biome: BIOMES[s.biome ?? 'tropical'] });
  /** Boats and ships stand on the sea floor, their first layer under the water. */
  const afloat = (s: Structure) => s.kind === 'boat' || s.kind === 'ship';
  /**
   * A patch of a Biome's grass under a model, one cell wider each side than
   * its footprint; for a boat or ship, a patch of its Biome's shallow sea
   * (in the theme's shade) whose top is the sea level, as in the World.
   */
  const groundPatch = (s: Structure, colours: ReturnType<typeof coloursOf>, at: THREE.Vector3) => {
    const w = s.footprint.width + 2;
    const d = s.footprint.depth + 2;
    const geometry = new THREE.BoxGeometry(w, 1, d);
    const [r, g, b] = afloat(s)
      ? oklchToLinear(seaColour(BIOMES[s.biome ?? 'tropical'], 'waterShallow', theme))
      : colours.table.colours[colours.biome('grass')]!;
    const colour = new Float32Array(geometry.attributes.position!.count * 3);
    for (let i = 0; i < colour.length; i += 3) colour.set([r, g, b], i);
    geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
    geometry.translate(at.x, at.y - 0.5 + (afloat(s) ? SEA_LEVEL : 0), at.z);
    const mesh = new THREE.Mesh(geometry, groundMaterial);
    mesh.receiveShadow = true;
    ground.add(mesh);
    // The Dock's things stand on its ¼-unit plank deck (their anchor is below their first layer), as in the World.
    if (s.kind === 'dock') {
      const deck = new THREE.BoxGeometry(s.footprint.width, 1 / GROUND_DETAIL, s.footprint.depth);
      const [pr, pg, pb] = colours.table.colours[colours.fixed('plank')]!;
      const plank = new Float32Array(deck.attributes.position!.count * 3);
      for (let i = 0; i < plank.length; i += 3) plank.set([pr, pg, pb], i);
      deck.setAttribute('color', new THREE.BufferAttribute(plank, 3));
      deck.translate(at.x, at.y + 1 / GROUND_DETAIL / 2, at.z);
      const deckMesh = new THREE.Mesh(deck, groundMaterial);
      deckMesh.receiveShadow = true;
      deckMesh.castShadow = true;
      ground.add(deckMesh);
    }
  };

  /** The kind on show, and whether the grid was laid out for a tall screen. */
  let kindShown: string | null = null;
  let laidOutPortrait = false;
  const isPortrait = () => canvas.clientHeight > canvas.clientWidth;
  // Redraw on resize; re-lay the grid when the screen turns between wide and tall.
  new ResizeObserver(() => {
    if (kindShown !== null && isPortrait() !== laidOutPortrait) gallery.show(kindShown);
    else render();
  }).observe(canvas);

  const gallery = {
    backend: ((renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2') as string,
    /** Show every structure of a kind; returns how many. */
    show(kind: string): number {
      clear();
      kindShown = kind;
      laidOutPortrait = isPortrait();
      // A room shows furnished: the developer seated at its computer; a Garden planted full.
      const dressed = (s: Structure) => (!s.biome ? s : s.kind === 'room' ? furnishedRoom(s.biome) : s.kind === 'garden' ? plantedGarden(s.biome) : s);
      const list = STRUCTURES.filter((s) => s.kind === kind).map(dressed);
      const columns = BIOME_IDS.map((biome) => list.filter((s) => s.biome === biome));
      columns.push(list.filter((s) => s.biome === null));
      const used = columns.filter((column) => column.length > 0);
      const spacing = kind === 'room' ? ROOM_SPACING : kind === 'boat' ? BOAT_SPACING : kind === 'garden' ? GARDEN_SPACING : SPACING;
      const margin = kind === 'room' || kind === 'boat' ? 2 : 4;
      const rows = Math.max(1, ...used.map((column) => column.length));
      used.forEach((column, c) => {
        column.forEach((s, r) => {
          // Biomes run across the screen (+x −z), Variants down it (+x +z). On a tall screen the Biomes wrap into bands.
          const band = laidOutPortrait ? Math.floor(c / PORTRAIT_COLUMNS) : 0;
          const across = laidOutPortrait ? c % PORTRAIT_COLUMNS : c;
          const down = (band * rows + r) * ROW_GAP;
          const at = new THREE.Vector3((down + across) * spacing, 0, (down - across) * spacing);
          const colours = coloursOf(s);
          const hasLid = s.palette.some((p) => p.part === 'lid');
          const base = structureInstances(s, colours, [placementOf(at)], hasLid ? { part: 'base' } : {});
          scene.add(base.mesh);
          const lid = hasLid ? structureInstances(s, colours, [placementOf(at, lifted ? LID_LIFT : 0)], { part: 'lid' }) : undefined;
          if (lid) scene.add(lid.mesh);
          groundPatch(s, colours, at);
          shown.push({ structure: s, at, base, lid });
        });
      });
      // Fit the frame: on screen, right is (x − z)/√2 and down is (x + z)/√6 for points on the ground.
      const across = shown.map(({ at }) => (at.x - at.z) / Math.SQRT2);
      const down = shown.map(({ at }) => (at.x + at.z) / Math.sqrt(6));
      const span = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);
      extent = {
        cx: shown.reduce((sum, { at }) => sum + at.x, 0) / Math.max(1, shown.length),
        cz: shown.reduce((sum, { at }) => sum + at.z, 0) / Math.max(1, shown.length),
        halfW: span(across) / 2 + margin,
        halfH: span(down) / 2 + margin + 1,
      };
      sun.shadow.needsUpdate = true;
      render();
      return shown.length;
    },
    /** Turn every model a quarter turn. */
    turn() {
      turns = (turns + 1) % 4;
      for (const { at, base, lid } of shown) {
        base.setPlacements([placementOf(at)]);
        lid?.setPlacements([placementOf(at, lifted ? LID_LIFT : 0)]);
      }
      render();
    },
    /** Lift the lids off (the House's roof and front walls), or put them back. */
    liftLids(on: boolean) {
      lifted = on;
      for (const { at, lid } of shown) lid?.setPlacements([placementOf(at, lifted ? LID_LIFT : 0)]);
      render();
    },
    setTheme(next: Theme) {
      theme = next;
      applyTheme(theme);
      // The sea under boats and ships darkens at Night: redraw its patches.
      if (kindShown === 'boat' || kindShown === 'ship') gallery.show(kindShown);
      else render();
    },
    /** Voxel size of the models, for reference. */
    voxel: 1 / STRUCTURE,
  };
  return gallery;
}
