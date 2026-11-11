/**
 * The Partners' ships as three.js meshes: one shared ship geometry with the
 * soft-voxel material in local space (so the seams sail with the ship), one
 * mesh per Partner, each moved along its loop by `sail(seconds)`.
 *
 * Ships cast no shadow: the sun's shadow map is static and would leave a
 * moving ship's shadow behind.
 */
import * as THREE from 'three/webgpu';
import type { World } from '../world';
import { meshVoxels, triangleCount } from './mesher';
import { LOOK } from './palette';
import { sailingPath, shipPose, type SailingPath } from './shipMotion';
import { shipVoxels, SHIP_ORIGIN } from './vesselModels';
import { voxelMaterial } from './voxelMaterial';
import { worldColours } from './worldVoxels';

/** Sailing speed, in world units (cells) per second: slow, ambient. */
export const SHIP_SPEED = 0.45;

export interface Fleet {
  group: THREE.Group;
  /** How many ships sail. */
  count: number;
  /** Triangles in all the ships together. */
  triangles: number;
  /** Put every ship where it is `seconds` after it set off. */
  sail(seconds: number): void;
  dispose(): void;
}

export function buildFleet(world: World): Fleet {
  const group = new THREE.Group();
  group.name = 'ships';
  if (world.ships.length === 0) {
    return { group, count: 0, triangles: 0, sail: () => {}, dispose: () => {} };
  }

  const colours = worldColours(world);
  const grid = shipVoxels(colours);
  const [chunk] = meshVoxels(grid, {
    colours: colours.table.colours,
    aoStrength: LOOK.aoStrength,
    chunkSize: 64,
    solidOutside: (_x, y) => y < 0,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(chunk!.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(chunk!.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(chunk!.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(chunk!.indices, 1));
  // Turn about the middle of the waterline: whole ¼ voxels, so the seams stay on the voxel edges.
  geometry.translate(-SHIP_ORIGIN.x * grid.size, -SHIP_ORIGIN.y * grid.size, -SHIP_ORIGIN.z * grid.size);
  geometry.computeBoundingSphere();
  const material = voxelMaterial(grid.size, 'local');

  const paths = new Map<World['ships'][number]['cells'], SailingPath>();
  const ships = world.ships.map((route) => {
    if (!paths.has(route.cells)) paths.set(route.cells, sailingPath(route.cells));
    const path = paths.get(route.cells)!;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'ship';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    return { mesh, path, start: route.phase * path.length };
  });

  const sail = (seconds: number) => {
    for (const { mesh, path, start } of ships) {
      const pose = shipPose(path, start + seconds * SHIP_SPEED);
      mesh.position.set(pose.x, 0, pose.z);
      // The bow is +x; a turn about y by a takes +x to (cos a, −sin a).
      mesh.rotation.y = -pose.heading;
    }
  };
  sail(0);

  return {
    group,
    count: ships.length,
    triangles: triangleCount([chunk!]) * ships.length,
    sail,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
