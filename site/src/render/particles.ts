/**
 * The Biome's particles as three.js objects (ADR 0005): butterflies,
 * fireflies, snow and ash, one `InstancedMesh` of ⅛-unit cubes per kind,
 * moved entirely in the vertex shader on the shared Ambient Life clock and
 * wind (`ambientClock.ts`). `swarms.ts` works out each particle's path,
 * colour and timing inside the areas `generateWorld` placed; the shader
 * plays it:
 *
 * - butterflies loop round their clump, bobbing as they flap, the cube
 *   folding across as its wings beat;
 * - fireflies drift slowly low over the grass and blink, glowing (unlit);
 * - snow and ash fall down the wind, swaying across it and pushed by its
 *   gusts, turning slowly, fading in at the top and out near the ground;
 * - a frozen clock holds every particle where it is.
 *
 * `setTheme` shows the kinds out by Day or at Night (`particlesOut`);
 * `setLife` shows the life tier's share of each (`swarmShown`). Particles
 * cast no shadow and are never a raycast target, so pointers reach the
 * Landmarks and the Garden's plants through them.
 */
import * as THREE from 'three/webgpu';
import {
  abs,
  attribute,
  float,
  fract,
  max,
  normalGeometry,
  positionGeometry,
  pow,
  rotate,
  sin,
  smoothstep,
  transformNormalToView,
  vec3,
  vertexStage,
} from 'three/tsl';
import { PARTICLE_KINDS, type ParticleKind, type World } from '@/world';
import type { LifeTierName } from '@/lib/lifeTier';
import type { Theme } from '@/lib/theme';
import { glowsWith } from './blockLightNode';
import { windAt, type AmbientClock } from './ambientClock';
import { BUTTERFLY_BOB, FALL_GUST, FALL_SWAY, PARTICLE_SIZE, particlesOut, swarmShown, swarms, SWARM_MOTION, type SwarmParticle } from './swarms';

const TAU = 2 * Math.PI;

export interface Particles {
  group: THREE.Group;
  /** Triangles in every particle of every kind (Day's and Night's; the theme and life tier show fewer). */
  triangles: number;
  /** Show the kinds out by Day or at Night. */
  setTheme(theme: Theme): void;
  /** Show as many of each kind as the life tier allows. */
  setLife(tier: LifeTierName): void;
  dispose(): void;
}

export function buildParticles(world: World, clock: AmbientClock): Particles {
  const group = new THREE.Group();
  group.name = 'particles';
  const all = swarms(world);
  const meshes = new Map<ParticleKind, { mesh: THREE.InstancedMesh; total: number }>();
  const disposables: Array<{ dispose(): void }> = [];

  for (const kind of PARTICLE_KINDS) {
    const particles = all[kind];
    if (particles.length === 0) continue;
    const geometry = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    const per = (size: number, value: (p: SwarmParticle) => number[]) =>
      new THREE.InstancedBufferAttribute(new Float32Array(particles.flatMap(value)), size);
    geometry.setAttribute('swarmCentre', per(3, (p) => [p.centre.x, p.centre.y, p.centre.z]));
    geometry.setAttribute('swarmSweep', per(3, (p) => [p.sweep.x, p.sweep.y, p.sweep.z]));
    geometry.setAttribute('swarmTime', per(3, (p) => [p.period, p.phase, p.beat]));
    geometry.setAttribute('swarmColour', per(3, (p) => [...p.colour]));
    const material = particleMaterial(kind, clock);
    const mesh = new THREE.InstancedMesh(geometry, material, particles.length);
    mesh.name = `particles-${kind}`;
    // The shader places every particle: the instance matrices stay identity, and the bounds mean nothing.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = kind !== 'firefly';
    mesh.raycast = () => {};
    group.add(mesh);
    meshes.set(kind, { mesh, total: particles.length });
    disposables.push(geometry, material, mesh);
  }

  return {
    group,
    // A cube is 12 triangles.
    triangles: PARTICLE_KINDS.reduce((sum, kind) => sum + all[kind].length * 12, 0),
    setTheme: (theme) => {
      const out = particlesOut(world, theme);
      for (const [kind, { mesh }] of meshes) mesh.visible = out.includes(kind);
    },
    setLife: (tier) => {
      for (const { mesh, total } of meshes.values()) mesh.count = swarmShown(total, tier);
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/** The material that moves and colours one kind of particle on the shared clock. */
function particleMaterial(kind: ParticleKind, clock: AmbientClock): THREE.NodeMaterial {
  const centre = attribute('swarmCentre', 'vec3');
  const sweep = attribute('swarmSweep', 'vec3');
  const timing = attribute('swarmTime', 'vec3');
  const period = timing.x;
  const phase = timing.y;
  const beat = timing.z;
  const colour = attribute('swarmColour', 'vec3');
  const t = clock.time;
  /** Its flap, blink or sway: −1 to 1, every `beat` seconds. */
  const pulse = sin(t.div(beat).add(phase.mul(7)).mul(TAU));

  if (SWARM_MOTION[kind] === 'wander') {
    const a = t.div(period).add(phase).mul(TAU);
    const loop = vec3(sin(a), sin(a.mul(1.7).add(1)), sin(a.mul(0.6).add(2)));
    const at = centre.add(sweep.mul(loop));
    if (kind === 'butterfly') {
      const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.7, metalness: 0 });
      // Wings beat: the cube folds across (to a third) and bobs.
      const fold = vertexStage(abs(pulse).mul(0.67).add(0.33));
      const shape = positionGeometry.mul(vec3(fold, 1, 1));
      material.positionNode = at.add(vec3(0, pulse.mul(BUTTERFLY_BOB), 0)).add(shape);
      material.colorNode = colour;
      return material;
    }
    // A firefly glows on its own, dim between blinks: all its light emissive, so it blooms at Night (it throws no block light).
    const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const blink = vertexStage(pow(max(float(0), pulse), 3));
    material.positionNode = at.add(positionGeometry);
    glowsWith(material, colour.mul(blink.mul(0.6).add(0.4)));
    material.opacityNode = blink.mul(0.85).add(0.15);
    return material;
  }

  // Snow and ash: down from centre − sweep to centre + sweep, again and again.
  const u = fract(t.div(period).add(phase));
  const way = centre.add(sweep.mul(u.mul(2).sub(1)));
  const across = vec3(clock.wind.y.negate(), 0, clock.wind.x);
  const drift = way.add(across.mul(pulse.mul(FALL_SWAY))).add(windAt(clock, way).mul(FALL_GUST));
  const turn = t.mul(0.9).add(phase.mul(TAU));
  const tumble = vertexStage(vec3(turn, turn.mul(0.6), turn.mul(0.3)));
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, transparent: true });
  material.positionNode = drift.add(rotate(positionGeometry, tumble));
  material.normalNode = transformNormalToView(rotate(normalGeometry, tumble)).normalize();
  material.colorNode = colour;
  material.opacityNode = vertexStage(smoothstep(0, 0.08, u).mul(smoothstep(1, 0.88, u)));
  return material;
}
