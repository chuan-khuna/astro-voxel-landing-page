/**
 * Structures as three.js meshes, for repeated structures (ADR 0004): one
 * `InstancedMesh` per structure, one instance per copy, so a hundred trees
 * of one kind cost one draw call. Placed Landmarks are not instanced: they
 * are drawn into the World's structure grid and greedy-meshed with it
 * (`structureModels.ts`).
 *
 * The geometry is the structure's own, meshed once by the greedy mesher at
 * its own scale (⅛ unit, or 1/16 for the House Interior) with its anchor at the origin, in the soft-voxel material in local
 * space. The material measures the seams on the geometry as meshed, so
 * they stay on the voxels' edges however a copy is placed, turned or tilted.
 */
import * as THREE from 'three/webgpu';
import type { Structure } from '@/structures';
import type { StructurePart } from '@/structures/roles';
import { meshVoxels, triangleCount, VoxelGrid, type ChunkMesh } from './mesher';
import { LOOK } from './palette';
import { drawStructure } from './structureModels';
import { voxelMaterial } from './voxelMaterial';
import { instanceMatrix, structurePivot, type InstancePlacement, type Point } from './instancePlacement';
import type { WorldColours } from './worldVoxels';

export { FACING_TURNS, instanceMatrix, structurePivot, transformPoint, type InstancePlacement, type Point } from './instancePlacement';

/** A structure (or one part of it) meshed at its own scale, its anchor at the origin. */
export function structureGeometry(
  structure: Structure,
  colours: WorldColours,
  part?: StructurePart,
): { geometry: THREE.BufferGeometry; triangles: number } {
  const grid = new VoxelGrid(1 / structure.scale);
  drawStructure(structure, { x: 0, y: 0, z: 0, facing: 'south' }, colours, (x, y, z, colour) => grid.set(x, y, z, colour), part);
  const chunks = meshVoxels(grid, { colours: colours.table.colours, glows: colours.table.glows, aoStrength: LOOK.aoStrength, chunkSize: 256 });
  return { geometry: mergeChunks(chunks), triangles: triangleCount(chunks) };
}

/**
 * Every copy of one structure as one `InstancedMesh`. `pivot` (default:
 * the middle of its footprint, on the ground) is the point each placement
 * puts in place and turns about. `material` replaces the plain soft-voxel
 * material (a swaying plant's, `windSway.ts`); the mesh disposes of it.
 */
export function structureInstances(
  structure: Structure,
  colours: WorldColours,
  placements: readonly InstancePlacement[],
  options: { part?: StructurePart; pivot?: Point; material?: THREE.Material } = {},
): { mesh: THREE.InstancedMesh; triangles: number; setPlacements: (placements: readonly InstancePlacement[]) => void; dispose: () => void } {
  const { geometry, triangles } = structureGeometry(structure, colours, options.part);
  const material = options.material ?? voxelMaterial(1 / structure.scale, 'local');
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, placements.length));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const pivot = options.pivot ?? structurePivot(structure);
  const matrix = new THREE.Matrix4();
  const setPlacements = (next: readonly InstancePlacement[]) => {
    next.forEach((p, i) => mesh.setMatrixAt(i, matrix.fromArray(instanceMatrix(p, pivot))));
    mesh.count = next.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  setPlacements(placements);
  return {
    mesh,
    triangles: triangles * placements.length,
    setPlacements,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

/** Several chunk meshes as one geometry. */
export function mergeChunks(chunks: readonly ChunkMesh[]): THREE.BufferGeometry {
  const size = chunks.reduce((n, c) => n + c.positions.length, 0);
  const positions = new Float32Array(size);
  const normals = new Float32Array(size);
  const colours = new Float32Array(size);
  const glow = new Float32Array(size / 3);
  const indices: number[] = [];
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk.positions, offset);
    normals.set(chunk.normals, offset);
    colours.set(chunk.colours, offset);
    glow.set(chunk.glow, offset / 3);
    const base = offset / 3;
    for (const i of chunk.indices) indices.push(base + i);
    offset += chunk.positions.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
