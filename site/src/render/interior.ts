/**
 * The House Interior scene (ADR 0006): the World's House opened up, with
 * its Biome's room at 1/16 unit, in a three.js scene of its own. The World
 * leaves it out, so its voxels never add to the World's.
 *
 * It stands where the House stands in the World and is drawn through the
 * World's own camera, so taking over from the World is a cut with nothing
 * moving: the House's shell (its Variant's `base`, ⅛ unit) and its ground
 * stay put, the coarse room the World showed becomes the fine one, and the
 * rest of the World gives way to the sky. In the scene:
 *
 * - the House's base and a patch of its Biome's ground round its plot;
 * - the furnished room (`interiorModel.ts`): the furniture and the
 *   developer's body as one mesh, their head and hands (`DEVELOPER_PARTS`)
 *   each a mesh of its own that `work(seconds)` animates
 *   (`houseMotion.ts`);
 * - the computer's screen, a glowing plane over the screen voxels' face
 *   that scrolls lines of code;
 * - its own light: the sun (or moon) from the World's direction with a
 *   small shadow map round the House, the sky light, and at Night a warm
 *   light at the room's lamp or fire, and the back walls' windows lit.
 */
import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import { float, floor, fract, hash, mix, step, uniform, uv, vec2, vec3 } from 'three/tsl';
import type { Oklch, World } from '@/world';
import { structureVoxels } from '@/structures/parse';
import type { StructurePart } from '@/structures/roles';
import { THEME_TOKENS } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { meshVoxels, triangleCount, VoxelGrid } from './mesher';
import { mergeChunks } from './structureMeshes';
import { FIXED_COLOURS, LOOK, oklchToLinear } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { worldColours } from './worldVoxels';
import { INTERIOR, STRUCTURE } from './voxelTiers';
import { drawHousePart, houseWindowFaces, structureColour } from './structureModels';
import { windowLights } from './house';
import { developerPose } from './houseMotion';
import { DEVELOPER_PARTS, developerBox, furnishedRoom, interiorPlacement, roomLight, screenFace, type DeveloperPart } from './interiorModel';

export interface InteriorScene {
  readonly scene: THREE.Scene;
  /** Triangles in the scene's voxel meshes. */
  readonly triangles: number;
  /** The box round the developer, in world units, for their link. */
  readonly developer: THREE.Box3;
  /** The middle of the room, in world units. */
  readonly centre: THREE.Vector3;
  /** Pose the developer and the screen `seconds` into their work. */
  work(seconds: number): void;
  /** Day or Night: the sky, the lights, and at Night the lamp and the windows. */
  setTheme(theme: Theme): void;
  dispose(): void;
}

/** Lines of code the screen scrolls a second. */
const LINES_PER_SECOND = 2.5;
/** The screen's pixel grid: columns across, rows down. */
const SCREEN_GRID = { cols: 14, rows: 7 };
/** Cells of ground round the House's plot. */
const GROUND_MARGIN = 1;
/** The warm light at the room's lamp or fire, by Night (by Day it is off). */
const LAMP = { colour: { l: 0.86, c: 0.09, h: 70 } satisfies Oklch, intensity: 6, distance: 5, lift: 0.15 };
/** How far the sun's shadow camera reaches round the room, in world units. */
const SHADOW_REACH = 4;
/** How far in front of the screen voxels the code plane sits, in world units. */
const SCREEN_LIFT = 0.002;

const setColour = (target: THREE.Color, colour: Oklch) => {
  const [r, g, b] = oklchToLinear(colour);
  target.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
};

const linear = (name: keyof typeof FIXED_COLOURS) => {
  const [r, g, b] = oklchToLinear(FIXED_COLOURS[name]);
  return vec3(r, g, b);
};

export function buildInterior(world: World): InteriorScene {
  const scene = new THREE.Scene();
  scene.name = 'house-interior';
  const sky = new THREE.Color();
  scene.background = sky;
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  const lamp = new THREE.PointLight(0xffffff, 0, LAMP.distance, 2);
  setColour(lamp.color, LAMP.colour);
  scene.add(hemisphere, sun, sun.target, lamp);

  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) throw new Error(`World ${world.seed} has no House`);
  const colours = worldColours(world);
  const room = furnishedRoom(world.biome.id);
  const at = interiorPlacement(world);
  const e = 1 / INTERIOR;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let triangles = 0;

  const roomMaterial = voxelMaterial(e, 'local');
  const shellMaterial = voxelMaterial(1 / STRUCTURE, 'local');
  const groundMaterial = voxelMaterial(1);
  materials.push(roomMaterial, shellMaterial, groundMaterial);

  const gridMesh = (name: string, grid: VoxelGrid, material: THREE.Material): THREE.Mesh => {
    const chunks = meshVoxels(grid, { colours: colours.table.colours, aoStrength: LOOK.aoStrength, chunkSize: 128, solidOutside: () => false });
    triangles += triangleCount(chunks);
    const geometry = mergeChunks(chunks);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  // The House's shell: its base (plinth, floor and back walls), as in the World.
  const shell = new VoxelGrid(1 / STRUCTURE);
  drawHousePart(world, colours, 'base', (x, y, z, colour) => shell.set(x, y, z, colour));
  gridMesh('house-shell', shell, shellMaterial);

  // The room: one mesh for what stays still, one for each of the developer's moving parts.
  const ids = room.palette.map(({ role }) => structureColour(colours, role));
  const grids = new Map<StructurePart, VoxelGrid>();
  for (const v of structureVoxels(room)) {
    let grid = grids.get(v.part);
    if (!grid) grids.set(v.part, (grid = new VoxelGrid(e)));
    grid.set(at.x + v.x, at.y + v.y, at.z + v.z, ids[v.id - 1]!);
  }
  gridMesh('room', grids.get('base')!, roomMaterial);
  const parts = new Map<DeveloperPart, THREE.Mesh>();
  for (const part of DEVELOPER_PARTS) {
    const grid = grids.get(part);
    if (!grid) continue;
    // Moving parts cast no shadow: the shadow map is drawn once.
    const mesh = gridMesh(`developer-${part}`, grid, roomMaterial);
    mesh.castShadow = false;
    parts.set(part, mesh);
  }

  // Ground: a slab of the Biome's grass under the plot and a cell round it, its top at the House's floor.
  const { origin } = house.footprint;
  const plot = { x: origin.x - GROUND_MARGIN, z: origin.z - GROUND_MARGIN, w: house.footprint.width + 2 * GROUND_MARGIN, d: house.footprint.depth + 2 * GROUND_MARGIN };
  const groundGeometry = new THREE.BoxGeometry(plot.w, 1, plot.d);
  const [gr, gg, gb] = colours.table.colours[colours.biome('grass')]!;
  const groundColours = new Float32Array(groundGeometry.attributes.position!.count * 3);
  for (let i = 0; i < groundColours.length; i += 3) groundColours.set([gr, gg, gb], i);
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColours, 3));
  groundGeometry.translate(plot.x + plot.w / 2, house.y - 0.5, plot.z + plot.d / 2);
  geometries.push(groundGeometry);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'ground';
  ground.receiveShadow = true;
  scene.add(ground);

  // The screen: a plane a hair in front of the screen voxels' +x face; its u runs along −z.
  const face = screenFace(room);
  const screenGeometry = new THREE.PlaneGeometry((face.z1 - face.z0) * e, (face.y1 - face.y0) * e);
  screenGeometry.rotateY(Math.PI / 2);
  screenGeometry.translate((at.x + face.x) * e + SCREEN_LIFT, (at.y + (face.y0 + face.y1) / 2) * e, (at.z + (face.z0 + face.z1) / 2) * e);
  geometries.push(screenGeometry);
  const time = uniform(0);
  const screenMaterial = new THREE.MeshBasicNodeMaterial();
  screenMaterial.colorNode = codeScreen(time);
  materials.push(screenMaterial);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.name = 'screen';
  scene.add(screen);

  // The back walls' windows, lit at Night.
  const windowMaterial = new THREE.MeshBasicNodeMaterial();
  materials.push(windowMaterial);
  const baseFaces = houseWindowFaces(world).filter((f) => f.part === 'base');
  const windows = new THREE.Mesh(windowLights(baseFaces), windowMaterial);
  geometries.push(windows.geometry);
  windows.name = 'house-light-base';
  windows.visible = false;
  scene.add(windows);

  // The room's middle, the warm light at its lamp or fire, and the sun aimed at the House.
  const centre = new THREE.Vector3((at.x + room.size.x / 2) * e, (at.y + room.size.y / 2) * e, (at.z + room.size.z / 2) * e);
  const light = roomLight(room);
  lamp.position.set((at.x + light.x) * e, (at.y + light.y) * e + LAMP.lift, (at.z + light.z) * e);
  const az = THREE.MathUtils.degToRad(LOOK.sunAzimuth);
  const el = THREE.MathUtils.degToRad(LOOK.sunElevation);
  const reach = SHADOW_REACH;
  sun.position.copy(centre).add(new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(reach * 2));
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: reach * 4 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 3;
  // Nothing that casts a shadow moves: one shadow map, drawn on the first frame.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;

  const box = developerBox(room);
  const developer = new THREE.Box3(
    new THREE.Vector3((at.x + box.min.x) * e, (at.y + box.min.y) * e, (at.z + box.min.z) * e),
    new THREE.Vector3((at.x + box.max.x) * e, (at.y + box.max.y) * e, (at.z + box.max.z) * e),
  );

  return {
    scene,
    triangles,
    developer,
    centre,
    work: (seconds) => {
      const pose = developerPose(seconds);
      for (const [part, mesh] of parts) mesh.position.y = pose[part].y;
      time.value = seconds;
    },
    setTheme: (theme) => {
      const tokens = THEME_TOKENS[theme].world;
      setColour(sky, tokens.sky);
      setColour(hemisphere.color, tokens.skyLight);
      setColour(hemisphere.groundColor, tokens.groundLight);
      hemisphere.intensity = tokens.skyIntensity;
      setColour(sun.color, tokens.sunLight);
      sun.intensity = tokens.sunIntensity;
      lamp.intensity = tokens.lightsOn ? LAMP.intensity : 0;
      setColour(windowMaterial.color, tokens.windowLight);
      windows.visible = tokens.lightsOn;
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/**
 * Lines of code on a dark screen, drawn as a coarse pixel grid: each line
 * indented and as long as a hash of its number says, in one of three
 * muted syntax colours, with gaps between words and the odd blank line.
 * The text scrolls up a line at a time as `time` grows.
 */
function codeScreen(time: UniformNode<'float'>) {
  const { cols, rows } = SCREEN_GRID;
  const p = uv().mul(vec2(cols, rows));
  const cell = floor(p);
  const f = fract(p);
  // Line number from the top, scrolled.
  const line = float(rows - 1)
    .sub(cell.y)
    .add(floor(time.mul(LINES_PER_SECOND)));
  const indent = floor(hash(line.mul(3.1)).mul(3)).add(1);
  const length = indent.add(3).add(floor(hash(line.add(17)).mul(cols - 6)));
  const word = step(0.18, hash(line.mul(31).add(cell.x.mul(7))));
  const blank = step(0.15, hash(line.add(5)));
  const on = step(indent, cell.x).mul(step(cell.x, length)).mul(word).mul(blank);
  // A gap round every pixel, so the text reads as pixels.
  const lit = step(0.12, f.x).mul(step(f.x, 0.88)).mul(step(0.18, f.y)).mul(step(f.y, 0.82));
  const h = hash(line.mul(7.7));
  const ink = mix(mix(linear('shirt'), linear('bougainLight'), step(0.55, h)), linear('whitewash'), step(0.85, h));
  return mix(linear('screenDark').mul(1.4), ink.mul(1.15), on.mul(lit));
}
