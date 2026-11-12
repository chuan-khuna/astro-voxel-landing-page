/**
 * The World's torches (polish ticket 16) as three.js objects: one
 * `InstancedMesh` per torch structure (the Biome's two Variants), one
 * instance per torch, placed by `torchModels.ts` (`lightSources.ts` puts
 * their light the same way). Their flames glow and flicker at Night through the
 * soft-voxel material's glow (`blockLightNode.ts`); by Day they stand unlit.
 * Never a raycast target: pointers reach the Landmarks through them.
 */
import * as THREE from 'three/webgpu';
import type { Structure } from '@/structures';
import type { World } from '@/world';
import { structureInstances } from './structureMeshes';
import type { InstancePlacement } from './instancePlacement';
import { worldColours } from './worldVoxels';
import { torchPlacement, torchStructure } from './torchModels';

export function buildTorches(world: World): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'torches';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const torch of world.torches) {
    const structure = torchStructure(world, torch.variant);
    byStructure.set(structure, [...(byStructure.get(structure) ?? []), torchPlacement(torch)]);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) => structureInstances(structure, colours, placements));
  for (const m of meshes) {
    m.mesh.name = 'torch';
    m.mesh.matrixAutoUpdate = false;
    m.mesh.raycast = () => {};
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
