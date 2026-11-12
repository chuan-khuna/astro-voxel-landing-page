/**
 * The Garden's plants as three.js objects: one `InstancedMesh` per plant
 * structure (the Biome's tree, each of its flowers), one instance per
 * plant, standing in its cell on the Garden's ground (`gardenPlants.ts`),
 * swaying in the shared clock's wind (`windSway.ts`).
 * The Garden's fence is in the World's structure grid with the other
 * Landmarks.
 */
import * as THREE from 'three/webgpu';
import type { Cell, World } from '@/world';
import type { Structure } from '@/structures';
import { gardenPlantsOf, plantPlacement } from './gardenPlants';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { worldColours } from './worldVoxels';
import { swayMaterial } from './windSway';
import type { AmbientClock } from './ambientClock';

/** One plant's copy: the `InstancedMesh` of its structure and its instance in it. */
export interface PlantInstance {
  cell: Cell;
  mesh: THREE.InstancedMesh;
  instance: number;
}

export interface GardenPlantMeshes {
  group: THREE.Group;
  triangles: number;
  /** Every plant's copy, for outlining one plant or the whole Garden (`outlineModels.ts`). */
  copies: PlantInstance[];
  dispose: () => void;
}

export function buildGardenPlants(world: World, clock: AmbientClock): GardenPlantMeshes {
  const group = new THREE.Group();
  group.name = 'garden-plants';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  const copies: Array<{ cell: Cell; structure: Structure; instance: number }> = [];
  for (const plant of gardenPlantsOf(world)) {
    const placements = byStructure.get(plant.structure) ?? [];
    copies.push({ cell: plant.cell, structure: plant.structure, instance: placements.length });
    placements.push(plantPlacement(world, plant));
    byStructure.set(plant.structure, placements);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) =>
    structureInstances(structure, colours, placements, { material: swayMaterial(structure, clock) }),
  );
  for (const m of meshes) group.add(m.mesh);
  const meshOf = new Map([...byStructure.keys()].map((structure, i) => [structure, meshes[i]!.mesh]));
  return {
    group,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
    copies: copies.map(({ cell, structure, instance }) => ({ cell, mesh: meshOf.get(structure)!, instance })),
    dispose: () => {
      for (const m of meshes) m.dispose();
    },
  };
}
