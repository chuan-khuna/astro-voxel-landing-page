/**
 * Basic World render (tracer bullet): terrain columns, a sea plane and one
 * placeholder block per placed Landmark, under an isometric orthographic
 * camera. The soft-voxel look (mesher, TSL seams/bevel/jitter, AO) replaces
 * this in ticket 04.
 */
import * as THREE from 'three/webgpu';
import type { PlacedLandmarkId, World } from '../world';

// Placeholder colours (sRGB). Biome colours replace these in ticket 03.
const COLOURS = {
  sea: 0x8fb8c9,
  land: 0xa9c08f,
  sky: 0xe8eef2,
};

const LANDMARK_BLOCKS: Record<PlacedLandmarkId, { colour: number; height: number }> = {
  station: { colour: 0x8a94a6, height: 2.5 },
  house: { colour: 0xf2efe6, height: 1.5 },
  garden: { colour: 0x6f9a5e, height: 1 },
  dock: { colour: 0x9c7b5b, height: 0.4 },
  mailbox: { colour: 0x5f7fb0, height: 0.8 },
};

/** Direction from the target to the camera: true isometric (azimuth 45°, elevation ≈35.26°). */
const ISO_DIRECTION = new THREE.Vector3(1, 1, 1).normalize();

export async function mountWorld(canvas: HTMLCanvasElement, world: World): Promise<() => void> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOURS.sky);
  scene.add(buildTerrain(world), buildSea(world), buildLandmarks(world));

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

/** One instanced box column per land cell, from the sea floor to its height. */
function buildTerrain(world: World): THREE.InstancedMesh {
  const { width, depth, heights } = world.terrain;
  const landCount = heights.filter((h) => h > 0).length;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0.5, 0.5, 0.5);
  const material = new THREE.MeshLambertNodeMaterial({ color: COLOURS.land });
  const mesh = new THREE.InstancedMesh(geometry, material, landCount);
  const matrix = new THREE.Matrix4();
  let n = 0;
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const h = heights[z * width + x]!;
      if (h <= 0) continue;
      // Columns start just below sea level so the shoreline reads as a cliff edge.
      matrix.makeScale(1, h + 0.5, 1).setPosition(x, -0.5, z);
      mesh.setMatrixAt(n, matrix);
      // A faint per-cell lightness change so single cells stay readable.
      mesh.setColorAt(n, new THREE.Color(COLOURS.land).offsetHSL(0, 0, ((x * 7 + z * 13) % 5) * 0.006));
      n++;
    }
  }
  return mesh;
}

function buildSea(world: World): THREE.Mesh {
  const { width, depth } = world.terrain;
  // Far wider than the grid so the sea fills the frame at any aspect ratio.
  const geometry = new THREE.PlaneGeometry(width * 6, depth * 6);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(width / 2, 0.15, depth / 2);
  return new THREE.Mesh(geometry, new THREE.MeshLambertNodeMaterial({ color: COLOURS.sea }));
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
