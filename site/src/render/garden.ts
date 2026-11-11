/**
 * The Garden's plants as three.js objects: one `InstancedMesh` per plant
 * structure (the Biome's tree, each of its flowers), one instance per
 * plant, standing in its cell on the Garden's ground (`gardenPlants.ts`).
 * The Garden's fence is in the World's structure grid with the other
 * Landmarks.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { gardenPlantsOf } from './gardenPlants';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { worldColours } from './worldVoxels';

export function buildGardenPlants(world: World): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'garden-plants';
  const garden = world.landmarks.find((l) => l.id === 'garden');
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const plant of gardenPlantsOf(world)) {
    const placements = byStructure.get(plant.structure) ?? [];
    // Each plant's footprint middle goes to its cell's middle, on the ground.
    placements.push({ x: plant.cell.x + 0.5, y: garden?.y ?? 0, z: plant.cell.z + 0.5, turns: 0 });
    byStructure.set(plant.structure, placements);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) => structureInstances(structure, colours, placements));
  for (const m of meshes) group.add(m.mesh);
  return {
    group,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
    dispose: () => {
      for (const m of meshes) m.dispose();
    },
  };
}
