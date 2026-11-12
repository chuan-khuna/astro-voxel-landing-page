/**
 * The clouds as three.js objects (ADR 0005): every cloud of the World
 * (`World.clouds`, `world/clouds.ts`) meshed from its 1-unit voxels with the
 * mesher (hidden faces culled, so the translucent body shows one skin) and
 * merged into one mesh, cloud after cloud. The vertex shader drifts each
 * cloud from its `from` to its `to` on the shared Ambient Life clock and
 * round again, fading it in at the start and out at the end; a frozen clock
 * holds every cloud where it is.
 *
 * - The soft-voxel look at 1 unit, measured on the cloud's own voxels, so
 *   the seams ride with it; slightly translucent (`CLOUD_OPACITY`).
 * - `setTheme`: white by Day, a dark grey-blue at Night (`WorldTokens.cloud`).
 * - `setZoom`: the clouds fade out as the camera zooms in on a Landmark and
 *   are gone in its close-up (`cloudFade`).
 * - `setLife`: the life tier's share of the clouds (`cloudsShown`), the
 *   first ones (a draw range over the merged mesh).
 *
 * Clouds cast no shadow-map shadow (their soft shadows are drawn in the
 * shader, `cloudShadow.ts`), draw after the sea (so the water shows through
 * them) and are never a raycast target.
 */
import * as THREE from 'three/webgpu';
import { attribute, float, fract, normalGeometry, output, positionGeometry, smoothstep, uniform, vec3, vec4, vertexStage } from 'three/tsl';
import type { World } from '@/world';
import type { LifeTierName } from '@/lib/lifeTier';
import type { Theme } from '@/lib/theme';
import { THEME_TOKENS } from '@/data/theme';
import type { AmbientClock } from './ambientClock';
import { cloudFade, cloudsShown } from './cloudMath';
import { meshVoxels, triangleCount, VoxelGrid } from './mesher';
import { mergeChunks } from './structureMeshes';
import { oklchToLinear } from './palette';
import { softVoxelLook } from './voxelMaterial';

/** How opaque a cloud is at its fullest: slightly translucent. */
export const CLOUD_OPACITY = 0.8;
/** How much of a cloud's colour it gives off: sunlit clouds have no dark side. */
const CLOUD_GLOW = 0.3;
/** The share of a drift a cloud takes to fade in, and to fade out at its end. */
const EDGE_FADE = 0.15;

export interface Clouds {
  group: THREE.Group;
  /** Triangles in every cloud (the life tier may show fewer). */
  triangles: number;
  setTheme(theme: Theme): void;
  /** Fade the clouds for a camera zoom (1 frames the Overview). Returns how much shows, 0–1. */
  setZoom(zoom: number): number;
  setLife(tier: LifeTierName): void;
  dispose(): void;
}

export function buildClouds(world: World, clock: AmbientClock): Clouds {
  const group = new THREE.Group();
  group.name = 'clouds';
  const white: [number, number, number] = [1, 1, 1];
  // Each cloud meshed on its own (its voxels at its box's corner), then all of them merged, cloud after cloud.
  const meshed = world.clouds.map((cloud) => {
    const grid = new VoxelGrid(1);
    for (const v of cloud.voxels) grid.set(v.x, v.y, v.z, 0);
    return meshVoxels(grid, { colours: [white], aoStrength: 0.25, chunkSize: 16 });
  });
  const geometry = mergeChunks(meshed.flat());
  // Per vertex: its cloud's start (x, base, z), its drift (x, z) and its timing (period, phase).
  const vertices = meshed.map((chunks) => chunks.reduce((n, c) => n + c.positions.length / 3, 0));
  const per = (size: number, value: (cloud: World['clouds'][number]) => number[]) =>
    new THREE.BufferAttribute(new Float32Array(world.clouds.flatMap((cloud, i) => Array.from({ length: vertices[i]! }, () => value(cloud)).flat())), size);
  geometry.setAttribute('cloudFrom', per(3, (c) => [c.from.x, c.base, c.from.z]));
  geometry.setAttribute('cloudDrift', per(2, (c) => [c.to.x - c.from.x, c.to.z - c.from.z]));
  geometry.setAttribute('cloudTime', per(2, (c) => [c.period, c.phase]));
  // Where each cloud's indices end, for the life tier's draw range.
  const ends: number[] = [];
  let index = 0;
  for (const chunks of meshed) {
    index += chunks.reduce((n, c) => n + c.indices.length, 0);
    ends.push(index);
  }

  const colour = uniform(new THREE.Vector3(1, 1, 1));
  const fade = uniform(1);
  const from = attribute('cloudFrom', 'vec3');
  const drift = attribute('cloudDrift', 'vec2');
  const timing = attribute('cloudTime', 'vec2');
  const u = fract(clock.time.div(timing.x).add(timing.y));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0, transparent: true });
  material.positionNode = from.add(vec3(drift.x, 0, drift.y).mul(u)).add(positionGeometry);
  const look = softVoxelLook(1, normalGeometry, positionGeometry);
  material.normalNode = look.normalNode;
  material.colorNode = vec4(look.shade(colour.mul(attribute('color', 'vec3'))), 1);
  // A little light of their own, so the shaded sides stay soft rather than stony: added after the lighting, not as emissive, so the Night bloom (`outline.ts`) leaves the clouds be.
  material.outputNode = output.add(vec4(colour.mul(CLOUD_GLOW), 0));
  const ends01 = vertexStage(smoothstep(0, EDGE_FADE, u).mul(smoothstep(1, 1 - EDGE_FADE, u)));
  material.opacityNode = ends01.mul(fade).mul(float(CLOUD_OPACITY));

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'clouds';
  // The shader moves every cloud: the bounds mean nothing.
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // After the sea, so the water shows through a cloud.
  mesh.renderOrder = 1;
  mesh.raycast = () => {};
  mesh.visible = world.clouds.length > 0;
  group.add(mesh);
  let shown = world.clouds.length;

  return {
    group,
    triangles: triangleCount(meshed.flat()),
    setTheme: (theme) => {
      colour.value.set(...oklchToLinear(THEME_TOKENS[theme].world.cloud));
    },
    setZoom: (zoom) => {
      const f = cloudFade(world, zoom);
      fade.value = f;
      mesh.visible = f > 0 && shown > 0;
      return f;
    },
    setLife: (tier) => {
      shown = cloudsShown(world.clouds.length, tier);
      geometry.setDrawRange(0, shown > 0 ? ends[shown - 1]! : 0);
      mesh.visible = fade.value > 0 && shown > 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
