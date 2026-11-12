/**
 * The Clients' boats as three.js objects: one `InstancedMesh` per boat
 * structure (a kind in the World's Biome, `vesselModels.ts`), one instance
 * per moored boat. Moored boats rock on the swell (`swell.ts`) by `rock`,
 * in step with the water round them. They cast shadows like the Landmarks;
 * the shadow map is drawn once, so the shadow keeps the boat's rest pose
 * (it rocks a few hundredths of a unit).
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { boatPlacement, boatsOf } from './vesselModels';
import { vesselRock } from './swell';
import { worldColours } from './worldVoxels';

export interface Moorings {
  group: THREE.Group;
  triangles: number;
  /** Rock every boat on the swell as it is `seconds` into the shared clock. */
  rock(seconds: number): void;
  dispose(): void;
}

export function buildBoats(world: World): Moorings {
  const group = new THREE.Group();
  group.name = 'boats';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const { boat, structure } of boatsOf(world)) {
    const placements = byStructure.get(structure) ?? [];
    placements.push(boatPlacement(boat));
    byStructure.set(structure, placements);
  }
  const colours = worldColours(world);
  const kinds = [...byStructure].map(([structure, placements]) => ({ placements, instances: structureInstances(structure, colours, placements) }));
  const meshes = kinds.map((k) => k.instances);
  for (const m of meshes) {
    m.mesh.name = 'boats';
    group.add(m.mesh);
  }
  return {
    group,
    triangles: meshes.reduce((sum, m) => sum + m.triangles, 0),
    rock: (seconds) => {
      for (const { placements, instances } of kinds) instances.setPlacements(placements.map((p) => ({ ...p, ...vesselRock(p.x, p.z, seconds) })));
    },
    dispose: () => {
      for (const m of meshes) m.dispose();
    },
  };
}
