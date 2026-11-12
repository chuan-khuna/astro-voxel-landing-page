/**
 * The World's Decoration as three.js objects: one `InstancedMesh` per
 * Decoration structure (a kind in the World's Biome, `decorationModels.ts`),
 * one instance per piece the render tier shows. Decoration is still, so it
 * casts shadows like the Landmarks (the shadow map is drawn once a World).
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import type { RenderTierName } from '@/lib/renderTier';
import { decorationOf, decorationPlacement } from './decorationModels';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { worldColours } from './worldVoxels';

export function buildDecoration(world: World, tier: RenderTierName): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'decoration';
  const byStructure = new Map<Structure, InstancePlacement[]>();
  for (const { piece, structure } of decorationOf(world, tier)) {
    const placements = byStructure.get(structure) ?? [];
    placements.push(decorationPlacement(world, piece));
    byStructure.set(structure, placements);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, placements]) => structureInstances(structure, colours, placements));
  for (const m of meshes) {
    m.mesh.name = 'decoration';
    m.mesh.matrixAutoUpdate = false;
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
