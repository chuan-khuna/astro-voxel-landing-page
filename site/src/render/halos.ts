/**
 * Halos (polish ticket 16): the reduced life tier's cheap stand-in for the
 * bloom. A soft camera-facing disc of light round each Light Source
 * (`lightSources.ts`; not the House room's, which the walls hide), all in one
 * mesh and one draw call, added over the World at Night. Flames' halos
 * flicker in step with their light (`flameWave`, on the shared clock).
 * Shown only at Night on the reduced life tier (`setShown`); the full tier
 * blooms instead and the still tier shows neither. Never a raycast target.
 */
import * as THREE from 'three/webgpu';
import { attribute, cameraProjectionMatrix, cameraViewMatrix, float, length, smoothstep, step, uv, vec4 } from 'three/tsl';
import type { World } from '@/world';
import { lightColour } from './blockLight';
import { FLICKER, flameWave } from './blockLightNode';
import { lightSources } from './lightSources';

/** A halo's radius at full strength, in world units, and how bright its middle is. */
const RADIUS = 0.75;
const BRIGHTNESS = 0.55;

export function buildHalos(world: World): { mesh: THREE.Mesh; setShown: (shown: boolean) => void; dispose: () => void } {
  const sources = lightSources(world).filter((s) => !s.inside);
  const centres: number[] = [];
  const corners: number[] = [];
  const colours: number[] = [];
  const looks: number[] = [];
  const indices: number[] = [];
  sources.forEach((s, i) => {
    const colour = lightColour(world, s);
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const) {
      centres.push(s.x, s.y, s.z);
      corners.push(u, v);
      colours.push(...colour);
      looks.push(RADIUS * s.strength, s.flickers ? s.phase : -1);
    }
    indices.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(centres, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(corners, 2));
  geometry.setAttribute('haloColour', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('haloLook', new THREE.Float32BufferAttribute(looks, 2));
  geometry.setIndex(indices);

  const look = attribute('haloLook', 'vec2');
  const radius = look.x;
  const phase = look.y;
  // A steady light's phase is −1: it never flickers.
  const flame = step(-0.5, phase);
  const wave = flameWave(phase);
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // Camera-facing: the corner's offset is added in view space.
  const corner = uv().mul(2).sub(1);
  const view = cameraViewMatrix.mul(vec4(attribute('position', 'vec3'), 1));
  material.vertexNode = cameraProjectionMatrix.mul(view.add(vec4(corner.mul(radius), 0, 0)));
  const r = length(uv().mul(2).sub(1));
  const falloff = float(1).sub(smoothstep(0, 1, r)).pow(2);
  material.colorNode = attribute('haloColour', 'vec3').mul(falloff.mul(BRIGHTNESS).mul(flame.mul(wave).mul(FLICKER).add(1)));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'halos';
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.raycast = () => {};
  return {
    mesh,
    setShown: (shown) => {
      mesh.visible = shown && sources.length > 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
