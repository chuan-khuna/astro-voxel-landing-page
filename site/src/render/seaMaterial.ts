/**
 * The sea's TSL material (`seaModel.ts` builds its geometry): the
 * soft-voxel look at 1 unit (`softVoxelLook`), coloured from the Biome's
 * shallow to deep water by each voxel's `deep`, translucent by its
 * `opacity`, and bobbing in the vertex shader.
 *
 * The bob: each voxel rises and falls `SEA_BOB` round the sea level, once
 * every `SWELL_PERIOD` seconds, out of step with its neighbours (a hash of
 * its cell) and with a slow swell running across the sea (its x + z). Only
 * vertices marked to bob move, by the voxel's swell. `time` drives it; the
 * runtime advances it only while motion is allowed, so under reduced motion
 * the sea holds still (at time 0 on a fresh page, never flat: the voxels
 * keep their steps).
 *
 * Seams and bevels are measured at the vertex's place before the bob, so
 * they ride with the voxel.
 */
import * as THREE from 'three/webgpu';
import { attribute, hash, mix, normalGeometry, positionGeometry, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { softVoxelLook } from './voxelMaterial';
import { SEA_BOB, SEA_LEVEL } from './seaModel';
import { TERRAIN } from './voxelTiers';

/** Seconds a water voxel takes to rise, sink and rise again. */
export const SWELL_PERIOD = 4.5;
/** Radians the swell's phase turns per cell along x + z: a slow wave across the sea. */
const SWELL_STRIDE = 0.55;

export interface SeaMaterial {
  material: THREE.MeshStandardNodeMaterial;
  /** Seconds of swell: set it to move the water. */
  time: { value: number };
  /** The Biome's shallow and deep water, in linear RGB (set them for the theme). */
  shallow: { value: THREE.Vector3 };
  deep: { value: THREE.Vector3 };
}

export function seaMaterial(): SeaMaterial {
  const time = uniform(0);
  const shallow = uniform(new THREE.Vector3());
  const deep = uniform(new THREE.Vector3());
  const cell = attribute('seaCell', 'vec3');
  const shade = attribute('seaShade', 'vec3');
  const cellX = cell.x;
  const cellZ = cell.y;
  /** 1 where the vertex bobs with its voxel, 0 where it stays put. */
  const lift = cell.z;
  const deepness = shade.x;
  const opacity = shade.y;
  const swell = shade.z;

  const seed = cellX.add(512).add(cellZ.add(512).mul(1024));
  const phase = hash(seed).mul(Math.PI).add(cellX.add(cellZ).mul(SWELL_STRIDE));
  const bob = sin(time.mul((2 * Math.PI) / SWELL_PERIOD).add(phase)).mul(SEA_BOB).mul(swell).mul(lift);

  // The sea's meshes are never moved, so their own space is world space.
  const look = softVoxelLook(1 / TERRAIN, normalGeometry, positionGeometry.sub(vec3(0, SEA_LEVEL, 0)));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0, transparent: true });
  material.positionNode = positionLocal.add(vec3(0, bob, 0));
  material.normalNode = look.normalNode;
  material.colorNode = look.shade(mix(shallow, deep, deepness));
  material.opacityNode = opacity;
  return { material, time, shallow, deep };
}
