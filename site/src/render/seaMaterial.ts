/**
 * The sea's TSL material (`seaModel.ts` builds its geometry): the
 * soft-voxel look at 1 unit (`softVoxelLook`), coloured from the Biome's
 * shallow to deep water by each voxel's `deep`, translucent by its
 * `opacity`, and bobbing in the vertex shader.
 *
 * The bob: each voxel rises and falls `SEA_BOB` round the sea level, once
 * every `SWELL_PERIOD` seconds, out of step with its neighbours (a hash of
 * its cell) and with a slow swell running across the sea (its x + z). Only
 * vertices marked to bob move, by the voxel's swell. The shared Ambient Life
 * clock (`ambientClock.ts`) drives it, so it holds still wherever the clock
 * is frozen: under reduced motion, at the still tier, and at time 0 on a
 * fresh page or in a still (never flat: the voxels keep their steps). The
 * swell's period and stride are shared with the boats and ships riding it
 * (`swell.ts`).
 *
 * Seams and bevels are measured at the vertex's place before the bob, so
 * they ride with the voxel. The clouds' shadows drift across it
 * (`cloudShadow.ts`).
 */
import * as THREE from 'three/webgpu';
import { attribute, hash, mix, normalGeometry, positionGeometry, positionLocal, positionWorld, sin, uniform, vec3 } from 'three/tsl';
import { cloudShade } from './cloudShadow';
import { softVoxelLook } from './voxelMaterial';
import { SEA_BOB, SEA_LEVEL } from './seaModel';
import { TERRAIN } from './voxelTiers';
import { SWELL_PERIOD, SWELL_STRIDE } from './swell';
import type { AmbientClock } from './ambientClock';

export interface SeaMaterial {
  material: THREE.MeshStandardNodeMaterial;
  /** The Biome's shallow and deep water, in linear RGB (set them for the theme). */
  shallow: { value: THREE.Vector3 };
  deep: { value: THREE.Vector3 };
}

export function seaMaterial(clock: AmbientClock): SeaMaterial {
  const { time } = clock;
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

  // The same seed and phase as `seaCellSeed` and `seaVoxelPhase` (`swell.ts`), which the vessels ride.
  const seed = cellX.add(512).add(cellZ.add(512).mul(1024));
  const phase = hash(seed).mul(Math.PI).add(cellX.add(cellZ).mul(SWELL_STRIDE));
  const bob = sin(time.mul((2 * Math.PI) / SWELL_PERIOD).add(phase)).mul(SEA_BOB).mul(swell).mul(lift);

  // The sea's meshes are never moved, so their own space is world space.
  const look = softVoxelLook(1 / TERRAIN, normalGeometry, positionGeometry.sub(vec3(0, SEA_LEVEL, 0)));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0, transparent: true });
  material.positionNode = positionLocal.add(vec3(0, bob, 0));
  material.normalNode = look.normalNode;
  // Passing clouds shade the water (`cloudShadow.ts`).
  material.colorNode = look.shade(mix(shallow, deep, deepness)).mul(cloudShade(positionWorld));
  material.opacityNode = opacity;
  return { material, shallow, deep };
}
