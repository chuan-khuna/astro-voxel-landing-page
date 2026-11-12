// Look prototype for soft voxels (ticket 01). Throwaway: not the real renderer.
// Open with ?webgl to force the WebGL 2 fallback.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, attribute, vec3, vec4, float,
  positionWorld, normalGeometry, cameraViewMatrix,
  abs, fract, floor, min, mix, smoothstep, fwidth, normalize, hash,
} from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';

// ---------------------------------------------------------------------------
// Tunable look. Every knob for the review lives here; the panel edits these
// live and "Copy settings" puts the current values on the clipboard.
// ---------------------------------------------------------------------------
const LOOK = {
  seamWidth: 0.035,     // seam half-width, as a fraction of one voxel
  seamDarkness: 0.22,   // 0 = no seam, 1 = black seam
  bevelWidth: 0.16,     // width of the rounded rim, as a fraction of one voxel
  bevelStrength: 0.55,  // how far the rim normal tilts toward the edge
  jitter: 0.035,        // per-voxel lightness variation (±)
  tintJitter: 0.015,    // per-voxel warm/cool variation (±)
  aoStrength: 0.55,     // 0 = no baked AO, 1 = fully dark corners
  roughness: 0.9,
  sunIntensity: 2.4,
  sunAzimuth: 35,       // degrees, around Y
  sunElevation: 52,     // degrees above horizon
  skyIntensity: 1.1,
  exposure: 1.0,
};

// Palette in OKLCH [L, C, h]. Chroma must stay <= 0.10 (checked below).
const PALETTE = {
  whitewash:      [0.955, 0.008, 90],
  roofWhite:      [0.925, 0.012, 85],
  plinth:         [0.82, 0.012, 80],
  blueTrim:       [0.54, 0.10, 248],
  blueDoor:       [0.46, 0.095, 252],
  glass:          [0.34, 0.035, 245],
  bougainvillea:  [0.60, 0.10, 352],
  bougainLight:   [0.69, 0.085, 348],
  leaf:           [0.56, 0.075, 138],
  olive:          [0.63, 0.055, 125],
  oliveDark:      [0.53, 0.055, 132],
  trunk:          [0.46, 0.035, 60],
  grass:          [0.71, 0.08, 128],
  grassDark:      [0.66, 0.08, 133],
  sand:           [0.87, 0.045, 85],
  dirt:           [0.62, 0.045, 62],
  rock:           [0.56, 0.025, 70],
  water:          [0.70, 0.07, 215],
  sky:            [0.93, 0.02, 230],
  sunLight:       [0.98, 0.025, 85],
  skyLight:       [0.93, 0.03, 235],
  groundLight:    [0.78, 0.04, 80],
};

const MAX_CHROMA = 0.10;
for (const [name, [, c]] of Object.entries(PALETTE)) {
  if (c > MAX_CHROMA) throw new Error(`Palette colour ${name} has chroma ${c} > ${MAX_CHROMA}`);
}

// OKLCH -> linear sRGB (clamped).
function oklchToLinear([L, C, hDeg]) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const COLORS = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, oklchToLinear(v)]));
const threeColor = (name) => new THREE.Color().setRGB(...COLORS[name], THREE.LinearSRGBColorSpace);

// Seeded PRNG so the scene is the same on every load.
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Voxel grids and a tiny mesher (face culling + baked vertex AO, no greedy
// merge: the shader works from world position, so merging would not change
// the look).
// ---------------------------------------------------------------------------
class VoxelGrid {
  constructor(size) { this.size = size; this.map = new Map(); }
  key(x, y, z) { return `${x},${y},${z}`; }
  set(x, y, z, color) { this.map.set(this.key(x, y, z), { x, y, z, color }); }
  del(x, y, z) { this.map.delete(this.key(x, y, z)); }
  has(x, y, z) { return this.map.has(this.key(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, color) {
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
      if (color === null) this.del(x, y, z); else this.set(x, y, z, color);
    }
  }
}

const FACES = [
  [0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1], // [axis, sign]
];
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

// extSolid(wx, wy, wz): occupancy from another grid, sampled at world points,
// so ¼-unit voxels resting on terrain get culled bottoms and contact AO.
function buildGeometry(grid, extSolid = () => false) {
  const s = grid.size;
  const solid = (x, y, z) => grid.has(x, y, z) || extSolid((x + 0.5) * s, (y + 0.5) * s, (z + 0.5) * s);
  const pos = [], nor = [], col = [], ao = [], idx = [];
  for (const v of grid.map.values()) {
    const p = [v.x, v.y, v.z];
    for (const [a, sign] of FACES) {
      const q = [...p]; q[a] += sign;
      if (solid(...q)) continue;
      const u = (a + 1) % 3, w = (a + 2) % 3;
      const n = [0, 0, 0]; n[a] = sign;
      const corners = sign > 0 ? CORNERS : [...CORNERS].reverse();
      const base = pos.length / 3;
      const aos = [];
      for (const [cu, cw] of corners) {
        const c = [...p]; c[a] += sign > 0 ? 1 : 0; c[u] += cu; c[w] += cw;
        pos.push(c[0] * s, c[1] * s, c[2] * s);
        nor.push(...n);
        col.push(...COLORS[v.color]);
        const s1 = [...q]; s1[u] += cu ? 1 : -1;
        const s2 = [...q]; s2[w] += cw ? 1 : -1;
        const cc = [...q]; cc[u] += cu ? 1 : -1; cc[w] += cw ? 1 : -1;
        const o1 = solid(...s1) ? 1 : 0, o2 = solid(...s2) ? 1 : 0, oc = solid(...cc) ? 1 : 0;
        const occ = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
        aos.push(occ / 3);
      }
      ao.push(...aos);
      // Flip the quad diagonal so AO interpolates without anisotropy.
      if (aos[0] + aos[2] < aos[1] + aos[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('ao', new THREE.Float32BufferAttribute(ao, 1));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// TSL voxel material: seams, bevel and colour jitter from world position.
// ---------------------------------------------------------------------------
const U = {
  seamWidth: uniform(LOOK.seamWidth),
  seamDarkness: uniform(LOOK.seamDarkness),
  bevelWidth: uniform(LOOK.bevelWidth),
  bevelStrength: uniform(LOOK.bevelStrength),
  jitter: uniform(LOOK.jitter),
  tintJitter: uniform(LOOK.tintJitter),
  aoStrength: uniform(LOOK.aoStrength),
};

function voxelMaterial(voxelSize) {
  const size = float(voxelSize);
  const n = normalGeometry; // meshes are unrotated, so this is the world normal
  const an = abs(n);
  const local = positionWorld.div(size);
  const f = fract(local);
  // Distance to the nearest voxel edge on each axis; the normal axis is masked out.
  const d = min(f, f.oneMinus()).max(an);
  const edge = min(d.x, min(d.y, d.z));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: LOOK.roughness, metalness: 0 });

  material.normalNode = Fn(() => {
    const lo = float(1).sub(smoothstep(float(0), U.bevelWidth, f));
    const hi = smoothstep(U.bevelWidth.oneMinus(), float(1), f);
    const tilt = hi.sub(lo).mul(an.oneMinus()).mul(U.bevelStrength);
    const bent = normalize(n.add(tilt));
    return normalize(cameraViewMatrix.mul(vec4(bent, 0)).xyz);
  })();

  material.colorNode = Fn(() => {
    // Owning voxel: step half a voxel inward from the face.
    const cell = floor(local.sub(n.mul(0.5))).add(128);
    const seed = cell.x.add(cell.y.mul(256)).add(cell.z.mul(65536));
    const j = hash(seed).mul(2).sub(1).mul(U.jitter);
    const t = hash(seed.add(7919)).mul(2).sub(1).mul(U.tintJitter);
    const tint = vec3(t, t.mul(0.3), t.negate());

    const seam = smoothstep(U.seamWidth, U.seamWidth.add(fwidth(edge)), edge);
    const seamFactor = mix(U.seamDarkness.oneMinus(), float(1), seam);
    const aoFactor = mix(float(1), attribute('ao', 'float'), U.aoStrength);

    const base = attribute('color', 'vec3');
    const c = base.mul(j.add(1)).add(tint.mul(base)).mul(seamFactor).mul(aoFactor);
    return vec4(c, 1);
  })();

  return material;
}

// ---------------------------------------------------------------------------
// Scene content: terrain patch (1 unit), House and tree (¼ unit).
// ---------------------------------------------------------------------------
const rng = mulberry32(20261111);

const terrain = new VoxelGrid(1);
const heights = new Map();
for (let x = -8; x < 8; x++) for (let z = -8; z < 8; z++) {
  const cx = x + 0.5, cz = z + 0.5;
  const r = Math.hypot(cx, cz);
  const ang = Math.atan2(cz, cx);
  const wobble = 0.6 * Math.sin(ang * 3 + 1) + 0.35 * Math.sin(ang * 5 + 2);
  if (r > 6.6 + wobble) continue;
  let h = r < 4.7 + wobble * 0.4 ? 2 : 1;
  if (Math.hypot(cx + 4, cz + 3.5) < 2.3) h = 3;
  heights.set(`${x},${z}`, h);
  for (let y = 0; y < h; y++) {
    let color = 'rock';
    if (y === h - 1) color = h === 1 ? 'sand' : rng() < 0.4 ? 'grassDark' : 'grass';
    else if (y === h - 2) color = 'dirt';
    terrain.set(x, y, z, color);
  }
}
const terrainSolid = (wx, wy, wz) => {
  const h = heights.get(`${Math.floor(wx)},${Math.floor(wz)}`) ?? 0;
  return wy >= 0 && wy < h;
};

const small = new VoxelGrid(0.25);

// House: whitewashed Cycladic block with blue trim and bougainvillea.
// Local ¼-unit coords; placed on the plateau (top at y = 2 units = 8 small).
function buildHouse(g, ox, oy, oz) {
  const B = (x0, y0, z0, x1, y1, z1, c) => g.box(ox + x0, oy + y0, oz + z0, ox + x1, oy + y1, oz + z1, c);
  const S = (x, y, z, c) => g.set(ox + x, oy + y, oz + z, c);
  const has = (x, y, z) => g.has(ox + x, oy + y, oz + z);

  B(0, 0, 0, 16, 1, 14, 'plinth');
  B(0, 1, 0, 16, 12, 14, 'whitewash');
  B(1, 11, 1, 15, 12, 13, 'roofWhite');
  // Parapet around the main roof.
  for (let x = 0; x < 16; x++) for (let z = 0; z < 14; z++) {
    if (x === 0 || x === 15 || z === 0 || z === 13) S(x, 12, z, 'whitewash');
  }
  // Upper block with a blue dome.
  B(1, 12, 1, 9, 18, 8, 'whitewash');
  B(2, 17, 2, 8, 18, 7, 'roofWhite');
  B(2, 18, 2, 8, 19, 7, 'whitewash');
  for (let x = 0; x < 10; x++) for (let y = 19; y < 23; y++) for (let z = 0; z < 9; z++) {
    if (Math.hypot(x + 0.5 - 5, (y + 0.5 - 19) * 1.05, z + 0.5 - 4.5) < 3.0) S(x, y, z, 'blueTrim');
  }
  // Chimney.
  B(12, 12, 9, 14, 15, 11, 'whitewash');
  B(11, 15, 8, 15, 16, 12, 'whitewash');

  // Door (front face, +z) with a step.
  B(6, 1, 13, 9, 7, 14, null);
  B(6, 1, 12, 9, 7, 13, 'blueDoor');
  B(5, 7, 14, 10, 8, 15, 'blueTrim'); // little blue lintel
  B(5, 0, 14, 10, 1, 16, 'whitewash');

  // Windows: recessed glass, blue shutters, white sill.
  const frontWindow = (x0, y0) => {
    B(x0, y0, 13, x0 + 3, y0 + 3, 14, null);
    B(x0, y0, 12, x0 + 3, y0 + 3, 13, 'glass');
    B(x0 - 1, y0, 13, x0, y0 + 3, 14, 'blueTrim');
    B(x0 + 3, y0, 13, x0 + 4, y0 + 3, 14, 'blueTrim');
    B(x0 - 1, y0 - 1, 14, x0 + 4, y0, 15, 'whitewash');
  };
  frontWindow(2, 4);
  frontWindow(11, 4);
  // Side window (+x face).
  B(15, 4, 5, 16, 7, 8, null);
  B(14, 4, 5, 15, 7, 8, 'glass');
  B(15, 4, 4, 16, 7, 5, 'blueTrim');
  B(15, 4, 8, 16, 7, 9, 'blueTrim');
  // Upper block window (front, z = 7).
  B(3, 14, 7, 5, 16, 8, null);
  B(3, 14, 6, 5, 16, 7, 'blueTrim');

  // Outside stair along +x, rising toward the back up to the roof.
  for (let i = 0; i < 11; i++) B(16, 0, 13 - i, 19, i + 1, 14 - i, 'whitewash');
  // Blue rail cap on the top steps.
  for (let i = 4; i < 11; i++) S(18, i + 1, 13 - i, 'blueTrim');

  // Bougainvillea: over the door and climbing the front-left corner.
  const bloom = (cx, cy, cz, rx, ry, rz) => {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let z = Math.floor(cz - rz); z <= cz + rz; z++) {
          const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (e > 1 || has(x, y, z) || rng() < 0.3) continue;
          const roll = rng();
          S(x, y, z, roll < 0.2 ? 'leaf' : roll < 0.6 ? 'bougainvillea' : 'bougainLight');
        }
  };
  bloom(-0.5, 9, 14.5, 3.2, 3.5, 1.6);
  bloom(-1, 4, 11, 1.4, 5, 3);
  bloom(10.5, 9.5, 14.5, 2.2, 1.6, 1.2);
}
buildHouse(small, -8, 8, -8);

// Olive tree.
function buildTree(g, ox, oy, oz) {
  for (let y = 0; y < 10; y++) {
    const bx = y > 4 ? 1 : 0, bz = y > 7 ? -1 : 0;
    g.box(ox + bx, oy + y, oz + bz, ox + bx + 2, oy + y + 1, oz + bz + 2, 'trunk');
  }
  const blobs = [[1.5, 11, 0.5, 3.8], [4, 12, -1, 2.9], [-1, 12, 2, 2.8], [1, 14, 0, 2.6]];
  for (const [cx, cy, cz, r] of blobs) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let z = Math.floor(cz - r); z <= cz + r; z++) {
          const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
          if (dist > r) continue;
          if (dist > r - 1 && rng() < 0.3) continue;
          g.set(ox + x, oy + y, oz + z, rng() < 0.45 ? 'oliveDark' : 'olive');
        }
  }
}
buildTree(small, -14, 8, 9);

// ---------------------------------------------------------------------------
// Renderer, camera, lights.
// ---------------------------------------------------------------------------
const hud = document.getElementById('hud');
const forceWebGL = new URLSearchParams(location.search).has('webgl');

const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = LOOK.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
scene.background = threeColor('sky');

const FRUSTUM = 16;
const aspect = () => innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(
  (-FRUSTUM * aspect()) / 2, (FRUSTUM * aspect()) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 200,
);
const target = new THREE.Vector3(0, 1.5, 0);
camera.position.set(30, 30, 30).add(target); // true isometric: azimuth 45°, elevation ~35.26°
camera.lookAt(target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enableDamping = true;
controls.screenSpacePanning = true;
controls.update();

const hemi = new THREE.HemisphereLight(threeColor('skyLight'), threeColor('groundLight'), LOOK.skyIntensity);
scene.add(hemi);

const sun = new THREE.DirectionalLight(threeColor('sunLight'), LOOK.sunIntensity);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 80 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 3;
scene.add(sun, sun.target);
function placeSun() {
  const az = THREE.MathUtils.degToRad(LOOK.sunAzimuth);
  const el = THREE.MathUtils.degToRad(LOOK.sunElevation);
  sun.position.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(30);
}
placeSun();

const materials = [voxelMaterial(1), voxelMaterial(0.25)];
const terrainMesh = new THREE.Mesh(buildGeometry(terrain), materials[0]);
const smallMesh = new THREE.Mesh(buildGeometry(small, terrainSolid), materials[1]);
for (const m of [terrainMesh, smallMesh]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardNodeMaterial({ color: threeColor('water'), roughness: 0.35, transparent: true, opacity: 0.88 }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.55;
water.receiveShadow = true;
scene.add(water);

// ---------------------------------------------------------------------------
// Panel.
// ---------------------------------------------------------------------------
const gui = new GUI({ title: 'Look' });
const shading = gui.addFolder('Voxel shading');
for (const [key, min, max] of [
  ['seamWidth', 0, 0.12], ['seamDarkness', 0, 0.8], ['bevelWidth', 0, 0.45], ['bevelStrength', 0, 1.5],
  ['jitter', 0, 0.15], ['tintJitter', 0, 0.06], ['aoStrength', 0, 1],
]) shading.add(LOOK, key, min, max, 0.005).onChange((v) => { U[key].value = v; });
shading.add(LOOK, 'roughness', 0.3, 1, 0.01).onChange((v) => materials.forEach((m) => { m.roughness = v; }));
const light = gui.addFolder('Light');
light.add(LOOK, 'sunIntensity', 0, 5, 0.05).onChange((v) => { sun.intensity = v; });
light.add(LOOK, 'sunAzimuth', 0, 360, 1).onChange(placeSun);
light.add(LOOK, 'sunElevation', 5, 89, 1).onChange(placeSun);
light.add(LOOK, 'skyIntensity', 0, 3, 0.05).onChange((v) => { hemi.intensity = v; });
light.add(LOOK, 'exposure', 0.5, 2, 0.01).onChange((v) => { renderer.toneMappingExposure = v; });
gui.add({
  copy() {
    const json = JSON.stringify(LOOK, null, 2);
    console.log(json);
    navigator.clipboard?.writeText(json).catch(() => {});
  },
}, 'copy').name('Copy settings');

const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
hud.innerHTML = `Backend: <b>${backend}</b> · ${
  forceWebGL ? '<a href="?">use WebGPU</a>' : '<a href="?webgl">force WebGL 2</a>'
} · voxels: ${terrain.map.size} × 1u, ${small.map.size} × ¼u`;
window.__look = { backend, ready: true };

addEventListener('resize', () => {
  camera.left = (-FRUSTUM * aspect()) / 2; camera.right = (FRUSTUM * aspect()) / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
