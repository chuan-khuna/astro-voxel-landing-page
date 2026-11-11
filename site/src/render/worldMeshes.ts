/**
 * World to three.js objects: meshes the World's voxel grids into chunked
 * `BufferGeometry` with the soft-voxel material, plus the sea, the
 * Partners' sailing ships (`ships.ts`), the House's moving parts (`house.ts`:
 * its lid and its lights), the Garden's plants (`garden.ts`, instanced) and
 * the buoys' lamps. The House Interior is a
 * scene of its own (`interior.ts`).
 * `setTheme` recolours the sea and lights the lamps and the House's windows
 * at Night; it never moves or adds anything.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import { triangleCount, type ChunkMesh } from './mesher';
import { oklchToLinear } from './palette';
import { seaColour, THEME_TOKENS, type WorldTokens } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { buoyLamp } from './buoyModel';
import { voxelMaterial } from './voxelMaterial';
import { meshWorld, type MeshedWorld } from './worldVoxels';
import { buildFleet, type Fleet } from './ships';
import { buildHouse, type HouseParts } from './house';
import { buildGardenPlants } from './garden';

/** Sea cells this close to land (Chebyshev) are shallow water. */
const SHALLOW_REACH = 2;
export const SEA_LEVEL = 0.15;

export interface WorldObjects {
  group: THREE.Group;
  /** Triangles in the voxel meshes (terrain, bridges, stairs, Landmarks and the House's structure and room, boats, ships, the House's lid, the Garden's plants); the sea adds a handful more. */
  triangles: number;
  /** The Partners' ships, which sail: `ships.sail(seconds)` moves them. */
  ships: Fleet;
  /** The House's lid and its lights: `house.setOpening` lifts the lid. */
  house: HouseParts;
  /** Recolour the sea and light (or put out) the House's windows and the buoys' lamps. */
  setTheme: (theme: Theme) => void;
  dispose: () => void;
}

/** Build the World's three.js objects. Pass `meshed` when it was meshed elsewhere (the Web Worker). */
export function buildWorldObjects(world: World, meshed: MeshedWorld = meshWorld(world)): WorldObjects {
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

  const sea = buildSea(world);
  group.add(sea.group);
  const ships = buildFleet(world);
  group.add(ships.group);
  const house = buildHouse(world);
  group.add(house.group);
  const lamps = buildLamps(world);
  group.add(lamps.group);
  const plants = buildGardenPlants(world);
  group.add(plants.group);

  return {
    group,
    triangles: triangleCount(terrain) + triangleCount(detail) + triangleCount(structure) + ships.triangles + house.triangles + plants.triangles,
    ships,
    house,
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

/** Deep water as one wide plane, shallow water as one mesh of tiles beside the land. Darker at Night. */
function buildSea(world: World): { group: THREE.Group; setTheme: (theme: Theme) => void; dispose: () => void } {
  const { width, depth, isle } = world.terrain;
  const group = new THREE.Group();
  const waterMaterial = (role: 'waterDeep' | 'waterShallow') =>
    new THREE.MeshStandardNodeMaterial({ color: linearColour(oklchToLinear(seaColour(world.biome, role, 'day'))), roughness: 0.35 });

  // Far wider than the grid so the sea fills the frame at any aspect ratio.
  const deepGeometry = new THREE.PlaneGeometry(width * 6, depth * 6);
  deepGeometry.rotateX(-Math.PI / 2);
  deepGeometry.translate(width / 2, SEA_LEVEL, depth / 2);
  const deepMaterial = waterMaterial('waterDeep');
  const deep = new THREE.Mesh(deepGeometry, deepMaterial);
  deep.receiveShadow = true;
  group.add(deep);

  const nearLand = (x: number, z: number) => {
    for (let dz = -SHALLOW_REACH; dz <= SHALLOW_REACH; dz++) {
      for (let dx = -SHALLOW_REACH; dx <= SHALLOW_REACH; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < width && nz < depth && isle[nz * width + nx] !== -1) return true;
      }
    }
    return false;
  };
  const positions: number[] = [];
  const indices: number[] = [];
  const y = SEA_LEVEL + 0.01;
  for (let z = 0; z < depth; z++) {
    // Merge runs of shallow cells along x into one quad.
    for (let x = 0; x < width; ) {
      if (!(isle[z * width + x] === -1 && nearLand(x, z))) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < width && isle[z * width + x + run] === -1 && nearLand(x + run, z)) run++;
      const base = positions.length / 3;
      positions.push(x, y, z, x, y, z + 1, x + run, y, z + 1, x + run, y, z);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      x += run;
    }
  }
  const shallowGeometry = new THREE.BufferGeometry();
  shallowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shallowGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  shallowGeometry.setIndex(indices);
  const shallowMaterial = waterMaterial('waterShallow');
  const shallow = new THREE.Mesh(shallowGeometry, shallowMaterial);
  shallow.receiveShadow = true;
  group.add(shallow);

  return {
    group,
    setTheme: (theme) => {
      deepMaterial.color.copy(linearColour(oklchToLinear(seaColour(world.biome, 'waterDeep', theme))));
      shallowMaterial.color.copy(linearColour(oklchToLinear(seaColour(world.biome, 'waterShallow', theme))));
    },
    dispose: () => {
      deepGeometry.dispose();
      shallowGeometry.dispose();
      deepMaterial.dispose();
      shallowMaterial.dispose();
    },
  };
}
