/**
 * The block light and the Light Sources' glow in the shaders (polish ticket
 * 16, ADR 0007). The World's baked block light (`blockLight.ts`, from the
 * World Web Worker) is one 3D texture, a texel a 1-unit cell, sampled with
 * linear filtering half a cell out from each surface along its normal: so
 * it is smooth across faces like the baked AO, costs one texture fetch a
 * fragment and no extra draw call, and every voxel material reads it the
 * same way, instanced structures included (at their own world position).
 *
 * - `blockLightAdded(albedo)`: what the block light adds to a surface of
 *   that colour, lifting its moonlit side too (it ignores the normal).
 * - `glowEmissive(colour)`: a `flame` or `glow` voxel's own light (the
 *   mesher's `glow` attribute), its material's emissive term, which the
 *   bloom pass picks out (`outline.ts`).
 *
 * Both scale with `BLOCK_LIGHT.night` (0 by Day, 1 at Night: switching the
 * theme sets the uniform, nothing is remeshed). Flames flicker from the
 * shared clock (`BLOCK_LIGHT.time`, set in `WorldObjects.step`), each source
 * at its own phase (the texture's alpha), so nothing flickers while the
 * clock is frozen.
 */
import * as THREE from 'three/webgpu';
import { attribute, clamp, float, floor, ivec3, normalWorld, positionWorld, sin, step, texture3D, texture3DLoad, uniform, vec3 } from 'three/tsl';
import type { LightVolume } from './blockLight';

type Vec3Node = THREE.Node<'vec3'>;

/** How bright block light of full strength is on a surface (times its colour). */
const BRIGHTNESS = 1.8;
/** How bright a glowing voxel is at Night (times its own colour): a flame and a lamp's glass. */
const GLOW = 1.6;
/** How far a flame's light wavers either way (a fraction of it). */
export const FLICKER = 0.18;

/** A light volume as a 3D texture: RGBA bytes, filtered linearly, clamped at its edges. */
function volumeTexture(volume: Pick<LightVolume, 'width' | 'height' | 'depth' | 'data'>): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(volume.data, volume.width, volume.height, volume.depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** One empty texel: no light until a World's volume arrives. */
const empty = volumeTexture({ width: 1, height: 1, depth: 1, data: new Uint8Array(4) });
const size = uniform(new THREE.Vector3(1, 1, 1));
/** Where a surface takes its light: half a cell out from it, along its normal (world units, a cell each). */
const lightPoint = positionWorld.add(normalWorld.mul(0.5));

/** The shared uniforms: the World's volume and its size in cells, Night (0–1) and the clock's seconds. */
export const BLOCK_LIGHT = {
  size,
  night: uniform(0),
  time: uniform(0),
  /** One sample node shared by every material, so swapping the volume (`setBlockLight`) reaches them all. */
  sample: texture3D(empty, lightPoint.div(size)),
  /**
   * The same volume read cell by cell, unfiltered, for the flicker's phase:
   * a phase blended between two sources would ripple across the ground, so
   * each cell flickers with the source whose light is brightest in it.
   */
  cell: texture3DLoad(empty, ivec3(clamp(floor(lightPoint), vec3(0), size.sub(1)))),
};

/** Show a World's block light (null: none). Returns the texture, for disposing with the World. */
export function setBlockLight(volume: LightVolume | null): THREE.Data3DTexture | null {
  if (!volume) {
    BLOCK_LIGHT.sample.value = empty;
    BLOCK_LIGHT.cell.value = empty;
    size.value.set(1, 1, 1);
    return null;
  }
  const texture = volumeTexture(volume);
  BLOCK_LIGHT.sample.value = texture;
  BLOCK_LIGHT.cell.value = texture;
  size.value.set(volume.width, volume.height, volume.depth);
  return texture;
}

/** A flame's waver at `phase` (0–1) on the shared clock: two sine waves out of tune, −1 to 1. */
export function flameWave(phase: THREE.Node<'float'>): THREE.Node<'float'> {
  const t = BLOCK_LIGHT.time;
  return sin(t.mul(7.3).add(phase.mul(57))).mul(0.6).add(sin(t.mul(17.9).add(phase.mul(131))).mul(0.4));
}

/** A flame's flicker: 1 ± `FLICKER` at its phase (the cell's alpha); 1 for a steady light. */
function flicker() {
  const phase = BLOCK_LIGHT.cell.a;
  const flame = step(0.5 / 255, phase);
  const wave = flameWave(phase);
  return { flame, wave, level: flame.mul(wave).mul(FLICKER).add(1) };
}

/** What the block light adds to a surface of colour `albedo` at Night. */
export function blockLightAdded(albedo: Vec3Node): Vec3Node {
  return albedo.mul(BLOCK_LIGHT.sample.rgb).mul(flicker().level).mul(BLOCK_LIGHT.night.mul(BRIGHTNESS));
}

/**
 * A glowing voxel's own light at Night (its material's emissive): the
 * mesher's `glow` attribute says which voxels glow (1 steady, 2 a flame,
 * which flickers and warms as it brightens). Nothing by Day.
 */
export function glowEmissive(colour: Vec3Node): Vec3Node {
  const glow = attribute('glow', 'float');
  const lit = clamp(glow, 0, 1);
  const { wave } = flicker();
  const flame = clamp(glow.sub(1), 0, 1);
  const waver = flame.mul(wave);
  const warm = colour.mul(waver.mul(FLICKER).add(1)).add(vec3(0.04, -0.01, -0.03).mul(waver));
  return warm.mul(lit).mul(BLOCK_LIGHT.night.mul(GLOW)).max(float(0));
}

/**
 * A plain glowing surface (a lit window's pane, a halo): black itself, all
 * its light emissive, so the bloom pass picks it out. `colour` is a linear
 * colour uniform; the caller shows it only at Night.
 */
export function glowMaterial(colour: THREE.UniformNode<'color', THREE.Color>, options: THREE.MeshBasicNodeMaterialParameters = {}): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial(options);
  glowsWith(material, colour);
  return material;
}

/** Make a basic material all glow: black itself, `light` its emissive (which the bloom picks out). */
export function glowsWith(material: THREE.MeshBasicNodeMaterial, light: THREE.Node): void {
  material.colorNode = vec3(0);
  // Every node material adds its `emissiveNode` (the basic one too); its types leave it out.
  (material as unknown as { emissiveNode: THREE.Node }).emissiveNode = light;
}
