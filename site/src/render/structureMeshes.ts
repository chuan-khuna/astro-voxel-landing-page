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
 * it makes: whole turns for things that stand on a cell; a sailing ship
 * takes any fraction (its heading). A vessel on the swell also heaves, rolls
 * and pitches (`swell.ts`).
 */
export interface InstancePlacement {
  x: number;
  y: number;
  z: number;
  turns: number;
  /** World units the copy rises (a vessel on the swell); default 0. */
  heave?: number;
  /** Radians it rolls about its own length (z): its +x side rises; default 0. */
  roll?: number;
  /** Radians it pitches about its own beam (x): its bow (+z) rises; default 0. */
  pitch?: number;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** The point a structure's placements put in place and turn about: the middle of its footprint, on the ground. */
export const structurePivot = (structure: Structure): Point => ({
  x: structure.size.x / structure.scale / 2,
  y: 0,
  z: structure.size.z / structure.scale / 2,
});

/** A column-major 4×4 matrix applied to a point. */
export function transformPoint(m: readonly number[], p: Point): Point {
  return {
    x: m[0]! * p.x + m[4]! * p.y + m[8]! * p.z + m[12]!,
    y: m[1]! * p.x + m[5]! * p.y + m[9]! * p.z + m[13]!,
    z: m[2]! * p.x + m[6]! * p.y + m[10]! * p.z + m[14]!,
  };
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
  // R = yaw · roll · pitch, row-major: yaw = [[c, 0, s], [0, 1, 0], [-s, 0, c]] about +y; the
  // tilt (a vessel rocking) is in the copy's own frame, so it turns with it. No tilt: R is the yaw.
  const { roll = 0, pitch = 0, heave = 0 } = placement;
  const tilt = roll === 0 && pitch === 0 ? IDENTITY : multiply(rotationZ(roll), rotationX(-pitch));
  const r = multiply([c, 0, s, 0, 1, 0, -s, 0, c], tilt);
  // Rotated pivot: R · pivot.
  const rx = r[0]! * pivot.x + r[1]! * pivot.y + r[2]! * pivot.z;
  const ry = r[3]! * pivot.x + r[4]! * pivot.y + r[5]! * pivot.z;
  const rz = r[6]! * pivot.x + r[7]! * pivot.y + r[8]! * pivot.z;
  return [
    r[0]!, r[3]!, r[6]!, 0,
    r[1]!, r[4]!, r[7]!, 0,
    r[2]!, r[5]!, r[8]!, 0,
    placement.x - rx, placement.y + heave - ry, placement.z - rz, 1,
  ];
}

/** 3×3 matrices, row-major. */
type Matrix3 = readonly number[];
const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const rotationZ = (a: number): Matrix3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const rotationX = (a: number): Matrix3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
function multiply(a: Matrix3, b: Matrix3): number[] {
  const out: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
  return out;
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
