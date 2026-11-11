/**
 * The House's moving parts in the World as three.js meshes (its base and
 * the House Interior's room at ⅛ unit are static, in the World's structure
 * grid; see `structureModels.ts` and `interiorModel.ts`):
 *
 * - the lid (the House Variant's `lid` part: its roof and front walls),
 *   which `setOpening` lifts off;
 * - the House's lights: a glowing square over each open face of window
 *   glass (`houseWindowFaces`), shown at Night (`setLights`). The lid's
 *   lights lift with it.
 *
 * The lid uses the soft-voxel material in local space, built at the House's
 * place in the World (whole voxels), so seams stay on voxel edges and
 * travel with it as it lifts. It casts shadows (the sun's shadow map is
 * redrawn while it moves). The developer at work is in the House Interior
 * scene (`interior.ts`).
 */
import * as THREE from 'three/webgpu';
import type { World } from '@/world';
import { meshVoxels, triangleCount, VoxelGrid } from './mesher';
import { mergeChunks } from './structureMeshes';
import { LOOK, oklchToLinear } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { worldColours } from './worldVoxels';
import { STRUCTURE } from './voxelTiers';
import { drawHousePart, houseWindowFaces } from './structureModels';
import type { WorldTokens } from '@/data/theme';
import { roofLift } from './houseMotion';

export interface HouseParts {
  group: THREE.Group;
  /** Triangles in the lid. */
  triangles: number;
  /** Lift the lid: 0 shut, 1 fully open. */
  setOpening(opening: number): void;
  /** Light the windows, or not, as the theme says. */
  setLights(world: WorldTokens): void;
  dispose(): void;
}

export function buildHouse(world: World): HouseParts {
  const group = new THREE.Group();
  group.name = 'house';
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) return { group, triangles: 0, setOpening: () => {}, setLights: () => {}, dispose: () => {} };

  const colours = worldColours(world);
  const lidMaterial = voxelMaterial(1 / STRUCTURE, 'local');
  const geometries: THREE.BufferGeometry[] = [];
  let triangles = 0;

  /** A grid's voxels as one mesh. */
  const gridMesh = (name: string, grid: VoxelGrid, meshMaterial: THREE.Material): THREE.Mesh => {
    const chunks = meshVoxels(grid, {
      colours: colours.table.colours,
      aoStrength: LOOK.aoStrength,
      chunkSize: 128,
      solidOutside: () => false,
    });
    triangles += triangleCount(chunks);
    const geometry = mergeChunks(chunks);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  const lidGrid = new VoxelGrid(1 / STRUCTURE);
  drawHousePart(world, colours, 'lid', (x, y, z, colour) => lidGrid.set(x, y, z, colour));
  const lid = gridMesh('house-lid', lidGrid, lidMaterial);
  lid.castShadow = true;
  lid.receiveShadow = true;

  // The lights: a glowing square a hair in front of each open face of window glass,
  // one mesh for the lid's (its child, so they lift with it) and one for the base's.
  const lightMaterial = new THREE.MeshBasicNodeMaterial();
  const panes: THREE.Mesh[] = [];
  const faces = houseWindowFaces(world);
  for (const part of ['lid', 'base'] as const) {
    const own = faces.filter((face) => face.part === part);
    if (own.length === 0) continue;
    const geometry = windowLights(own);
    geometries.push(geometry);
    const pane = new THREE.Mesh(geometry, lightMaterial);
    pane.name = `house-light-${part}`;
    pane.visible = false;
    panes.push(pane);
    (part === 'lid' ? lid : group).add(pane);
  }

  return {
    group,
    triangles,
    setLights: ({ lightsOn, windowLight }) => {
      const [r, g, b] = oklchToLinear(windowLight);
      lightMaterial.color.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      for (const pane of panes) pane.visible = lightsOn;
    },
    setOpening: (opening) => {
      lid.position.y = roofLift(opening);
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      lidMaterial.dispose();
      lightMaterial.dispose();
    },
  };
}

/** How far in front of the glass a window's light sits, in world units. */
const LIGHT_LIFT = 0.003;

/** One square per lit window face (⅛ voxels), a hair in front of the glass. */
export function windowLights(faces: ReturnType<typeof houseWindowFaces>): THREE.BufferGeometry {
  const e = 1 / STRUCTURE;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const { x, y, z, facing } of faces) {
    const base = positions.length / 3;
    if (facing === '+x') {
      const px = (x + 1) * e + LIGHT_LIFT;
      positions.push(px, y * e, (z + 1) * e, px, y * e, z * e, px, (y + 1) * e, z * e, px, (y + 1) * e, (z + 1) * e);
    } else {
      const pz = (z + 1) * e + LIGHT_LIFT;
      positions.push(x * e, y * e, pz, (x + 1) * e, y * e, pz, (x + 1) * e, (y + 1) * e, pz, x * e, (y + 1) * e, pz);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
