/**
 * The land animals, birds and bats as three.js objects (ADR 0005): the
 * Biome's animal (`animal/<biome>-1`) and its bird or bat (`bird/`, `bat/`),
 * ⅛-unit structures drawn as `InstancedMesh`es, one per moving part: an
 * animal's body and its head (the `head` part), a bird's body and each wing
 * (`wingLeft`, `wingRight`). `creatures.ts` works out every pose on the
 * shared clock; `step(seconds)` sets each part's instance matrix from it on
 * the CPU (a dozen animals and a few birds), so a frozen clock holds them all.
 *
 * - An animal's body stands at its pose, turned to its heading; its head turns
 *   and dips about the neck: the front of the head part's lowest layer.
 * - A bird's body flies at its pose, banked; each wing beats about its hinge
 *   on the body's side.
 *
 * `setTheme` shows the kinds out by Day or at Night (`CREATURE_SETS`);
 * `setLife` the life tier's share of each (`creaturesShown`). They cast no
 * shadow (the shadow map is static) and are never a raycast target, so
 * pointers reach the Landmarks through them.
 */
import * as THREE from 'three/webgpu';
import { CREATURE_SETS, type World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
import { structureVoxels } from '@/structures/parse';
import type { StructurePart } from '@/structures/roles';
import type { LifeTierName } from '@/lib/lifeTier';
import type { Theme } from '@/lib/theme';
import { animalAt, birdAt, creaturesShown, walkingAnimals } from './creatures';
import { structureGeometry, structurePivot, type Point } from './structureMeshes';
import { voxelMaterial } from './voxelMaterial';
import { worldColours } from './worldVoxels';

export interface Creatures {
  group: THREE.Group;
  /** Triangles in every animal and bird (the theme and life tier may show fewer). */
  triangles: number;
  /** Put every creature where it is at the shared clock's `seconds`. */
  step(seconds: number): void;
  /** Show the kinds out by Day or at Night. */
  setTheme(theme: Theme): void;
  /** Show the life tier's share of each kind; returns how many animals and birds (or bats) show. */
  setLife(tier: LifeTierName): { animals: number; birds: number };
  dispose(): void;
}

/** A structure's part's voxels' bounds, in its own units. */
function partBounds(structure: Structure, part: StructurePart) {
  const voxels = [...structureVoxels(structure)].filter((v) => v.part === part);
  const s = structure.scale;
  const low = Math.min(...voxels.map((v) => v.y));
  const bottom = voxels.filter((v) => v.y === low);
  return {
    minX: Math.min(...voxels.map((v) => v.x)) / s,
    maxX: (Math.max(...voxels.map((v) => v.x)) + 1) / s,
    minY: low / s,
    maxY: (Math.max(...voxels.map((v) => v.y)) + 1) / s,
    /** The back of its lowest layer: where a head meets the neck. */
    neckZ: Math.min(...bottom.map((v) => v.z)) / s,
  };
}

/** The point a land animal's head turns about: the middle of its lowest layer across, at its back, on its underside. */
export function headPivot(structure: Structure): Point {
  const b = partBounds(structure, 'head');
  return { x: (b.minX + b.maxX) / 2, y: b.minY, z: b.neckZ };
}

/** The line a wing beats about: along the body's side (+z), at the wing's inner edge, halfway up it. */
export function wingHinge(structure: Structure, part: 'wingLeft' | 'wingRight'): Point {
  const b = partBounds(structure, part);
  return { x: part === 'wingLeft' ? b.maxX : b.minX, y: (b.minY + b.maxY) / 2, z: 0 };
}

export function buildCreatures(world: World): Creatures {
  const group = new THREE.Group();
  group.name = 'creatures';
  const colours = worldColours(world);
  const disposables: Array<{ dispose(): void }> = [];
  let triangles = 0;

  /** One part of a structure as an `InstancedMesh` of `count` copies, placed by `step`. */
  const partMesh = (structure: Structure, part: StructurePart, count: number, name: string) => {
    const { geometry, triangles: each } = structureGeometry(structure, colours, part);
    const material = voxelMaterial(1 / structure.scale, 'local');
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // They move every frame: no bounds to keep, no shadow (the map is static), never picked.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    group.add(mesh);
    disposables.push(geometry, material, mesh);
    triangles += each * count;
    return mesh;
  };

  const animals = walkingAnimals(world);
  const [animal] = variantsOf('animal', world.biome.id);
  const animalParts = animal && animals.length > 0 ? { body: partMesh(animal, 'base', animals.length, 'animals'), head: partMesh(animal, 'head', animals.length, 'animal-heads') } : null;

  const flights = world.birds;
  const kind = flights[0]?.kind;
  const [flyer] = kind ? variantsOf(kind, world.biome.id) : [];
  const birdParts =
    flyer && flights.length > 0
      ? {
          body: partMesh(flyer, 'base', flights.length, `${kind}s`),
          left: partMesh(flyer, 'wingLeft', flights.length, `${kind}-wings-left`),
          right: partMesh(flyer, 'wingRight', flights.length, `${kind}-wings-right`),
        }
      : null;

  const body = new THREE.Matrix4();
  const part = new THREE.Matrix4();
  const turn = new THREE.Matrix4();
  const move = (p: Point) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
  const back = (p: Point) => new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z);
  /** `m` · about `p`: turn by `r`, keeping `p` in place. */
  const about = (m: THREE.Matrix4, p: Point, r: THREE.Matrix4) => m.multiply(move(p)).multiply(r).multiply(back(p));

  const animalPivot = animal ? structurePivot(animal) : null;
  const neck = animal && animalParts ? headPivot(animal) : null;
  const flyerPivot = flyer ? { ...structurePivot(flyer), y: flyer.size.y / flyer.scale / 2 } : null;
  const hinges = flyer && birdParts ? { left: wingHinge(flyer, 'wingLeft'), right: wingHinge(flyer, 'wingRight') } : null;

  const step = (seconds: number) => {
    if (animalParts && animalPivot && neck) {
      animals.forEach((a, i) => {
        const pose = animalAt(a, seconds);
        body.makeTranslation(pose.x, pose.y, pose.z).multiply(turn.makeRotationY(pose.yaw)).multiply(back(animalPivot));
        animalParts.body.setMatrixAt(i, body);
        const head = new THREE.Matrix4().makeRotationY(pose.headYaw).multiply(new THREE.Matrix4().makeRotationX(pose.headPitch));
        animalParts.head.setMatrixAt(i, about(part.copy(body), neck, head));
      });
      animalParts.body.instanceMatrix.needsUpdate = true;
      animalParts.head.instanceMatrix.needsUpdate = true;
    }
    if (birdParts && flyerPivot && hinges) {
      flights.forEach((f, i) => {
        const pose = birdAt(f, seconds);
        body
          .makeTranslation(pose.x, pose.y, pose.z)
          .multiply(turn.makeRotationY(pose.yaw))
          .multiply(new THREE.Matrix4().makeRotationZ(pose.bank))
          .multiply(back(flyerPivot));
        birdParts.body.setMatrixAt(i, body);
        // Raising the left wing (−x) turns it the other way about the body's length from the right one (+x).
        birdParts.left.setMatrixAt(i, about(part.copy(body), hinges.left, turn.makeRotationZ(-pose.flap)));
        birdParts.right.setMatrixAt(i, about(part.copy(body), hinges.right, turn.makeRotationZ(pose.flap)));
      });
      for (const mesh of [birdParts.body, birdParts.left, birdParts.right]) mesh.instanceMatrix.needsUpdate = true;
    }
  };
  step(0);

  const animalMeshes = animalParts ? [animalParts.body, animalParts.head] : [];
  const birdMeshes = birdParts ? [birdParts.body, birdParts.left, birdParts.right] : [];
  let theme: Theme = 'day';
  let tier: LifeTierName = 'full';
  const counts = () => {
    const out = CREATURE_SETS[world.biome.id][theme];
    return {
      animals: out.includes('animal') && animalParts ? creaturesShown(animals.length, tier) : 0,
      birds: kind && out.includes(kind) && birdParts ? creaturesShown(flights.length, tier) : 0,
    };
  };
  const apply = () => {
    const shown = counts();
    for (const mesh of animalMeshes) {
      mesh.count = shown.animals;
      mesh.visible = shown.animals > 0;
    }
    for (const mesh of birdMeshes) {
      mesh.count = shown.birds;
      mesh.visible = shown.birds > 0;
    }
    return shown;
  };

  return {
    group,
    triangles,
    step,
    setTheme: (next) => {
      theme = next;
      apply();
    },
    setLife: (next) => {
      tier = next;
      return apply();
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
