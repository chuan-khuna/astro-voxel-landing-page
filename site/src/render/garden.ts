/**
 * The Garden's plants as three.js objects: one `InstancedMesh` per plant
 * structure (the Biome's tree, each of its flowers), one instance per
 * plant, standing in its cell on the Garden's ground (`gardenPlants.ts`),
 * swaying in the shared clock's wind (`windSway.ts`).
 * The Garden's fence is in the World's structure grid with the other
 * Landmarks.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { gardenPlantsOf, plantPlacement } from './gardenPlants';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { worldColours } from './worldVoxels';
import { swayMaterial } from './windSway';
import type { AmbientClock } from './ambientClock';

export function buildGardenPlants(world: World, clock: AmbientClock): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'garden-plants';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const plant of gardenPlantsOf(world)) {
    const placements = byStructure.get(plant.structure) ?? [];
    placements.push(plantPlacement(world, plant));
    byStructure.set(plant.structure, placements);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) =>
    structureInstances(structure, colours, placements, { material: swayMaterial(structure, clock) }),
  );
  for (const m of meshes) group.add(m.mesh);
  return {
    group,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
    dispose: () => {
      for (const m of meshes) m.dispose();
    },
  };
}
