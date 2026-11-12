/**
 * The models the outline is drawn round (`outline.ts`), as mask proxies:
 * objects of the outline's own mask scene, drawn flat white into its mask.
 *
 * The Landmarks are greedy-meshed into the World's grids with the terrain
 * and each other, so each has a proxy meshed on its own from the same
 * voxels: its Variant's structure (the House's base, the Station's
 * lighthouse with every Service's structure round it), and the Dock's
 * ¼-unit deck and jetty (not the posts down to the sea floor). What moves
 * is mirrored: a proxy shares the moving mesh's geometry and copies its
 * place every frame (the House's lid, the developer's head and hands, the
 * Guide), and a plant's proxy shares its `InstancedMesh` but draws only
 * its own copy, swaying with it. The Garden is its fence and every plant;
 * the developer is their body (from the House Interior's figure) and
 * their moving parts.
 *
 * Proxies are built the first time a model is outlined and kept until the
 * World is swapped (`dispose`).
 */
import * as THREE from 'three/webgpu';
import { instanceIndex, int, positionLocal, vec3 } from 'three/tsl';
import type { Cell, PlacedLandmarkId, World } from '@/world';
import { structureVoxels } from '@/structures/parse';
import { meshVoxels, VoxelGrid } from './mesher';
import { mergeChunks } from './structureMeshes';
import { buildLandmark } from './landmarkModels';
import { drawServices, drawStructure, landmarkPlacement, landmarkStructure } from './structureModels';
import { worldColours } from './worldVoxels';
import { GROUND_DETAIL, INTERIOR, STRUCTURE } from './voxelTiers';
import { developerFigure, furnishedRoom, interiorPlacement } from './interiorModel';
import type { WorldObjects } from './worldMeshes';

/** One object of the mask scene, and how it keeps up with what it stands for. */
export interface OutlineProxy {
  object: THREE.Object3D;
  /** Copy the place (and visibility) of the mesh it mirrors; nothing for a still model. */
  sync(): void;
  dispose(): void;
}

export interface OutlineModels {
  /** The proxies of the model a key names (`outlineTargets.ts`); none for a model this World lacks. */
  proxies(key: string): OutlineProxy[];
  dispose(): void;
}

/** The flat material a proxy draws its mask with: where `source` moves its vertices (a plant's sway), so does it; with `only`, just that copy of an `InstancedMesh`. */
function maskMaterial(source?: THREE.Material, only?: number): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.colorNode = vec3(1, 1, 1);
  const moved = (source as THREE.NodeMaterial | undefined)?.positionNode ?? null;
  if (only === undefined) material.positionNode = moved;
  // Every other copy folds to a point, so draws nothing.
  else material.positionNode = instanceIndex.equal(int(only)).select(moved ?? positionLocal, vec3(0, 0, 0));
  return material;
}

/** Is `object` drawn: it and every parent shown? */
function shown(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** A proxy that mirrors a mesh (or one copy of an `InstancedMesh`): its geometry, its place, its sway. */
function mirror(source: THREE.Mesh, only?: number): OutlineProxy {
  const material = maskMaterial(source.material as THREE.Material, only);
  const instanced = source instanceof THREE.InstancedMesh ? source : null;
  const proxy = instanced ? new THREE.InstancedMesh(source.geometry, material, instanced.count) : new THREE.Mesh(source.geometry, material);
  if (instanced) (proxy as THREE.InstancedMesh).instanceMatrix = instanced.instanceMatrix;
  proxy.matrixAutoUpdate = false;
  proxy.frustumCulled = false;
  return {
    object: proxy,
    sync: () => {
      // Where it is this frame (the lid lifting, the developer typing, the Guide bobbing), not where it was drawn last.
      source.updateWorldMatrix(true, false);
      proxy.matrix.copy(source.matrixWorld);
      proxy.visible = shown(source);
      if (instanced) (proxy as THREE.InstancedMesh).count = instanced.count;
    },
    // The geometry and the instances are the source's: only the material is the proxy's.
    dispose: () => material.dispose(),
  };
}

/** A still proxy meshed from a voxel grid (world units). */
function still(grid: VoxelGrid, colours: ReturnType<typeof worldColours>): OutlineProxy | null {
  if (grid.count === 0) return null;
  const chunks = meshVoxels(grid, { colours: colours.table.colours, aoStrength: 0, chunkSize: 256, solidOutside: () => false });
  const geometry = mergeChunks(chunks);
  const material = maskMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  return {
    object: mesh,
    sync: () => {},
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

export function createOutlineModels(options: {
  world: World;
  objects: WorldObjects;
  /** The Guide's object: it lives for the whole visit. */
  guide: THREE.Object3D;
  /** The cell of a planted Project's plant (the hotspots pair them), or null. */
  plantCell: (project: string) => Cell | null;
}): OutlineModels {
  const { world, objects, guide, plantCell } = options;
  const colours = worldColours(world);
  const cache = new Map<string, OutlineProxy[]>();

  /** The Landmark's own voxels, meshed alone: its structure (the House's base) and Services at ⅛ unit, its ¼-unit parts. */
  const landmarkProxies = (id: PlacedLandmarkId): OutlineProxy[] => {
    const landmark = world.landmarks.find((l) => l.id === id);
    if (!landmark) return [];
    const structure = new VoxelGrid(1 / STRUCTURE);
    const paint = (x: number, y: number, z: number, colour: number) => structure.set(x, y, z, colour);
    drawStructure(landmarkStructure(world, landmark), landmarkPlacement(world, landmark), colours, paint, id === 'house' ? 'base' : undefined);
    drawServices(world, landmark, colours, paint);
    // The Dock's deck and jetty; its posts reach down under the sea, not part of what a visitor clicks.
    const drawn = new VoxelGrid(1 / GROUND_DETAIL);
    buildLandmark(landmark, drawn, colours);
    const detail = new VoxelGrid(1 / GROUND_DETAIL);
    const deckFloor = landmark.y * GROUND_DETAIL - 1;
    for (const v of drawn.voxels()) if (v.y >= deckFloor) detail.set(v.x, v.y, v.z, v.colour);
    const proxies = [still(structure, colours), still(detail, colours)].filter((p): p is OutlineProxy => p !== null);
    if (id === 'house' && objects.house.lid) proxies.push(mirror(objects.house.lid));
    if (id === 'garden') {
      const meshes = new Set(objects.plants.copies.map((p) => p.mesh));
      for (const mesh of meshes) proxies.push(mirror(mesh));
    }
    return proxies;
  };

  const plantProxies = (project: string): OutlineProxy[] => {
    const cell = plantCell(project);
    const plant = cell && objects.plants.copies.find((p) => p.cell.x === cell.x && p.cell.z === cell.z);
    return plant ? [mirror(plant.mesh, plant.instance)] : [];
  };

  /** The developer's body (from the House Interior's figure, where the room seats them), and their head and hands as they move. */
  const developerProxies = (): OutlineProxy[] => {
    if (!world.landmarks.some((l) => l.id === 'house')) return [];
    const room = furnishedRoom(world.biome.id);
    const seat = room.developer;
    if (!seat) return [];
    const at = interiorPlacement(world);
    const grid = new VoxelGrid(1 / INTERIOR);
    const colour = colours.fixed('shirt');
    for (const v of structureVoxels(developerFigure())) {
      if (v.part === 'base') grid.set(at.x + seat.x + v.x, at.y + seat.y + v.y, at.z + seat.z + v.z, colour);
    }
    const body = still(grid, colours);
    const parts = objects.house.developerParts.map((mesh) => mirror(mesh));
    return body ? [body, ...parts] : parts;
  };

  const guideProxies = (): OutlineProxy[] => {
    const meshes: THREE.Mesh[] = [];
    guide.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    return meshes.map((mesh) => mirror(mesh));
  };

  const build = (key: string): OutlineProxy[] => {
    if (key === 'guide') return guideProxies();
    if (key === 'developer') return developerProxies();
    if (key.startsWith('plant:')) return plantProxies(key.slice('plant:'.length));
    if (key.startsWith('landmark:')) return landmarkProxies(key.slice('landmark:'.length) as PlacedLandmarkId);
    return [];
  };

  return {
    proxies(key) {
      let hit = cache.get(key);
      if (!hit) cache.set(key, (hit = build(key)));
      return hit;
    },
    dispose() {
      for (const proxies of cache.values()) for (const p of proxies) p.dispose();
      cache.clear();
    },
  };
}
