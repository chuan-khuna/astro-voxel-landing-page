/**
 * Structures as three.js meshes, for repeated structures (ADR 0004): one
 * `InstancedMesh` per structure, one instance per copy, so a hundred trees
 * of one kind cost one draw call. Placed Landmarks are not instanced: they
 * are drawn into the World's structure grid and greedy-meshed with it
 * (`structureModels.ts`).
 *
 * The geometry is the structure's own, meshed once by the greedy mesher at
 * its own scale (⅛ unit, or 1/16 for the House Interior) with its anchor at the origin, in the soft-voxel material in local
 * space. Instances move by whole voxels and turn by quarter turns, so the
 * seams stay on voxel edges.
 */
import * as THREE from 'three/webgpu';
import type { Structure } from '@/structures';
import type { StructurePart } from '@/structures/roles';
import type { Facing } from '@/world';
import { meshVoxels, triangleCount, VoxelGrid, type ChunkMesh } from './mesher';
import { LOOK } from './palette';
import { drawStructure } from './structureModels';
import { voxelMaterial } from './voxelMaterial';
import type { WorldColours } from './worldVoxels';

/** Quarter turns that take a front (a door, a bow) drawn towards +z (south) to each facing. */
export const FACING_TURNS: Record<Facing, number> = { south: 0, east: 1, north: 2, west: 3 };

/**
 * Where one copy goes, in world units, and how many quarter turns (about +y)
 * it makes. Whole turns keep the seams on voxel edges; a sailing ship takes
 * any fraction (its heading).
 */
export interface InstancePlacement {
  x: number;
  y: number;
  z: number;
  turns: number;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

/**
 * One copy's transform as a column-major 4×4 matrix: it turns the
 * structure about `pivot` (in the structure's own world units) by
 * `turns` quarter turns, then moves the pivot to the placement point. One
 * quarter turn takes +z to +x, so a door drawn on +z then faces east.
 */
export function instanceMatrix(placement: InstancePlacement, pivot: Point): number[] {
  const quarter = ((placement.turns % 4) + 4) % 4;
  // Whole quarter turns are exact; a fraction (a ship's heading) takes its cosine and sine.
  const whole = Number.isInteger(quarter);
  const c = whole ? [1, 0, -1, 0][quarter]! : Math.cos((quarter * Math.PI) / 2);
  const s = whole ? [0, 1, 0, -1][quarter]! : Math.sin((quarter * Math.PI) / 2);
  // Rotated pivot: R · pivot, with R = [[c, 0, s], [0, 1, 0], [-s, 0, c]].
  const rx = c * pivot.x + s * pivot.z;
  const rz = -s * pivot.x + c * pivot.z;
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, placement.x - rx, placement.y - pivot.y, placement.z - rz, 1];
}

/** A structure (or one part of it) meshed at its own scale, its anchor at the origin. */
export function structureGeometry(
  structure: Structure,
  colours: WorldColours,
  part?: StructurePart,
): { geometry: THREE.BufferGeometry; triangles: number } {
  const grid = new VoxelGrid(1 / structure.scale);
  drawStructure(structure, { x: 0, y: 0, z: 0, facing: 'south' }, colours, (x, y, z, colour) => grid.set(x, y, z, colour), part);
  const chunks = meshVoxels(grid, { colours: colours.table.colours, aoStrength: LOOK.aoStrength, chunkSize: 256 });
  return { geometry: mergeChunks(chunks), triangles: triangleCount(chunks) };
}

/**
 * Every copy of one structure as one `InstancedMesh`. `pivot` (default:
 * the middle of its footprint, on the ground) is the point each placement
 * puts in place and turns about.
 */
export function structureInstances(
  structure: Structure,
  colours: WorldColours,
  placements: readonly InstancePlacement[],
  options: { part?: StructurePart; pivot?: Point } = {},
): { mesh: THREE.InstancedMesh; triangles: number; setPlacements: (placements: readonly InstancePlacement[]) => void; dispose: () => void } {
  const { geometry, triangles } = structureGeometry(structure, colours, options.part);
  const material = voxelMaterial(1 / structure.scale, 'local');
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, placements.length));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const pivot = options.pivot ?? { x: structure.size.x / structure.scale / 2, y: 0, z: structure.size.z / structure.scale / 2 };
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
  const indices: number[] = [];
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk.positions, offset);
    normals.set(chunk.normals, offset);
    colours.set(chunk.colours, offset);
    const base = offset / 3;
    for (const i of chunk.indices) indices.push(base + i);
    offset += chunk.positions.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
