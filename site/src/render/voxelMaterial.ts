/**
 * The soft-voxel TSL material, ported from the approved look prototype
 * (ticket 01). Seams, bevel and colour jitter are computed per fragment from
 * world position, so greedy-merged quads still read as single voxels. Baked
 * AO arrives in the vertex colours.
 *
 * By default meshes using this material must not be rotated or scaled: the
 * geometry normal is used as the world normal. With `space: 'local'` the
 * look is computed in the mesh's own space instead, so a mesh that moves and
 * turns (a sailing ship) carries its seams with it; it must not be scaled.
 * An `InstancedMesh` in local space takes its seams from the geometry as
 * meshed, so every copy carries them (see `voxelMaterial`).
 *
 * `softVoxelLook` is the look on its own, for materials of their own (the
 * sea, `seaMaterial.ts`).
 */
import * as THREE from 'three/webgpu';
import {
  Fn,
  abs,
  attribute,
  cameraViewMatrix,
  float,
  floor,
  fract,
  fwidth,
  hash,
  min,
  mix,
  normalGeometry,
  normalize,
  normalLocal,
  positionGeometry,
  positionLocal,
  positionWorld,
  smoothstep,
  transformNormalToView,
  vec3,
  vec4,
  vertexStage,
} from 'three/tsl';
import { LOOK } from './palette';

type Vec3Node = THREE.Node<'vec3'>;

/**
 * The soft-voxel look for voxels `voxelSize` wide, measured at `position`
 * with face normal `normal` (both in the same space; `inLocal` says that
 * space is the mesh's own, not the world's): the bevelled normal in view
 * space, and `shade(base)`, a colour with the voxel's jitter, tint and seams.
 */
export function softVoxelLook(voxelSize: number, normal: Vec3Node, position: Vec3Node, inLocal = false) {
  const size = float(voxelSize);
  const an = abs(normal);
  const local = position.div(size);
  const f = fract(local);
  // Distance to the nearest voxel edge on each in-face axis; the normal axis is masked out.
  const d = min(f, f.oneMinus()).max(an);
  const edge = min(d.x, min(d.y, d.z));

  const seamWidth = float(LOOK.seamWidth);
  const bevelWidth = float(LOOK.bevelWidth);

  const normalNode = Fn(() => {
    const lo = float(1).sub(smoothstep(float(0), bevelWidth, f));
    const hi = smoothstep(bevelWidth.oneMinus(), float(1), f);
    const tilt = hi.sub(lo).mul(an.oneMinus()).mul(LOOK.bevelStrength);
    const bent = normalize(normal.add(tilt));
    return inLocal ? transformNormalToView(bent).normalize() : normalize(cameraViewMatrix.mul(vec4(bent, 0)).xyz);
  })();

  const shade = (base: Vec3Node) => {
    // The owning voxel: step half a voxel inward from the face.
    const cell = floor(local.sub(normal.mul(0.5))).add(128);
    const seed = cell.x.add(cell.y.mul(256)).add(cell.z.mul(65536));
    const j = hash(seed).mul(2).sub(1).mul(LOOK.jitter);
    const t = hash(seed.add(7919)).mul(2).sub(1).mul(LOOK.tintJitter);
    const tint = vec3(t, t.mul(0.3), t.negate());

    const seam = smoothstep(seamWidth, seamWidth.add(fwidth(edge)), edge);
    const seamFactor = mix(float(1 - LOOK.seamDarkness), float(1), seam);
    return base.mul(j.add(1)).add(tint.mul(base)).mul(seamFactor);
  };

  return { normalNode, shade };
}

/**
 * A node material for voxels `voxelSize` world units wide.
 *
 * With `space: 'local'` the seams and colour jitter are measured on the
 * geometry as meshed (`positionGeometry`), so they stay on the voxels'
 * edges however an instance moves, turns or tilts (a sailing ship, a boat
 * on the swell). The bevel is measured in the mesh's own space after
 * instancing: exact for whole-voxel placements, a little off the edges on
 * a tilted or heaving vessel.
 *
 * `displace` (local space only) moves each vertex in the vertex shader (a
 * plant swaying, `windSway.ts`); the bevel is measured where the vertex was
 * before it moved, so the voxel carries its look with it.
 */
export function voxelMaterial(
  voxelSize: number,
  space: 'world' | 'local' = 'world',
  options: { displace?: THREE.Node<'vec3'> } = {},
): THREE.MeshStandardNodeMaterial {
  const inLocal = space === 'local';
  const material = new THREE.MeshStandardNodeMaterial({ roughness: LOOK.roughness, metalness: 0 });
  let rest: Vec3Node = positionLocal;
  if (inLocal && options.displace) {
    const moved = vertexStage(options.displace);
    material.positionNode = positionLocal.add(moved);
    rest = positionLocal.sub(moved);
  }
  const look = inLocal ? softVoxelLook(voxelSize, normalLocal, rest, true) : softVoxelLook(voxelSize, normalGeometry, positionWorld);
  const shade = inLocal ? softVoxelLook(voxelSize, normalGeometry, positionGeometry).shade : look.shade;
  material.normalNode = look.normalNode;
  // Vertex colour already carries the baked AO.
  material.colorNode = Fn(() => vec4(shade(attribute('color', 'vec3')), 1))();
  return material;
}
