# Rendering and shading

How a World becomes pixels: World data → voxel grids → mesher → chunked
geometry → soft-voxel TSL material → an on-demand render. The look matches
the prototype the user approved in ticket 01 (`prototypes/look/`).

- Code: `site/src/render/`
- Decision: `docs/adr/0002-webgpu-renderer-with-tsl.md`
- Tests: `site/src/render/mesher.test.ts` (a few behavioural checks; the World
  generator stays the main test seam)

## Code layout

| File | What it does | three.js? |
|---|---|---|
| `palette.ts` | `LOOK` (the approved look settings), fixed colours (House, placeholder parts, sky, lights) as OKLCH, `oklchToLinear`. | no |
| `mesher.ts` | `VoxelGrid` (sparse voxel grid) and `meshVoxels` (culling, AO, greedy merge, chunking). | no |
| `worldVoxels.ts` | `worldToVoxels(world)`: the terrain grid and the ¼-unit detail grid with a shared colour list. `meshWorld(world)`: both grids meshed. | no |
| `landmarkModels.ts` | The ¼-unit Landmark models (placeholders for now). | no |
| `world.worker.ts` | The World Web Worker: `generateWorld` then `meshWorld`, posting the World and its chunk meshes back (mesh buffers transferred). | no |
| `worldSource.ts` | `createWorldSource()`: main-thread side of the worker, with a per-Seed cache. | no |
| `voxelMaterial.ts` | `voxelMaterial(voxelSize)`: the TSL node material. | yes |
| `worldMeshes.ts` | `buildWorldObjects(world, meshed?)`: chunk meshes plus the sea, as a `THREE.Group`. | yes |
| `mountWorld.ts` | The scene runtime: renderer, camera, lights, shadows, render on demand, swapping Worlds. | yes |

Everything above `voxelMaterial.ts` is plain TypeScript; generation and
meshing run in the Web Worker. Only geometry upload, materials and the sea
are built on the main thread.

## Voxel grids

Two grids, both in their own integer voxel coordinates (voxel `(x, y, z)`
spans world `[x·size, (x+1)·size)`):

| Grid | Voxel size | Contents |
|---|---|---|
| terrain | 1 unit | Every land column from y = 0 to its height. The top voxel takes the surface colour (sand, grass, peak) or the path colour; buried voxels take their stratum's colour. |
| detail | ¼ unit (`DETAIL = 4` per unit) | Bridge decks (one ¼ voxel thick, planks alternating in shade), stairs (three ¼-voxel steps on the lower cell), and the Landmark models. |

Colours: each grid voxel holds a colour id into one shared list
(`ColourTable`). Biome colours come from `world.biome`; the House, sky and
light colours are fixed (`FIXED_COLOURS`) and never change with the Biome.
Every chroma is at most 0.10.

### Landmark models

`landmarkModels.ts` draws one model per placed Landmark into the detail grid,
with its origin at the min corner of the Landmark's cell and local y = 0 the
first voxel above the ground. Models are simple placeholders (a mast for the
Station, a whitewashed block with a blue door and dome for the House, hedges
for the Garden, a plank platform for the Dock, a post and box for the
Mailbox). Later tickets replace a model by editing its entry in `MODELS`; the
`variant` field is passed through for when more variants exist.

## Mesher

`meshVoxels(grid, { colours, aoStrength, chunkSize, solidOutside })` returns
one `ChunkMesh` (positions, normals, colours, indices, quad count) per
non-empty chunk:

1. **Chunks.** Voxels are grouped into cubes of `chunkSize` voxels: 16 for
   terrain, 64 for detail (both 16 world units).
2. **Culling.** A face is emitted only when the cell in front of it is empty.
   `solidOutside` adds cells from outside the grid: the terrain treats
   y < 0 as solid (the sea floor, never seen), and the detail grid treats
   the terrain as solid, so ¼ voxels resting on the ground lose their bottom
   faces and get contact AO.
3. **AO.** Each face corner counts the solid cells beside it (two sides and
   the diagonal), giving 4 levels. The corner colour is
   `colour × mix(1, level/3, aoStrength)`, baked into the vertex colour. The
   quad's diagonal flips so AO interpolates without anisotropy.
4. **Greedy merge.** Per slice, faces with the same colour and the same four
   AO levels merge into larger rectangles (grow along u, then w). Merging
   never changes the baked AO, and the shader redraws the per-voxel detail.

## Soft-voxel material

`voxelMaterial(voxelSize)` is a `MeshStandardNodeMaterial` with TSL
`normalNode` and `colorNode`, all driven from `positionWorld / voxelSize`:

- **Seams:** distance to the nearest voxel edge in the face's plane; a dark
  line `seamWidth` wide, anti-aliased with `fwidth`.
- **Bevel:** near edges (within `bevelWidth`), the normal tilts toward the
  edge by `bevelStrength`, so each voxel catches light like a rounded block.
- **Colour jitter:** a hash of the owning voxel (half a voxel inward from the
  face) varies lightness by ±`jitter` and warm/cool tint by ±`tintJitter`.
- **AO:** comes in through the vertex colour.

Because all of this is from world position, a merged 8 × 8 quad still looks
like 64 voxels. Meshes must not be rotated or scaled (the geometry normal is
used as the world normal). Terrain uses `voxelMaterial(1)`, detail
`voxelMaterial(0.25)`.

### Approved settings

From ticket 01, in `LOOK` (`palette.ts`):

| Setting | Value | Setting | Value |
|---|---|---|---|
| seamWidth | 0.035 | sunIntensity | 2.4 |
| seamDarkness | 0.22 | sunAzimuth | 35° |
| bevelWidth | 0.16 | sunElevation | 52° |
| bevelStrength | 0.55 | skyIntensity | 1.1 |
| jitter | 0.035 | exposure | 1.0 |
| tintJitter | 0.015 | roughness | 0.9 |
| aoStrength | 0.55 | | |

Unlike the prototype, the shading values are constants compiled into the
shader rather than uniforms, and AO strength is applied when meshing.

## Sea

A wide deep-water plane at y = 0.15, plus shallow-water quads (runs merged
along x) on sea cells within 2 cells of land. Both are opaque
`MeshStandardNodeMaterial`s in the Biome's water colours and receive shadows.

## World Web Worker and cache

`createWorldSource().load(seed, counts)` returns `{ world, meshed, ms }`:

- It posts `{ id, seed, counts }` to `world.worker.ts`, which runs
  `generateWorld` and `meshWorld` and posts back the World and its
  `MeshedWorld` (chunk typed arrays). The mesh buffers are transferred, not
  copied. `ms` is the worker's generate-plus-mesh time (about 15–55 ms per
  Seed in headless Chrome, far inside the 1 s budget).
- Results are cached per Seed and content counts (the promise is cached, so
  two requests for one Seed share one build). The cache keeps the 16 most
  recently used Worlds; a cache hit reports `ms: 0`.
- If a `Worker` cannot be created, it generates and meshes on the main thread.
- The cached typed arrays outlive the GPU buffers: disposing a geometry frees
  only its GPU copy, so a cached World can be shown again.

## Scene runtime

`mountWorld(canvas, world, meshed?)` returns a `WorldView`
`{ show(world, meshed?), dispose() }`:

- **Renderer:** `WebGPURenderer` (`three/webgpu`), falling back to WebGL 2 by
  itself. Neutral tone mapping, PCF shadows.
- **DPR cap:** 1.5 on coarse-pointer (touch) devices, 2 elsewhere; re-read on
  resize.
- **Camera:** orthographic, on the true isometric axis (1, 1, 1), framed on
  the Overview view so every Isle fits at any aspect ratio.
- **Lights:** a hemisphere sky light and one directional sun at the approved
  azimuth and elevation. Its shadow camera covers the whole World
  (2048² map).
- **Static shadow map:** `shadow.autoUpdate = false`; `needsUpdate = true` is
  set once each time a World is shown, so the shadow map renders on that
  World's first frame only.
- **Swapping Worlds:** `show(world, meshed?)` removes the old World's group
  and disposes its geometries and materials, builds the new one, re-aims the
  sun and its shadow camera, re-frames the camera on the new Overview view,
  and requests one frame. The renderer, scene, lights and camera are kept.
- **Render on demand:** `requestRender()` schedules at most one frame. Today
  only mount, `show` and canvas resizes request frames; nothing renders while idle.
  Camera controls and animation (later tickets) should request frames while
  they move.
- The canvas gets `data-seed` (the Seed actually used, after the default
  fallback), `data-triangles` (voxel triangle count) and `data-backend`
  (`webgpu` or `webgl2`) for checks in a browser. The home page adds
  `data-generate-ms`.

## Budget

The spec allows 300k triangles for the World. Greedy merging keeps it far
below that today (counts for the voxel meshes; the sea adds a few hundred):

| Seed | Isles | Terrain | Detail | Total |
|---|---|---|---|---|
| default (`lanternfish`) | 2 | 1,330 | 610 | 1,940 |
| `2` | 3 | 1,962 | 806 | 2,768 |
| `3` | 3 | 3,442 | 1,118 | 4,560 |
| `13` | 4 | 2,168 | 1,302 | 3,470 |

Highest over Seeds `0`–`299`: 4,662. Meshing takes about 15–25 ms per World.
`mesher.test.ts` checks the budget on 40 sampled Seeds, including 4-Isle
ones. Trees, boats, ships and decoration (later tickets) will add most of the
remaining triangles.

## Not yet built

Day/Night lighting, camera controls, picking, animation (water, trees,
ships), the reduced-decoration tier, real Landmark models, and the Guide's
dissolve and re-form on a new Seed.
