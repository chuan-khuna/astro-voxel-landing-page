/**
 * The soft-voxel TSL material, ported from the approved look prototype
 * (ticket 01). Seams, bevel and colour jitter are computed per fragment from
 * world position, so greedy-merged quads still read as single voxels. Baked
 * AO arrives in the vertex colours.
 *
 * Meshes using this material must not be rotated or scaled: the geometry
 * normal is used as the world normal.
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
  positionWorld,
  smoothstep,
  vec3,
  vec4,
} from 'three/tsl';
import { LOOK } from './palette';

/** A node material for voxels `voxelSize` world units wide. */
export function voxelMaterial(voxelSize: number): THREE.MeshStandardNodeMaterial {
  const size = float(voxelSize);
  const n = normalGeometry;
  const an = abs(n);
  const local = positionWorld.div(size);
  const f = fract(local);
  // Distance to the nearest voxel edge on each in-face axis; the normal axis is masked out.
  const d = min(f, f.oneMinus()).max(an);
  const edge = min(d.x, min(d.y, d.z));

  const seamWidth = float(LOOK.seamWidth);
  const bevelWidth = float(LOOK.bevelWidth);

  const material = new THREE.MeshStandardNodeMaterial({ roughness: LOOK.roughness, metalness: 0 });

  material.normalNode = Fn(() => {
    const lo = float(1).sub(smoothstep(float(0), bevelWidth, f));
    const hi = smoothstep(bevelWidth.oneMinus(), float(1), f);
    const tilt = hi.sub(lo).mul(an.oneMinus()).mul(LOOK.bevelStrength);
    const bent = normalize(n.add(tilt));
    return normalize(cameraViewMatrix.mul(vec4(bent, 0)).xyz);
  })();

  material.colorNode = Fn(() => {
    // The owning voxel: step half a voxel inward from the face.
    const cell = floor(local.sub(n.mul(0.5))).add(128);
    const seed = cell.x.add(cell.y.mul(256)).add(cell.z.mul(65536));
    const j = hash(seed).mul(2).sub(1).mul(LOOK.jitter);
    const t = hash(seed.add(7919)).mul(2).sub(1).mul(LOOK.tintJitter);
    const tint = vec3(t, t.mul(0.3), t.negate());

    const seam = smoothstep(seamWidth, seamWidth.add(fwidth(edge)), edge);
    const seamFactor = mix(float(1 - LOOK.seamDarkness), float(1), seam);

    // Vertex colour already carries the baked AO.
    const base = attribute('color', 'vec3');
    return vec4(base.mul(j.add(1)).add(tint.mul(base)).mul(seamFactor), 1);
  })();

  return material;
}
