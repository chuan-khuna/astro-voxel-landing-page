/**
 * The World's Decoration as three.js objects: one `InstancedMesh` per
 * Decoration structure (a kind in the World's Biome, `decorationModels.ts`),
 * one instance per piece the render tier shows. Its plants (grass, flower
 * clumps, bushes and small trees) sway in the shared clock's wind
 * (`windSway.ts`); the rest stand still. Decoration casts shadows like the
 * Landmarks (the shadow map is drawn once a World, so a plant's shadow keeps
 * its rest pose; it sways at most 1/16 unit).
 */
import * as THREE from 'three/webgpu';
import type { DecorationKind, World } from '@/world';
import type { Structure } from '@/structures';
import type { RenderTierName } from '@/lib/renderTier';
import { decorationOf, decorationPlacement } from './decorationModels';
import { structureInstances, type InstancePlacement } from './structureMeshes';
import { worldColours } from './worldVoxels';
import { swayMaterial, swaysInWind } from './windSway';
import type { AmbientClock } from './ambientClock';

export function buildDecoration(world: World, tier: RenderTierName, clock: AmbientClock): { group: THREE.Group; triangles: number; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'decoration';
  const byStructure = new Map<Structure, { kind: DecorationKind; placements: InstancePlacement[] }>();
  for (const { piece, structure } of decorationOf(world, tier)) {
    const entry = byStructure.get(structure) ?? { kind: piece.kind, placements: [] };
    entry.placements.push(decorationPlacement(world, piece));
    byStructure.set(structure, entry);
  }
  const colours = worldColours(world);
  const meshes = [...byStructure].map(([structure, { kind, placements }]) =>
    structureInstances(structure, colours, placements, {
      material: swaysInWind(kind) ? swayMaterial(structure, clock) : undefined,
    }),
  );
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
