/**
 * The sea's TSL material (`seaModel.ts` builds its geometry): the
 * soft-voxel look at 1 unit (`softVoxelLook`), coloured from the Biome's
 * shallow to deep water by each voxel's `deep`, translucent by its
 * `opacity`, and bobbing in the vertex shader.
 *
 * The bob: each voxel rises and falls `SEA_BOB` round the sea level, once
 * every `SWELL_PERIOD` seconds, out of step with its neighbours (a hash of
 * its cell) and with a slow swell running across the sea (its x + z). Only
 * vertices marked to bob move, by the voxel's swell. The shared Ambient Life
 * clock (`ambientClock.ts`) drives it, so it holds still wherever the clock
 * is frozen: under reduced motion, at the still tier, and at time 0 on a
 * fresh page or in a still (never flat: the voxels keep their steps). The
 * swell's period and stride are shared with the boats and ships riding it
 * (`swell.ts`).
 *
 * Seams and bevels are measured at the vertex's place before the bob, so
 * they ride with the voxel. The clouds' shadows drift across it
 * (`cloudShadow.ts`). At Night the block light lights a soft rim of water
 * along the shore and no further (`SHORE_LIGHT`).
 *
 * The surf (`surf.ts`): on each voxel's top, every ⅛-unit square works out
 * its distance from the coastline from the voxel's `seaCoast` corners (and
 * its calm from `seaCalm`: none by the jetty or a moored boat), how far
 * through its wave it is (waves arrive a little out of step along the
 * coast) and so how much foam the wave leaves there, and is foam (a little
 * ⅛-unit voxel top, seams and all, nearly opaque) when a hash of the square
 * falls under it. A new pattern each wave. All in the shader on the shared
 * clock: no work on the CPU, and a frozen clock holds the surf. At Night
 * the foam dims (`WorldTokens.foam`) and the breaking waves glow faintly
 * (`surfGlow`, `surfGlowStrength`).
 */
import * as THREE from 'three/webgpu';
import { abs, attribute, clamp, diffuseColor, float, floor, fract, hash, max, mix, normalGeometry, output, pow, positionGeometry, positionLocal, positionWorld, sin, smoothstep, step, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { cloudShade } from './cloudShadow';
import { blockLightAdded } from './blockLightNode';
import { softVoxelLook } from './voxelMaterial';
import { SEA_BOB, SEA_LEVEL } from './seaModel';
import { STRUCTURE, TERRAIN } from './voxelTiers';
import { SURF_BREAK, SURF_CREST, SURF_PERIOD, SURF_RUN, SURF_WASH } from './surf';
import { SWELL_PERIOD, SWELL_STRIDE } from './swell';
import type { AmbientClock } from './ambientClock';

export interface SeaMaterial {
  material: THREE.MeshStandardNodeMaterial;
  /** The Biome's shallow and deep water, in linear RGB (set them for the theme). */
  shallow: { value: THREE.Vector3 };
  deep: { value: THREE.Vector3 };
  /** The foam's colour, the surf's glow (linear RGB) and the glow's strength (0 by Day). */
  foam: { value: THREE.Vector3 };
  glow: { value: THREE.Vector3 };
  glowStrength: { value: number };
}

export function seaMaterial(clock: AmbientClock): SeaMaterial {
  const { time } = clock;
  const shallow = uniform(new THREE.Vector3());
  const deep = uniform(new THREE.Vector3());
  const cell = attribute('seaCell', 'vec3');
  const shade = attribute('seaShade', 'vec3');
  const cellX = cell.x;
  const cellZ = cell.y;
  /** 1 where the vertex bobs with its voxel, 0 where it stays put. */
  const lift = cell.z;
  const deepness = shade.x;
  const opacity = shade.y;
  const swell = shade.z;
  const foamColour = uniform(new THREE.Vector3(1, 1, 1));
  const glowColour = uniform(new THREE.Vector3());
  const glowStrength = uniform(0);

  // The same seed and phase as `seaCellSeed` and `seaVoxelPhase` (`swell.ts`), which the vessels ride.
  const seed = cellX.add(512).add(cellZ.add(512).mul(1024));
  const phase = hash(seed).mul(Math.PI).add(cellX.add(cellZ).mul(SWELL_STRIDE));
  const bob = sin(time.mul((2 * Math.PI) / SWELL_PERIOD).add(phase)).mul(SEA_BOB).mul(swell).mul(lift);

  // The sea's meshes are never moved, so their own space is world space.
  const look = softVoxelLook(1 / TERRAIN, normalGeometry, positionGeometry.sub(vec3(0, SEA_LEVEL, 0)));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0, transparent: true });
  material.positionNode = positionLocal.add(vec3(0, bob, 0));
  material.normalNode = look.normalNode;
  // Passing clouds shade the water (`cloudShadow.ts`).
  const surf = surfNodes(time, cellX, cellZ);
  const foamLook = softVoxelLook(1 / STRUCTURE, normalGeometry, positionGeometry.sub(vec3(0, SEA_LEVEL, 0)));
  material.colorNode = mix(look.shade(mix(shallow, deep, deepness)), foamLook.shade(foamColour), surf.foam).mul(cloudShade(positionWorld));
  material.opacityNode = mix(opacity, float(FOAM_OPACITY), surf.foam);
  // At Night the breaking surf glows: a soft wash where it breaks, brighter on the foam, and a faint glow on all foam.
  // Added after the lighting, not as emissive: the surf is no Light Source, so the bloom (`outline.ts`) leaves it be.
  const surfGlow = glowColour.mul(glowStrength).mul(surf.glow.mul(0.6).add(surf.foam.mul(surf.glow.add(0.25))));
  // The block light at Night (`blockLightNode.ts`) reaches only a soft rim of water along the shore, never the open sea.
  const shore = float(1).sub(smoothstep(SHORE_LIGHT.from, SHORE_LIGHT.to, surf.coast));
  material.outputNode = output.add(vec4(surfGlow.add(blockLightAdded(diffuseColor.rgb).mul(shore)), 0));
  return { material, shallow, deep, foam: foamColour, glow: glowColour, glowStrength };
}

/** The block light's rim along the shore: whole up to `from` units out from the coastline, gone by `to`. */
const SHORE_LIGHT = { from: 0.3, to: 1.2 } as const;

/** How opaque a square of foam is. */
const FOAM_OPACITY = 0.95;

type FloatNode = THREE.Node<'float'>;

/**
 * The surf on a water voxel's top (`surf.ts`, the same sums): `foam` is 1
 * on a square of foam, `glow` the breaking wave's soft glow, both 0 on the
 * skirts and the flat water beyond the ring (its coast is far).
 */
function surfNodes(time: FloatNode, cellX: FloatNode, cellZ: FloatNode) {
  const coast = attribute('seaCoast', 'vec4');
  const calm = attribute('seaCalm', 'vec4');
  // The ⅛-unit square, measured before the bob, and its middle's place within the voxel (0–1 each way).
  const square = floor(positionGeometry.xz.mul(STRUCTURE));
  const middle = square.add(0.5).div(STRUCTURE);
  const f = clamp(middle.sub(vec2(cellX, cellZ)), 0, 1);
  const bilinear = (v: THREE.Node<'vec4'>) => mix(mix(v.x, v.y, f.x), mix(v.z, v.w, f.x), f.y);
  const d = bilinear(coast);
  const still = bilinear(calm);
  const top = step(0.5, normalGeometry.y);
  // Waves arrive a little out of step along the coast: a slow wobble across the sea.
  const offset = sin(middle.x.mul(0.37)).mul(0.12).add(sin(middle.y.mul(0.29).add(1.3)).mul(0.12));
  const wave = time.div(SURF_PERIOD).add(offset);
  const u = fract(wave);

  const run = clamp(u.div(SURF_BREAK), 0, 1);
  const running = float(1).sub(step(SURF_BREAK, u));
  const front = float(SURF_RUN).mul(float(1).sub(run.mul(run)));
  const crest = running.mul(float(1).sub(smoothstep(0, SURF_CREST, abs(d.sub(front))))).mul(run.mul(0.55).add(0.35));
  const back = clamp(u.sub(SURF_BREAK).div(1 - SURF_BREAK), 0, 1);
  const reach = back.mul(SURF_WASH).add(0.1);
  const wash = float(1).sub(running).mul(pow(float(1).sub(back), 1.5)).mul(0.95).mul(float(1).sub(smoothstep(reach, reach.add(0.15), d)));
  const rim = float(1).sub(smoothstep(0.05, 0.2, d)).mul(0.25);
  const amount = clamp(max(crest, max(wash, rim)), 0, 1).mul(still).mul(top);

  // Each square is foam when its hash (new each wave) falls under the amount.
  const chance = hash(square.x.add(4096).add(square.y.add(4096).mul(8192)).add(floor(wave).mul(7919)));
  const foam = step(chance.add(0.001), amount);
  const glow = float(1).sub(running).mul(pow(float(1).sub(back), 2)).mul(float(1).sub(smoothstep(0.2, 0.6, d))).mul(still).mul(top);
  return { foam, glow, coast: d };
}
