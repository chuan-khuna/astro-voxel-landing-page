/**
 * The Clients' boats as three.js objects: one `InstancedMesh` per boat
 * structure (a kind in the World's Biome, `vesselModels.ts`), one instance
 * per moored boat. Boats are still, so they cast shadows like the Landmarks.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { boatPlacement, boatsOf } from './vesselModels';
import { worldColours } from './worldVoxels';

export function buildBoats(world: World): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'boats';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const { boat, structure } of boatsOf(world)) {
    const placements = byStructure.get(structure) ?? [];
    placements.push(boatPlacement(boat));
    byStructure.set(structure, placements);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) => structureInstances(structure, colours, placements));
  for (const m of meshes) {
    m.mesh.name = 'boats';
    group.add(m.mesh);
  }
  return {
    group,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
    dispose: () => {
      for (const m of meshes) m.dispose();
    },
  };
}
