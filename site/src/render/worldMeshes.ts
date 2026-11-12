/**
 * World to three.js objects: meshes the World's voxel grids into chunked
 * `BufferGeometry` with the soft-voxel material, plus the sea (a 1-unit
 * voxel layer that bobs, `seaModel.ts` and `seaMaterial.ts`), the
 * Partners' sailing ships (`ships.ts`) and the Clients' moored boats
 * (`boats.ts`), both instanced, the House's moving parts (`house.ts`:
 * its lid, its lights and the House Interior's room at 1/16 unit, shown
 * while the lid is up), the Garden's plants (`garden.ts`, instanced), the
 * Decoration (`decoration.ts`, instanced, thinned on the reduced tier) and
 * the buoys' lamps.
 * `setTheme` recolours the sea and lights the lamps and the House's windows
 * at Night; it never moves or adds anything.
 *
 * Everything that moves on its own runs on the shared Ambient Life clock
 * (`ambientClock.ts`): the sea bobs from its time uniform in the shader, and
 * `step(seconds)` puts what moves on the CPU (the Partners' ships, the
 * developer at work in the House) where it is at the clock's `seconds`. Ambient Life parts add their own motion to
 * `step`, or read the clock's uniforms in their materials.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import { triangleCount, type ChunkMesh } from './mesher';
import { oklchToLinear, shiftLightness } from './palette';
import { seaColour, THEME_TOKENS, type WorldTokens } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { buoyLamp } from './buoyModel';
import { voxelMaterial } from './voxelMaterial';
import { meshWorld, type MeshedWorld } from './worldVoxels';
import { buildFleet, type Fleet } from './ships';
import { buildHouse, type HouseParts } from './house';
import { buildGardenPlants } from './garden';
import { buildBoats } from './boats';
import { buildDecoration } from './decoration';
import type { RenderTierName } from '@/lib/renderTier';
import { seaModel, type SeaMesh } from './seaModel';
import { seaMaterial } from './seaMaterial';
import { createAmbientClock, type AmbientClock } from './ambientClock';

export interface WorldObjects {
  group: THREE.Group;
  /** Triangles in the voxel meshes (terrain, bridges, stairs, Landmarks and the House's structure, boats, ships, the House's lid, the Garden's plants, the Decoration the tier shows) and the sea's water and seabed; not the House's room, drawn only while the lid is up (`house.roomTriangles`). */
  triangles: number;
  /** The Partners' ships, which sail (`step` moves them). */
  ships: Fleet;
  /** The House's lid, its lights and its room: `house.setOpening` lifts the lid and shows the room. */
  house: HouseParts;
  /** Put everything that moves on the CPU (the ships, the developer) where it is at the shared clock's `seconds`. */
  step: (seconds: number) => void;
  /** Recolour the sea and light (or put out) the House's windows and lamp and the buoys' lamps. */
  setTheme: (theme: Theme) => void;
  dispose: () => void;
}

/**
 * Build the World's three.js objects. Pass `meshed` when it was meshed
 * elsewhere (the Web Worker). The render tier only thins the Decoration
 * (`decorationModels.ts`); every Landmark is the same on every tier. `clock`
 * is the shared Ambient Life clock; by default a clock of its own, frozen at 0.
 */
export function buildWorldObjects(
  world: World,
  meshed: MeshedWorld = meshWorld(world),
  tier: RenderTierName = 'full',
  clock: AmbientClock = createAmbientClock(),
): WorldObjects {
  const { terrain, detail, structure, voxelSizes } = meshed;
  const group = new THREE.Group();
  const materials = voxelSizes.map((size) => voxelMaterial(size));
  const geometries: THREE.BufferGeometry[] = [];

  const addChunks = (chunks: ChunkMesh[], material: THREE.Material, name: string) => {
    for (const chunk of chunks) {
      const geometry = chunkGeometry(chunk);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  };
  addChunks(terrain, materials[0]!, 'terrain');
  addChunks(detail, materials[1]!, 'detail');
  addChunks(structure, materials[2]!, 'structure');

  const sea = buildSea(world, clock);
  group.add(sea.group);
  const ships = buildFleet(world);
  group.add(ships.group);
  const house = buildHouse(world, clock);
  group.add(house.group);
  const lamps = buildLamps(world);
  group.add(lamps.group);
  const plants = buildGardenPlants(world);
  group.add(plants.group);
  const boats = buildBoats(world);
  group.add(boats.group);
  const decoration = buildDecoration(world, tier);
  group.add(decoration.group);

  return {
    group,
    triangles: triangleCount(terrain) + triangleCount(detail) + triangleCount(structure) + ships.triangles + boats.triangles + house.triangles + plants.triangles + decoration.triangles + sea.triangles,
    ships,
    house,
    step: (seconds) => {
      ships.sail(seconds);
      house.work(seconds);
    },
    setTheme: (theme) => {
      const tokens = THEME_TOKENS[theme].world;
      sea.setTheme(theme);
      house.setLights(tokens);
      lamps.setLights(tokens);
    },
    dispose: () => {
      ships.dispose();
      house.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      sea.dispose();
      lamps.dispose();
      plants.dispose();
      boats.dispose();
      decoration.dispose();
    },
  };
}

function chunkGeometry(chunk: ChunkMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(chunk.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(chunk.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(chunk.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(chunk.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

const linearColour = (rgb: readonly [number, number, number]) =>
  new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);

/** How much bigger than its voxel a buoy's glowing lamp is, in world units each side: it covers the voxel's seams. */
const LAMP_GROW = 0.01;

/** The buoys' lamps: one glowing box over each lamp voxel (a few at most), shown at Night. */
function buildLamps(world: World): { group: THREE.Group; setLights: (tokens: WorldTokens) => void; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'buoy-lamps';
  group.visible = false;
  const material = new THREE.MeshBasicNodeMaterial();
  const geometries = world.buoys.map((cell) => {
    const { min, max } = buoyLamp(cell);
    const geometry = new THREE.BoxGeometry(
      max.x - min.x + 2 * LAMP_GROW,
      max.y - min.y + 2 * LAMP_GROW,
      max.z - min.z + 2 * LAMP_GROW,
    );
    geometry.translate((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    group.add(new THREE.Mesh(geometry, material));
    return geometry;
  });
  return {
    group,
    setLights: ({ lightsOn, buoyLight }) => {
      material.color.copy(linearColour(oklchToLinear(buoyLight)));
      group.visible = lightsOn;
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      material.dispose();
    },
  };
}

/** How much darker than the Biome's sand the seabed is (OKLCH lightness): wet sand under the water. */
const SEABED_SHIFT = -0.1;

/**
 * The sea: a 1-unit voxel layer of water (`seaModel.ts`) that bobs in the
 * shader (`seaMaterial.ts`), and the seabed seen through its shallows.
 * Darker at Night. The water bobs on the shared clock.
 */
function buildSea(world: World, clock: AmbientClock): {
  group: THREE.Group;
  triangles: number;
  setTheme: (theme: Theme) => void;
  dispose: () => void;
} {
  const model = seaModel(world);
  const group = new THREE.Group();
  group.name = 'sea';

  /** Add one of the sea's meshes: never moved (the sea's material takes its own space as world space), receiving shadows. */
  const addMesh = (mesh: SeaMesh, material: THREE.Material, name: string) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setAttribute('seaCell', new THREE.BufferAttribute(mesh.cells, 3));
    geometry.setAttribute('seaShade', new THREE.BufferAttribute(mesh.shades, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingSphere();
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.receiveShadow = true;
    object.matrixAutoUpdate = false;
    group.add(object);
    return geometry;
  };
  const water = seaMaterial(clock);
  const waterGeometry = addMesh(model.water, water.material, 'water');
  const seabedMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const seabedGeometry = addMesh(model.seabed, seabedMaterial, 'seabed');

  return {
    group,
    triangles: model.water.triangles + model.seabed.triangles,
    setTheme: (theme) => {
      water.shallow.value.set(...oklchToLinear(seaColour(world.biome, 'waterShallow', theme)));
      water.deep.value.set(...oklchToLinear(seaColour(world.biome, 'waterDeep', theme)));
      const shift = THEME_TOKENS[theme].world.waterShift + SEABED_SHIFT;
      seabedMaterial.color.copy(linearColour(oklchToLinear(shiftLightness(world.biome.colours.sand, shift))));
    },
    dispose: () => {
      waterGeometry.dispose();
      seabedGeometry.dispose();
      water.material.dispose();
      seabedMaterial.dispose();
    },
  };
}
