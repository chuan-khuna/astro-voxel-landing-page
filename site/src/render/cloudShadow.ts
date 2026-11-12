/**
 * The clouds' soft shadows (ADR 0005): computed in the shader, never cast
 * into the shadow map. A scrolling noise mask over the ground darkens the
 * colour of every voxel material (`voxelMaterial.ts`: terrain, bridges,
 * stairs, Landmarks, the House's lid and room, plants, Decoration, boats,
 * ships and the Guide) and the sea's water and
 * seabed wherever a shadow lies, so the shadows cross the Isles and the sea
 * alike. They do not follow the cloud bodies, which keep to the sea
 * (`world/clouds.ts`).
 *
 * Two shared uniforms drive it, one set for the page:
 * - `drift`: how far the shadows have drifted down the wind
 *   (`cloudShadowDrift`, from the shared clock's seconds in
 *   `WorldObjects.step`), so they hold still wherever the clock is frozen;
 * - `strength`: how dark a shadow is (`cloudShadowStrength`): 0 at Night,
 *   and 0 until a World sets it (and again once it is disposed), so the
 *   Model Gallery has none.
 *
 * The shadow darkens the surface's colour (light from the sky dims with it,
 * not only the sun's): a soft blot, which reads as a passing cloud's shade.
 */
import { mx_noise_float, smoothstep, uniform, vec2, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';

/** World units across one blot of shadow, about: near a cloud's own size. */
const SHADOW_SCALE = 11;

export const CLOUD_SHADOW = {
  /** World units the shadows have drifted (x, z). */
  drift: uniform(new THREE.Vector2(0, 0)),
  /** How much a shadow darkens (0–1). */
  strength: uniform(0),
};

/** The light left at a world position under the clouds' shadows: 1 in the open, down to 1 − strength. */
export function cloudShade(position: THREE.Node<'vec3'>): THREE.Node<'float'> {
  const p = vec2(position.x, position.z).sub(CLOUD_SHADOW.drift).div(SHADOW_SCALE);
  // Two octaves of noise, thresholded softly into blots with clear sky between.
  const n = mx_noise_float(vec3(p.x, p.y, 0.5)).add(mx_noise_float(vec3(p.x.mul(2.3).add(7.1), p.y.mul(2.3).sub(3.7), 1.5)).mul(0.35));
  const mask = smoothstep(0.18, 0.5, n);
  return mask.mul(CLOUD_SHADOW.strength).oneMinus();
}
