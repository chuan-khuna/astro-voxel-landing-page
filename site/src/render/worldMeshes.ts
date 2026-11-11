/**
 * World to three.js objects: meshes the World's voxel grids into chunked
 * `BufferGeometry` with the soft-voxel material, plus the sea and the
 * Partners' sailing ships (`ships.ts`) and the House's moving parts (`house.ts`:
 * its lid, the developer and the screen).
 */
import * as THREE from 'three/webgpu';
import type { World } from '../world';
import { triangleCount, type ChunkMesh } from './mesher';
import { oklchToLinear } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { meshWorld, type MeshedWorld } from './worldVoxels';
import { buildFleet, type Fleet } from './ships';
import { buildHouse, type HouseParts } from './house';

/** Sea cells this close to land (Chebyshev) are shallow water. */
const SHALLOW_REACH = 2;
export const SEA_LEVEL = 0.15;

export interface WorldObjects {
  group: THREE.Group;
  /** Triangles in the voxel meshes (terrain, bridges, stairs, Landmarks, boats, ships, the House's lid and developer); the sea and the screen add a handful more. */
  triangles: number;
  /** The Partners' ships, which sail: `ships.sail(seconds)` moves them. */
  ships: Fleet;
  /** The House's lid, developer and screen: `house.setOpening` lifts the lid, `house.work` animates the room. */
  house: HouseParts;
  dispose: () => void;
}

/** Build the World's three.js objects. Pass `meshed` when it was meshed elsewhere (the Web Worker). */
export function buildWorldObjects(world: World, meshed: MeshedWorld = meshWorld(world)): WorldObjects {
  const { terrain, detail, voxelSizes } = meshed;
  const group = new THREE.Group();
  const materials = [voxelMaterial(voxelSizes[0]), voxelMaterial(voxelSizes[1])];
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

  const sea = buildSea(world);
  group.add(sea.group);
  const ships = buildFleet(world);
  group.add(ships.group);
  const house = buildHouse(world);
  group.add(house.group);

  return {
    group,
    triangles: triangleCount(terrain) + triangleCount(detail) + ships.triangles + house.triangles,
    ships,
    house,
    dispose: () => {
      ships.dispose();
      house.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      sea.dispose();
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

/** Deep water as one wide plane, shallow water as one mesh of tiles beside the land. */
function buildSea(world: World): { group: THREE.Group; dispose: () => void } {
  const { width, depth, isle } = world.terrain;
  const group = new THREE.Group();
  const waterMaterial = (role: 'waterDeep' | 'waterShallow') =>
    new THREE.MeshStandardNodeMaterial({ color: linearColour(oklchToLinear(world.biome.colours[role])), roughness: 0.35 });

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
    dispose: () => {
      deepGeometry.dispose();
      shallowGeometry.dispose();
      deepMaterial.dispose();
      shallowMaterial.dispose();
    },
  };
}
