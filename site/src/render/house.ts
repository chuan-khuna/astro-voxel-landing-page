/**
 * The House's moving parts as three.js meshes (its base and room are static,
 * in the World's detail grid; see `houseModel.ts`):
 *
 * - the lid (roof, dome and front walls), which `setOpening` lifts off;
 * - the developer's head and hands, which `work(seconds)` animates;
 * - the computer's screen, a glowing plane that scrolls lines of code.
 *
 * Every voxel mesh uses the soft-voxel material in local space, built at the
 * House's place in the World (whole ¼ voxels), so seams stay on voxel edges
 * and travel with a part as it moves. The lid casts shadows (the sun's
 * shadow map is redrawn while it moves); the developer does not.
 */
import * as THREE from 'three/webgpu';
import type { UniformNode } from 'three/webgpu';
import { float, floor, fract, hash, mix, step, uniform, uv, vec2, vec3 } from 'three/tsl';
import type { World } from '../world';
import { meshVoxels, triangleCount, VoxelGrid, type ChunkMesh } from './mesher';
import { LOOK, oklchToLinear, FIXED_COLOURS } from './palette';
import { voxelMaterial } from './voxelMaterial';
import { DETAIL, worldColours } from './worldVoxels';
import { landmarkOrigin } from './landmarkModels';
import { DEVELOPER_PARTS, SCREEN, drawDeveloperPart, drawHouseLid, type DeveloperPart, type HouseDraw } from './houseModel';
import { developerPose, roofLift } from './houseMotion';

export interface HouseParts {
  group: THREE.Group;
  /** Triangles in the lid and the developer's moving parts. */
  triangles: number;
  /** Lift the lid: 0 shut, 1 fully open. */
  setOpening(opening: number): void;
  /** Pose the developer and the screen `seconds` into their work. */
  work(seconds: number): void;
  dispose(): void;
}

/** Lines of code the screen scrolls a second. */
const LINES_PER_SECOND = 2.5;
/** The screen's pixel grid: columns across, rows down. */
const SCREEN_GRID = { cols: 14, rows: 7 };

const linear = (name: keyof typeof FIXED_COLOURS) => {
  const [r, g, b] = oklchToLinear(FIXED_COLOURS[name]);
  return vec3(r, g, b);
};

export function buildHouse(world: World): HouseParts {
  const group = new THREE.Group();
  group.name = 'house';
  const house = world.landmarks.find((l) => l.id === 'house');
  if (!house) return { group, triangles: 0, setOpening: () => {}, work: () => {}, dispose: () => {} };

  const origin = landmarkOrigin(house);
  const colours = worldColours(world);
  const material = voxelMaterial(1 / DETAIL, 'local');
  const geometries: THREE.BufferGeometry[] = [];
  let triangles = 0;

  /** One part's voxels, at the House's place in the World, as a mesh. */
  const partMesh = (name: string, paint: (draw: HouseDraw) => void): THREE.Mesh => {
    const grid = new VoxelGrid(1 / DETAIL);
    paint({
      box: (x0, y0, z0, x1, y1, z1, colour) =>
        grid.box(origin.x + x0, origin.y + y0, origin.z + z0, origin.x + x1, origin.y + y1, origin.z + z1, colour),
      set: (x, y, z, colour) => grid.set(origin.x + x, origin.y + y, origin.z + z, colour),
    });
    const chunks = meshVoxels(grid, {
      colours: colours.table.colours,
      aoStrength: LOOK.aoStrength,
      chunkSize: 64,
      solidOutside: () => false,
    });
    triangles += triangleCount(chunks);
    const geometry = mergedGeometry(chunks);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  const lid = partMesh('house-lid', (draw) => drawHouseLid(draw, colours));
  lid.castShadow = true;
  lid.receiveShadow = true;

  const parts = new Map<DeveloperPart, THREE.Mesh>();
  for (const part of DEVELOPER_PARTS) {
    const mesh = partMesh(`developer-${part}`, (draw) => drawDeveloperPart(part, draw, colours));
    mesh.receiveShadow = true;
    parts.set(part, mesh);
  }

  // The screen: a plane on the computer's face, facing +x, a hair in front of it.
  const q = 1 / DETAIL;
  const screenGeometry = new THREE.PlaneGeometry((SCREEN.z1 - SCREEN.z0) * q, (SCREEN.y1 - SCREEN.y0) * q);
  // Turned to face +x; its u then runs along −z, left to right as the camera sees it.
  screenGeometry.rotateY(Math.PI / 2);
  screenGeometry.translate(
    (origin.x + SCREEN.x) * q + 0.002,
    (origin.y + (SCREEN.y0 + SCREEN.y1) / 2) * q,
    (origin.z + (SCREEN.z0 + SCREEN.z1) / 2) * q,
  );
  geometries.push(screenGeometry);
  const time = uniform(0);
  const screenMaterial = new THREE.MeshBasicNodeMaterial();
  screenMaterial.colorNode = codeScreen(time);
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.name = 'screen';
  group.add(screen);

  return {
    group,
    triangles,
    setOpening: (opening) => {
      lid.position.y = roofLift(opening);
    },
    work: (seconds) => {
      const pose = developerPose(seconds);
      for (const [part, mesh] of parts) mesh.position.y = pose[part].y;
      time.value = seconds;
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      material.dispose();
      screenMaterial.dispose();
    },
  };
}

/**
 * Lines of code on a dark screen, drawn as a coarse pixel grid: each line
 * indented and as long as a hash of its number says, in one of three
 * muted syntax colours, with gaps between words and the odd blank line.
 * The text scrolls up a line at a time as `time` grows.
 */
function codeScreen(time: UniformNode<'float'>) {
  const { cols, rows } = SCREEN_GRID;
  const p = uv().mul(vec2(cols, rows));
  const cell = floor(p);
  const f = fract(p);
  // Line number from the top, scrolled.
  const line = float(rows - 1)
    .sub(cell.y)
    .add(floor(time.mul(LINES_PER_SECOND)));
  const indent = floor(hash(line.mul(3.1)).mul(3)).add(1);
  const length = indent.add(3).add(floor(hash(line.add(17)).mul(cols - 6)));
  const word = step(0.18, hash(line.mul(31).add(cell.x.mul(7))));
  const blank = step(0.15, hash(line.add(5)));
  const on = step(indent, cell.x).mul(step(cell.x, length)).mul(word).mul(blank);
  // A gap round every pixel, so the text reads as pixels.
  const lit = step(0.12, f.x).mul(step(f.x, 0.88)).mul(step(0.18, f.y)).mul(step(f.y, 0.82));
  const h = hash(line.mul(7.7));
  const ink = mix(mix(linear('shirt'), linear('bougainLight'), step(0.55, h)), linear('whitewash'), step(0.85, h));
  return mix(linear('screenDark').mul(1.4), ink.mul(1.15), on.mul(lit));
}


/** Several chunk meshes as one geometry. */
function mergedGeometry(chunks: ChunkMesh[]): THREE.BufferGeometry {
  const quads = chunks.reduce((n, c) => n + c.positions.length, 0);
  const positions = new Float32Array(quads);
  const normals = new Float32Array(quads);
  const colours = new Float32Array(quads);
  const indices: number[] = [];
  let offset = 0;
  for (const chunk of chunks) {
    positions.set(chunk.positions, offset);
    normals.set(chunk.normals, offset);
    colours.set(chunk.colours, offset);
    const base = offset / 3;
    for (const i of chunk.indices) indices.push(base + i);
    offset += chunk.positions.length;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
