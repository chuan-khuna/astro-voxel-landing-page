/**
 * The Partners' ships as three.js objects: one `InstancedMesh` per ship
 * structure (a kind in the World's Biome, `vesselModels.ts`), one instance
 * per Partner of that kind, each moved along its loop by `sail(seconds)`.
 *
 * Ships cast no shadow: the sun's shadow map is static and would leave a
 * moving ship's shadow behind.
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { sailingPath, shipPose, type SailingPath } from './shipMotion';
import { structureInstances } from './structureMeshes';
import { shipPlacement, vesselStructure } from './vesselModels';
import { worldColours } from './worldVoxels';

/** Sailing speed, in world units (cells) per second: slow, ambient. */
export const SHIP_SPEED = 0.45;

export interface Fleet {
  group: THREE.Group;
  /** How many ships sail. */
  count: number;
  /** Triangles in all the ships together. */
  triangles: number;
  /** Put every ship where it is `seconds` after it set off. */
  sail(seconds: number): void;
  dispose(): void;
}

export function buildFleet(world: World): Fleet {
  const group = new THREE.Group();
  group.name = 'ships';
  if (world.ships.length === 0) {
    return { group, count: 0, triangles: 0, sail: () => {}, dispose: () => {} };
  }

  const colours = worldColours(world);
  const paths = new Map<World['ships'][number]['cells'], SailingPath>();
  const byStructure = new Map<Structure, Array<{ path: SailingPath; start: number }>>();
  for (const route of world.ships) {
    if (!paths.has(route.cells)) paths.set(route.cells, sailingPath(route.cells));
    const path = paths.get(route.cells)!;
    const structure = vesselStructure('ship', world.biome.id, route.kind);
    const ships = byStructure.get(structure) ?? [];
    ships.push({ path, start: route.phase * path.length });
    byStructure.set(structure, ships);
  }

  const placementsAt = (ships: Array<{ path: SailingPath; start: number }>, seconds: number) =>
    ships.map(({ path, start }) => shipPlacement(shipPose(path, start + seconds * SHIP_SPEED)));
  const kinds = [...byStructure].map(([structure, ships]) => {
    const instances = structureInstances(structure, colours, placementsAt(ships, 0));
    instances.mesh.name = 'ships';
    instances.mesh.castShadow = false;
    group.add(instances.mesh);
    return { ships, instances };
  });

  return {
    group,
    count: world.ships.length,
    triangles: kinds.reduce((sum, k) => sum + k.instances.triangles, 0),
    sail: (seconds) => {
      for (const { ships, instances } of kinds) instances.setPlacements(placementsAt(ships, seconds));
    },
    dispose: () => {
      for (const { instances } of kinds) instances.dispose();
    },
  };
}
