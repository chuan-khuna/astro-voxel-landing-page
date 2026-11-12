/**
 * The falling leaves as three.js objects: one `InstancedMesh` of ⅛-unit
 * cubes, one instance per leaf, moved entirely in the vertex shader on the
 * shared Ambient Life clock (`ambientClock.ts`). `fallingLeaves.ts` works
 * out each leaf's way down, colour and timing; the shader plays it:
 *
 * - each leaf runs a cycle of `period` seconds, `offset` into it at time 0:
 *   it fades in at its tree, falls from `start` to `land` in `fall`
 *   seconds, flutters across the wind and is pushed by its gusts on the way
 *   (both 0 at either end, so it lands where it was worked out to), tumbles
 *   whole turns (so it lies flat), lies `LEAF_FADE` seconds fading, and is
 *   gone until the cycle starts again;
 * - a frozen clock holds every leaf where it is (mid-air, lying or gone).
 *
 * The life tier sets how many show (`setLife`, `leavesShown`). Leaves cast
 * no shadow (the shadow map is static) and are never a raycast target.
 */
import * as THREE from 'three/webgpu';
import {
  attribute,
  clamp,
  mix,
  mod,
  normalGeometry,
  positionGeometry,
  rotate,
  sin,
  step,
  transformNormalToView,
  vec3,
  vertexStage,
} from 'three/tsl';
import type { World } from '@/world';
import type { RenderTierName } from '@/lib/renderTier';
import type { LifeTierName } from '@/lib/lifeTier';
import { windAt, type AmbientClock } from './ambientClock';
import { fallingLeaves, LEAF_FADE, LEAF_SIZE, leavesShown } from './fallingLeaves';

/** Seconds a leaf takes to fade in at its tree. */
const FADE_IN = 0.4;
/** World units a leaf flutters either side of its way, across the wind, at most. */
const FLUTTER = 0.18;
/** World units a gust at full strength pushes a leaf off its way, at most. */
const GUST_PUSH = 0.25;

export interface Leaves {
  group: THREE.Group;
  /** Triangles in every leaf (the life tier may show fewer). */
  triangles: number;
  /** Show as many leaves as the life tier allows. */
  setLife(tier: LifeTierName): void;
  dispose(): void;
}

export function buildLeaves(world: World, tier: RenderTierName, clock: AmbientClock): Leaves {
  const group = new THREE.Group();
  group.name = 'leaves';
  const leaves = fallingLeaves(world, tier);
  if (leaves.length === 0) return { group, triangles: 0, setLife: () => {}, dispose: () => {} };

  const geometry = new THREE.BoxGeometry(LEAF_SIZE, LEAF_SIZE, LEAF_SIZE);
  const perLeaf = (size: number, value: (leaf: (typeof leaves)[number]) => number[]) =>
    new THREE.InstancedBufferAttribute(new Float32Array(leaves.flatMap(value)), size);
  geometry.setAttribute('leafStart', perLeaf(3, (l) => [l.start.x, l.start.y, l.start.z]));
  geometry.setAttribute('leafLand', perLeaf(3, (l) => [l.land.x, l.land.y, l.land.z]));
  geometry.setAttribute('leafColour', perLeaf(3, (l) => [...l.colour]));
  geometry.setAttribute('leafTime', perLeaf(4, (l) => [l.period, l.fall, l.offset, l.spin]));

  const start = attribute('leafStart', 'vec3');
  const land = attribute('leafLand', 'vec3');
  const timing = attribute('leafTime', 'vec4');
  const period = timing.x;
  const fall = timing.y;
  const spin = timing.w;
  /** Seconds into this leaf's cycle. */
  const t = mod(clock.time.add(timing.z), period);
  /** How far down it is: 0 at its tree, 1 on the ground. */
  const down = clamp(t.div(fall), 0, 1);
  /** 0 at either end of its way, 1 half-way. */
  const midway = sin(down.mul(Math.PI));
  const way = mix(start, land, down);
  const across = vec3(clock.wind.y.negate(), 0, clock.wind.x);
  const flutter = across.mul(sin(t.mul(2.6).add(spin.mul(1.7))).mul(FLUTTER));
  const centre = way.add(flutter.add(windAt(clock, way).mul(GUST_PUSH)).mul(midway));
  const opacity = vertexStage(clamp(t.div(FADE_IN), 0, 1).mul(clamp(t.sub(fall).div(LEAF_FADE), 0, 1).oneMinus()));
  // Whole turns about x and half as many about z: a cube lies flat at the end. The yaw is free.
  const turn = down.mul(spin).mul(2 * Math.PI);
  const tumble = vertexStage(vec3(turn, turn.mul(0.37), turn.mul(0.5)));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0, transparent: true });
  // Gone leaves shrink to a point, so they cost no fragments.
  material.positionNode = centre.add(rotate(positionGeometry, tumble).mul(step(0.001, opacity)));
  material.normalNode = transformNormalToView(rotate(normalGeometry, tumble)).normalize();
  material.colorNode = attribute('leafColour', 'vec3');
  material.opacityNode = opacity;

  const mesh = new THREE.InstancedMesh(geometry, material, leaves.length);
  mesh.name = 'leaves';
  // The shader places every leaf: the instance matrices stay identity, and the bounds mean nothing.
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.raycast = () => {};
  group.add(mesh);

  return {
    group,
    // A cube is 12 triangles.
    triangles: leaves.length * 12,
    setLife: (life) => {
      mesh.count = leavesShown(leaves.length, life);
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
