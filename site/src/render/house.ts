/**
 * The House's moving parts in the World as three.js meshes (its base is
 * static, in the World's structure grid; see `structureModels.ts`):
 *
 * - the lid (the House Variant's `lid` part: its roof and front walls),
 *   which `setOpening` lifts off;
 * - the House's lights: a glowing square over each open face of window
 *   glass (`houseWindowFaces`), shown at Night (`setLights`). The lid's
 *   lights lift with it;
 * - the House Interior's room (`interiorModel.ts`) at its own 1/16 unit:
 *   the furniture and the developer's body as one mesh, their head and
 *   hands (`DEVELOPER_PARTS`) each a mesh of its own that `work(seconds)`
 *   animates (`houseMotion.ts`), and the computer's screen, a glowing plane
 *   that scrolls lines of code on the shared clock. The room shows only
 *   while the lid is lifted or lifting, so a shut House draws none of it,
 *   and it is the same room at every stage of opening: nothing in it ever
 *   changes resolution. At Night its lamp or fire lights it warmly: a light
 *   worked out in the room's own material (`roomLamp`), so the rest of the
 *   World pays nothing for it.
 *
 * The lid and the room use the soft-voxel material in local space, built at
 * the House's place in the World (whole voxels), so seams stay on voxel
 * edges and travel with what moves. The lid and the room's furniture cast
 * shadows (the sun's shadow map is redrawn while the lid moves, and the
 * room shows or hides only then); the developer's head and hands do not,
 * since the map is not redrawn as they move.
 */
import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import { clamp, diffuseColor, dot, float, floor, fract, hash, length, max, mix, normalWorld, normalize, positionWorld, step, uniform, uv, vec2, vec3 } from 'three/tsl';
import type { Oklch, World } from '@/world';
import { structureVoxels } from '@/structures/parse';
import type { StructurePart } from '@/structures/roles';
import type { WorldTokens } from '@/data/theme';
import { meshVoxels, triangleCount, VoxelGrid } from './mesher';
import { mergeChunks } from './structureMeshes';
import { FIXED_COLOURS, LOOK, oklchToLinear } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { worldColours } from './worldVoxels';
import { INTERIOR, STRUCTURE } from './voxelTiers';
import { drawHousePart, houseWindowFaces, structureColour } from './structureModels';
import { developerPose, roofLift } from './houseMotion';
import { DEVELOPER_PARTS, developerBounds, furnishedRoom, interiorPlacement, roomLight, screenFace, type DeveloperPart } from './interiorModel';
import { createAmbientClock, type AmbientClock } from './ambientClock';

export interface HouseParts {
  group: THREE.Group;
  /** Triangles in the lid. */
  triangles: number;
  /** Triangles in the room (furniture, developer and screen), drawn only while the lid is up or moving. */
  roomTriangles: number;
  /** The box round the developer, in world units, for their link to Team; null for a World with no House. */
  developer: THREE.Box3 | null;
  /** The lid's mesh (it lifts), for its outline (`outlineModels.ts`); null for a World with no House. */
  lid: THREE.Mesh | null;
  /** The developer's moving parts (head, hands), for their outline; their body is in the room's mesh. */
  developerParts: THREE.Mesh[];
  /** Lift the lid: 0 shut, 1 fully open. The room shows whenever it is above 0. */
  setOpening(opening: number): void;
  /** Light the windows and the room's lamp, or not, as the theme says. */
  setLights(world: WorldTokens): void;
  /** Pose the developer `seconds` into their work (the shared clock's seconds). */
  work(seconds: number): void;
  dispose(): void;
}

/** Lines of code the screen scrolls a second. */
const LINES_PER_SECOND = 2.5;
/** The screen's pixel grid: columns across, rows down. */
const SCREEN_GRID = { cols: 14, rows: 7 };
/** How far in front of the screen voxels the code plane sits, in world units. */
const SCREEN_LIFT = 0.002;
/**
 * The warm light at the room's lamp or fire, by Night: its colour, its
 * strength (as a three.js point light's, in candela), how far it reaches
 * and how far above the lamp's voxels it sits, in world units.
 */
const LAMP = { colour: { l: 0.86, c: 0.09, h: 70 } satisfies Oklch, intensity: 6, distance: 5, lift: 0.15 };

const linear = (colour: Oklch) => {
  const [r, g, b] = oklchToLinear(colour);
  return vec3(r, g, b);
};

export function buildHouse(world: World, clock: AmbientClock = createAmbientClock()): HouseParts {
  const group = new THREE.Group();
  group.name = 'house';
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) return { group, triangles: 0, roomTriangles: 0, developer: null, lid: null, developerParts: [], setOpening: () => {}, setLights: () => {}, work: () => {}, dispose: () => {} };

  const colours = worldColours(world);
  const lidMaterial = voxelMaterial(1 / STRUCTURE, 'local');
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [lidMaterial];

  /** A grid's voxels as one mesh, and its triangles. */
  const gridMesh = (name: string, grid: VoxelGrid, meshMaterial: THREE.Material): [THREE.Mesh, number] => {
    const chunks = meshVoxels(grid, {
      colours: colours.table.colours,
      aoStrength: LOOK.aoStrength,
      chunkSize: 128,
      solidOutside: () => false,
    });
    const geometry = mergeChunks(chunks);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return [mesh, triangleCount(chunks)];
  };
  const lidGrid = new VoxelGrid(1 / STRUCTURE);
  drawHousePart(world, colours, 'lid', (x, y, z, colour) => lidGrid.set(x, y, z, colour));
  const [lid, triangles] = gridMesh('house-lid', lidGrid, lidMaterial);
  group.add(lid);

  // The lights: a glowing square a hair in front of each open face of window glass,
  // one mesh for the lid's (its child, so they lift with it) and one for the base's.
  const lightMaterial = new THREE.MeshBasicNodeMaterial();
  materials.push(lightMaterial);
  const panes: THREE.Mesh[] = [];
  const faces = houseWindowFaces(world);
  for (const part of ['lid', 'base'] as const) {
    const own = faces.filter((face) => face.part === part);
    if (own.length === 0) continue;
    const geometry = windowLights(own);
    geometries.push(geometry);
    const pane = new THREE.Mesh(geometry, lightMaterial);
    pane.name = `house-light-${part}`;
    pane.visible = false;
    panes.push(pane);
    (part === 'lid' ? lid : group).add(pane);
  }

  // The room, at 1/16 unit: hidden while the House is shut.
  const room = new THREE.Group();
  room.name = 'house-room';
  room.visible = false;
  group.add(room);
  const furnished = furnishedRoom(world.biome.id);
  const at = interiorPlacement(world);
  const e = 1 / INTERIOR;
  const light = roomLight(furnished);
  const lampOn = uniform(0);
  const roomMaterial = voxelMaterial(e, 'local');
  roomMaterial.emissiveNode = roomLamp(new THREE.Vector3((at.x + light.x) * e, (at.y + light.y) * e + LAMP.lift, (at.z + light.z) * e), lampOn);
  materials.push(roomMaterial);
  let roomTriangles = 0;

  // One mesh for what stays still, one for each of the developer's moving parts.
  const ids = furnished.palette.map(({ role }) => structureColour(colours, role));
  const grids = new Map<StructurePart, VoxelGrid>();
  for (const v of structureVoxels(furnished)) {
    let grid = grids.get(v.part);
    if (!grid) grids.set(v.part, (grid = new VoxelGrid(e)));
    grid.set(at.x + v.x, at.y + v.y, at.z + v.z, ids[v.id - 1]!);
  }
  const roomMesh = (name: string, grid: VoxelGrid) => {
    const [mesh, count] = gridMesh(name, grid, roomMaterial);
    roomTriangles += count;
    room.add(mesh);
    return mesh;
  };
  roomMesh('room', grids.get('base')!);
  const parts = new Map<DeveloperPart, THREE.Mesh>();
  for (const part of DEVELOPER_PARTS) {
    const grid = grids.get(part);
    if (!grid) continue;
    const mesh = roomMesh(`developer-${part}`, grid);
    mesh.castShadow = false;
    parts.set(part, mesh);
  }

  // The screen: a plane a hair in front of the screen voxels' +x face; its u runs along −z.
  const face = screenFace(furnished);
  const screenGeometry = new THREE.PlaneGeometry((face.z1 - face.z0) * e, (face.y1 - face.y0) * e);
  screenGeometry.rotateY(Math.PI / 2);
  screenGeometry.translate((at.x + face.x) * e + SCREEN_LIFT, (at.y + (face.y0 + face.y1) / 2) * e, (at.z + (face.z0 + face.z1) / 2) * e);
  geometries.push(screenGeometry);
  const screenMaterial = new THREE.MeshBasicNodeMaterial();
  screenMaterial.colorNode = codeScreen(clock.time);
  materials.push(screenMaterial);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.name = 'screen';
  room.add(screen);
  roomTriangles += 2;

  const { min, max } = developerBounds(world);
  const developer = new THREE.Box3(new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, max.y, max.z));

  return {
    group,
    triangles,
    roomTriangles,
    developer,
    lid,
    developerParts: [...parts.values()],
    setLights: ({ lightsOn, windowLight }) => {
      const [r, g, b] = oklchToLinear(windowLight);
      lightMaterial.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      for (const pane of panes) pane.visible = lightsOn;
      lampOn.value = lightsOn ? 1 : 0;
    },
    setOpening: (opening) => {
      lid.position.y = roofLift(opening);
      room.visible = opening > 0;
    },
    work: (seconds) => {
      const pose = developerPose(seconds);
      for (const [part, mesh] of parts) mesh.position.y = pose[part].y;
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

/**
 * The warm light of the room's lamp or fire at `at` (world units), as the
 * room's emissive term: what a three.js point light there (`LAMP`, no
 * shadow) would add to a diffuse surface, worked out in this material only.
 * `on` is 1 by Night and 0 by Day.
 */
function roomLamp(at: THREE.Vector3, on: UniformNode<'float'>) {
  const toLamp = vec3(at.x, at.y, at.z).sub(positionWorld);
  const d = length(toLamp);
  // three's punctual light falloff: inverse square, eased to nothing at `distance`.
  const cutoff = clamp(float(1).sub(d.div(LAMP.distance).pow(4)), 0, 1).pow(2);
  const falloff = cutoff.div(max(d.mul(d), 0.01));
  const facing = max(dot(normalWorld, normalize(toLamp)), 0);
  // Lambert: the diffuse colour over π.
  return diffuseColor.rgb
    .mul(linear(LAMP.colour))
    .mul(on.mul(LAMP.intensity / Math.PI))
    .mul(falloff)
    .mul(facing);
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
  const fixed = (name: keyof typeof FIXED_COLOURS) => linear(FIXED_COLOURS[name]);
  const ink = mix(mix(fixed('shirt'), fixed('bougainLight'), step(0.55, h)), fixed('whitewash'), step(0.85, h));
  return mix(fixed('screenDark').mul(1.4), ink.mul(1.15), on.mul(lit));
}

/** How far in front of the glass a window's light sits, in world units. */
const LIGHT_LIFT = 0.003;

/** One square per lit window face (⅛ voxels), a hair in front of the glass. */
function windowLights(faces: ReturnType<typeof houseWindowFaces>): THREE.BufferGeometry {
  const e = 1 / STRUCTURE;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { x, y, z, facing } of faces) {
    const base = positions.length / 3;
    if (facing === '+x') {
      const px = (x + 1) * e + LIGHT_LIFT;
      positions.push(px, y * e, (z + 1) * e, px, y * e, z * e, px, (y + 1) * e, z * e, px, (y + 1) * e, (z + 1) * e);
    } else {
      const pz = (z + 1) * e + LIGHT_LIFT;
      positions.push(x * e, y * e, pz, (x + 1) * e, y * e, pz, (x + 1) * e, (y + 1) * e, pz, x * e, (y + 1) * e, pz);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
