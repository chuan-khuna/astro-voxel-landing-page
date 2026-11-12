/**
 * The fish as three.js objects (ADR 0005): one `InstancedMesh` of the
 * Biome's fish structure (`fish/<biome>-1`, ⅛-unit voxels, one voxel tall)
 * with one instance per fish of every school, and one `InstancedMesh` of
 * ⅛-unit cubes for the spray their leaps throw up. `schools.ts` works out
 * each fish's numbers; the vertex shader plays them on the shared Ambient
 * Life clock by the same sums as `fishAt` and `sprayAt`: round the loop
 * under the water, wiggling, and now and then a leap nose up out of the
 * water and back in, spray flying up where it breaks the surface. A frozen
 * clock holds every fish where it is.
 *
 * The fish swim under the translucent shallows and show through them; they
 * cast no shadow (the shadow map is static) and are never a raycast target.
 * `setLife` shows the life tier's share of the schools (`fishShown`);
 * `setTheme` colours the spray as the foam (`WorldTokens.foam`) and dims
 * the fish's own light at Night (`FISH_GLOW`).
 */
import * as THREE from 'three/webgpu';
import {
  attribute,
  clamp,
  cos,
  float,
  fract,
  normalGeometry,
  positionGeometry,
  sign,
  sin,
  atan,
  step,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
  vertexStage,
} from 'three/tsl';
import type { World } from '@/world';
import { variantsOf } from '@/structures';
import type { LifeTierName } from '@/lib/lifeTier';
import type { Theme } from '@/lib/theme';
import { THEME_TOKENS } from '@/data/theme';
import type { AmbientClock } from './ambientClock';
import { oklchToLinear } from './palette';
import { SEA_LEVEL } from './seaModel';
import {
  FISH_THICKNESS,
  FISH_Y,
  fishShown,
  LEAP_BACK,
  LEAP_FORWARD,
  LEAP_HEIGHT,
  LEAP_TIME,
  schoolFish,
  sprayDrops,
  sprayShown,
  SPRAY_GRAVITY,
  SPRAY_SIZE,
  WIGGLE,
  WIGGLE_RATE,
  type SwimmingFish,
} from './schools';
import { structureGeometry, structurePivot } from './structureMeshes';
import { softVoxelLook } from './voxelMaterial';
import { worldColours } from './worldVoxels';

export interface Fish {
  group: THREE.Group;
  /** Triangles in every fish and every drop of spray (the life tier may show fewer). */
  triangles: number;
  setTheme(theme: Theme): void;
  /** Show the life tier's share of the schools; returns how many fish show. */
  setLife(tier: LifeTierName): number;
  dispose(): void;
}

type Float = THREE.Node<'float'>;

/** How much of its colour a fish gives off: enough to show through the water's tint by Day; little at Night, so it never glows. */
const FISH_GLOW: Record<Theme, number> = { day: 0.45, night: 0.1 };

const smooth = (v: Float) => v.mul(v).mul(float(3).sub(v.mul(2)));

/** The shader's view of one fish's numbers (its instance attributes) and its sums, as `schools.ts`. */
function fishNodes(time: Float) {
  const centre = attribute('fishCentre', 'vec2');
  const swim = attribute('fishSwim', 'vec3');
  const leap = attribute('fishLeap', 'vec3');
  const ring = swim.x;
  const turn = swim.y;
  const angle = swim.z;
  const every = leap.x;
  const phase = leap.y;
  const wiggle = leap.z;
  /** Its place round the loop at `t`, and which way it swims there. */
  const onLoop = (t: Float) => {
    const a = angle.add(turn.mul(t));
    const way = sign(turn);
    return {
      at: centre.add(vec2(cos(a), sin(a)).mul(ring)),
      way: vec2(sin(a).negate(), cos(a)).mul(way),
    };
  };
  /** Seconds into its leap period. */
  const clock = fract(time.div(every).add(phase)).mul(every);
  return { onLoop, clock, wiggle };
}

/** Each fish's numbers as instance attributes. */
function fishAttributes(geometry: THREE.BufferGeometry, fish: readonly SwimmingFish[], each = 1) {
  const per = (size: number, value: (f: SwimmingFish) => number[]) =>
    new THREE.InstancedBufferAttribute(new Float32Array(fish.flatMap((f) => Array.from({ length: each }, () => value(f)).flat())), size);
  geometry.setAttribute('fishCentre', per(2, (f) => [f.centre.x, f.centre.z]));
  geometry.setAttribute('fishSwim', per(3, (f) => [f.ring, f.turn, f.angle]));
  geometry.setAttribute('fishLeap', per(3, (f) => [f.leapEvery, f.leapPhase, f.wiggle]));
}

export function buildFish(world: World, clock: AmbientClock): Fish {
  const group = new THREE.Group();
  group.name = 'fish';
  const fish = schoolFish(world);
  const [species] = variantsOf('fish', world.biome.id);
  const disposables: Array<{ dispose(): void }> = [];
  const meshes: THREE.InstancedMesh[] = [];
  const spray = { colour: uniform(new THREE.Vector3(1, 1, 1)), glow: uniform(new THREE.Vector3()), strength: uniform(0) };
  const glow = uniform(FISH_GLOW.day);
  let triangles = 0;
  let fishMesh: THREE.InstancedMesh | null = null;
  let sprayMesh: THREE.InstancedMesh | null = null;

  if (species && fish.length > 0) {
    const { geometry, triangles: each } = structureGeometry(species, worldColours(world));
    fishAttributes(geometry, fish);
    const material = fishMaterial(clock, structurePivot(species), glow);
    fishMesh = new THREE.InstancedMesh(geometry, material, fish.length);
    fishMesh.name = 'fish';
    triangles += each * fish.length;
    meshes.push(fishMesh);
    disposables.push(geometry, material, fishMesh);

    const drops = sprayDrops(fish, world.seed);
    const sprayGeometry = new THREE.BoxGeometry(SPRAY_SIZE, SPRAY_SIZE, SPRAY_SIZE);
    // Its fish's numbers, then its own.
    fishAttributes(sprayGeometry, drops.map((d) => fish[d.fish]!));
    sprayGeometry.setAttribute('sprayDrop', new THREE.InstancedBufferAttribute(new Float32Array(drops.flatMap((d) => [d.at, d.heading, d.out, d.up])), 4));
    const sprayMaterial = sprayMaterialOf(clock, spray);
    sprayMesh = new THREE.InstancedMesh(sprayGeometry, sprayMaterial, drops.length);
    sprayMesh.name = 'spray';
    triangles += 12 * drops.length;
    meshes.push(sprayMesh);
    disposables.push(sprayGeometry, sprayMaterial, sprayMesh);
  }
  for (const mesh of meshes) {
    // The shader places every fish and drop: the instance matrices stay identity, and the bounds mean nothing.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    group.add(mesh);
  }

  return {
    group,
    triangles,
    setTheme: (theme) => {
      const tokens = THEME_TOKENS[theme].world;
      spray.colour.value.set(...oklchToLinear(tokens.foam));
      spray.glow.value.set(...oklchToLinear(tokens.surfGlow));
      spray.strength.value = tokens.surfGlowStrength;
      glow.value = FISH_GLOW[theme];
    },
    setLife: (tier) => {
      if (!fishMesh || !sprayMesh) return 0;
      fishMesh.count = fishShown(world.fish, tier);
      sprayMesh.count = sprayShown(world.fish, tier);
      return fishMesh.count;
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/** The fish's material: its structure's voxels in the soft-voxel look, placed and turned by `fishAt`'s sums. */
function fishMaterial(clock: AmbientClock, pivot: { x: number; z: number }, glow: THREE.UniformNode<'float', number>): THREE.NodeMaterial {
  const t = clock.time;
  const { onLoop, clock: s, wiggle } = fishNodes(t);
  const loop = onLoop(t);
  const u = clamp(s.div(LEAP_TIME), 0, 1);
  const back = clamp(s.sub(LEAP_TIME).div(LEAP_BACK), 0, 1);
  const forward = u.mul(LEAP_FORWARD).mul(float(1).sub(smooth(back)));
  const envelope = smooth(clamp(u.div(0.15), 0, 1)).mul(float(1).sub(smooth(clamp(u.sub(0.85).div(0.15), 0, 1))));
  const pitch = vertexStage(atan(float(4 * LEAP_HEIGHT).mul(float(1).sub(u.mul(2))), float(LEAP_FORWARD)).mul(envelope));
  const yaw = vertexStage(atan(loop.way.x, loop.way.y).add(sin(t.mul(WIGGLE_RATE * 2 * Math.PI).add(wiggle)).mul(WIGGLE)));
  const at = loop.at.add(loop.way.mul(forward));
  const lift = u.mul(float(1).sub(u)).mul(4 * LEAP_HEIGHT);

  /** Pitch the nose (+z) up, then turn to the heading: as `fishAt`'s pose. */
  const turnPoint = (p: THREE.Node<'vec3'>) => {
    const cp = cos(pitch);
    const sp = sin(pitch);
    const y = p.y.mul(cp).add(p.z.mul(sp));
    const z = p.z.mul(cp).sub(p.y.mul(sp));
    const cy = cos(yaw);
    const sy = sin(yaw);
    return vec3(p.x.mul(cy).add(z.mul(sy)), y, z.mul(cy).sub(p.x.mul(sy)));
  };
  const local = positionGeometry.sub(vec3(pivot.x, FISH_THICKNESS / 2, pivot.z));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0 });
  material.positionNode = vec3(at.x, lift.add(FISH_Y + FISH_THICKNESS / 2), at.y).add(turnPoint(local));
  material.normalNode = transformNormalToView(turnPoint(normalGeometry)).normalize();
  const colour = softVoxelLook(FISH_THICKNESS, normalGeometry, positionGeometry).shade(attribute('color', 'vec3'));
  material.colorNode = colour;
  // A little light of their own, so the fish still read through the shallows' tint.
  material.emissiveNode = colour.mul(glow);
  return material;
}

/** The spray's material: each drop flies up from where its fish broke the surface and falls back, as `sprayAt`; hidden (no size) while not flying. */
function sprayMaterialOf(
  clock: AmbientClock,
  spray: { colour: THREE.UniformNode<'vec3', THREE.Vector3>; glow: THREE.UniformNode<'vec3', THREE.Vector3>; strength: THREE.UniformNode<'float', number> },
): THREE.NodeMaterial {
  const t = clock.time;
  const { onLoop, clock: s } = fishNodes(t);
  const drop = attribute('sprayDrop', 'vec4');
  const at = drop.x;
  const heading = drop.y;
  const out = drop.z;
  const up = drop.w;
  const tau = s.sub(at.mul(LEAP_TIME));
  const life = up.mul(2 / SPRAY_GRAVITY);
  const flying = step(0, tau).mul(float(1).sub(step(life, tau)));
  const from = onLoop(t.sub(tau));
  const broke = from.at.add(from.way.mul(at.mul(LEAP_FORWARD)));
  const across = broke.add(vec2(sin(heading), cos(heading)).mul(out.mul(tau)));
  const height = up.mul(tau).sub(tau.mul(tau).mul(SPRAY_GRAVITY / 2)).add(SEA_LEVEL);
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.6, metalness: 0 });
  material.positionNode = vec3(across.x, height, across.y).add(positionGeometry.mul(flying));
  material.colorNode = spray.colour;
  material.emissiveNode = spray.glow.mul(spray.strength).mul(0.5);
  return material;
}
