/**
 * Basic World render: one instanced box per visible terrain voxel, coloured
 * from the World's Biome (surface on top, cliff strata below, path cells in
 * the path colour), bridge decks, stairs, shallow and deep water, and one
 * placeholder block per placed Landmark, under an isometric orthographic
 * camera. The soft-voxel look (mesher, TSL seams/bevel/jitter, AO) replaces
 * this in ticket 04.
 */
import * as THREE from 'three/webgpu';
import type { BiomeColourRole, Oklch, PlacedLandmarkId, World } from '../world';

/** Fixed colours that never change with the Biome (sRGB). */
const SKY = 0xe8eef2;

const LANDMARK_BLOCKS: Record<PlacedLandmarkId, { colour: number; height: number }> = {
  station: { colour: 0x8a94a6, height: 2.5 },
  house: { colour: 0xf2efe6, height: 1.5 },
  garden: { colour: 0x6f9a5e, height: 1 },
  dock: { colour: 0x9c7b5b, height: 0.4 },
  mailbox: { colour: 0x5f7fb0, height: 0.8 },
};

/** Direction from the target to the camera: true isometric (azimuth 45°, elevation ≈35.26°). */
const ISO_DIRECTION = new THREE.Vector3(1, 1, 1).normalize();
/** Sea cells this close to land (Chebyshev) are shallow water. */
const SHALLOW_REACH = 2;
const SEA_LEVEL = 0.15;

export async function mountWorld(canvas: HTMLCanvasElement, world: World): Promise<() => void> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.add(buildTerrain(world), buildSea(world), buildBridges(world), buildStairs(world), buildLandmarks(world));

  scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x9fa89a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
  sun.position.set(-0.6, 1, 0.35);
  scene.add(sun);

  const { target, radius } = world.views.overview;
  const centre = new THREE.Vector3(target.x, target.y, target.z);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.copy(centre).addScaledVector(ISO_DIRECTION, radius * 4);
  camera.lookAt(centre);

  // Render on demand: once now, and again only when the canvas size changes.
  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    // A square of half-size r spans r·√2 each side horizontally in isometric view.
    const halfHeight = Math.max(radius * 0.9, (radius * Math.SQRT2) / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return () => {
    observer.disconnect();
    renderer.dispose();
  };
}

/** OKLCH to a three.js colour (linear sRGB, clamped to gamut). */
export function oklchColour({ l, c, h }: Oklch): THREE.Color {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return new THREE.Color().setRGB(
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
    THREE.LinearSRGBColorSpace,
  );
}

function biomeColours(world: World): Record<BiomeColourRole, THREE.Color> {
  return Object.fromEntries(
    Object.entries(world.biome.colours).map(([role, colour]) => [role, oklchColour(colour)]),
  ) as Record<BiomeColourRole, THREE.Color>;
}

interface Box {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  colour: THREE.Color;
}

/** One instanced mesh of unit boxes, each placed by its min corner and scaled. */
function instancedBoxes(boxes: Box[]): THREE.Object3D {
  if (boxes.length === 0) return new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0.5, 0.5, 0.5);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertNodeMaterial(), boxes.length);
  const matrix = new THREE.Matrix4();
  boxes.forEach((b, n) => {
    matrix.makeScale(b.sx, b.sy, b.sz).setPosition(b.x, b.y, b.z);
    mesh.setMatrixAt(n, matrix);
    mesh.setColorAt(n, b.colour);
  });
  return mesh;
}

/** A faint per-voxel lightness change so single voxels stay readable. */
function jitter(colour: THREE.Color, x: number, y: number, z: number): THREE.Color {
  return colour.clone().offsetHSL(0, 0, (((x * 7 + y * 5 + z * 13) % 5) - 2) * 0.006);
}

/**
 * One box per visible terrain voxel. The top voxel of a column takes its
 * surface colour (or the path colour); buried voxels take their stratum's
 * colour, so cliffs show layered bands. Fully enclosed voxels are skipped.
 */
function buildTerrain(world: World): THREE.Object3D {
  const { width, depth, heights, isle, surface } = world.terrain;
  const colours = biomeColours(world);
  const pathCells = new Set(world.paths.flatMap((p) => p.cells.map((c) => c.z * width + c.x)));
  const heightAt = (x: number, z: number) => (x < 0 || z < 0 || x >= width || z >= depth ? 0 : heights[z * width + x]!);
  const boxes: Box[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      const h = heights[i]!;
      if (isle[i] === -1) continue;
      const lowestNeighbour = Math.min(heightAt(x + 1, z), heightAt(x - 1, z), heightAt(x, z + 1), heightAt(x, z - 1));
      for (let y = Math.min(lowestNeighbour, h - 1); y < h; y++) {
        const top = y === h - 1;
        const kind = surface[i]!;
        const role: BiomeColourRole = top
          ? pathCells.has(i) ? 'path' : kind === 'sea' ? 'sand' : kind
          : (world.strata[y] ?? 'rock');
        boxes.push({ x, y, z, sx: 1, sy: 1, sz: 1, colour: jitter(colours[role], x, y, z) });
      }
    }
  }
  return instancedBoxes(boxes);
}

/** Deep water as one wide plane, shallow water as tiles beside the land. */
function buildSea(world: World): THREE.Group {
  const { width, depth, isle } = world.terrain;
  const colours = biomeColours(world);
  const group = new THREE.Group();

  // Far wider than the grid so the sea fills the frame at any aspect ratio.
  const geometry = new THREE.PlaneGeometry(width * 6, depth * 6);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(width / 2, SEA_LEVEL, depth / 2);
  group.add(new THREE.Mesh(geometry, new THREE.MeshLambertNodeMaterial({ color: colours.waterDeep })));

  const nearLand = (x: number, z: number) => {
    for (let dz = -SHALLOW_REACH; dz <= SHALLOW_REACH; dz++) {
      for (let dx = -SHALLOW_REACH; dx <= SHALLOW_REACH; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < width && nz < depth && isle[nz * width + nx] !== -1) return true;
      }
    }
    return false;
  };
  const shallow: Box[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      if (isle[z * width + x] === -1 && nearLand(x, z)) {
        shallow.push({ x, y: SEA_LEVEL, z, sx: 1, sy: 0.02, sz: 1, colour: colours.waterShallow });
      }
    }
  }
  group.add(instancedBoxes(shallow));
  return group;
}

/** A plank deck per bridge cell, its top level with the land at both ends. */
function buildBridges(world: World): THREE.Object3D {
  const colour = biomeColours(world).bridge;
  const boxes = world.bridges.flatMap((b) =>
    b.cells.map((c, k) => ({ x: c.x, y: b.y - 0.25, z: c.z, sx: 1, sy: 0.25, sz: 1, colour: jitter(colour, c.x, k, c.z) })),
  );
  return instancedBoxes(boxes);
}

/** Two steps on the lower cell, rising towards the higher cell. */
function buildStairs(world: World): THREE.Object3D {
  const colour = biomeColours(world).path.clone().offsetHSL(0, 0, -0.06);
  const boxes: Box[] = [];
  for (const s of world.stairs) {
    for (const [offset, height] of [
      [0.33, 0.33],
      [0.66, 0.66],
    ] as const) {
      // The step occupies the band of the cell from `offset` to the high side.
      const depth = 1 - offset;
      const box = { y: s.y, sy: height, colour } as Box;
      if (s.facing === 'east') Object.assign(box, { x: s.cell.x + offset, z: s.cell.z, sx: depth, sz: 1 });
      if (s.facing === 'west') Object.assign(box, { x: s.cell.x, z: s.cell.z, sx: depth, sz: 1 });
      if (s.facing === 'south') Object.assign(box, { x: s.cell.x, z: s.cell.z + offset, sx: 1, sz: depth });
      if (s.facing === 'north') Object.assign(box, { x: s.cell.x, z: s.cell.z, sx: 1, sz: depth });
      boxes.push(box);
    }
  }
  return instancedBoxes(boxes);
}

/** A simple placeholder block per placed Landmark. */
function buildLandmarks(world: World): THREE.Group {
  const group = new THREE.Group();
  for (const landmark of world.landmarks) {
    const block = LANDMARK_BLOCKS[landmark.id];
    const geometry = new THREE.BoxGeometry(0.8, block.height, 0.8);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertNodeMaterial({ color: block.colour }));
    mesh.position.set(landmark.cell.x + 0.5, landmark.y + block.height / 2, landmark.cell.z + 0.5);
    mesh.name = landmark.id;
    group.add(mesh);
  }
  return group;
}
