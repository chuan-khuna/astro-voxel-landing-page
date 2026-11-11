# Rendering and shading

How a World becomes pixels: World data → voxel grids → mesher → chunked
geometry → soft-voxel TSL material → an on-demand render. The look matches
the prototype the user approved in ticket 01 (`prototypes/look/`).

- Code: `site/src/render/`
- Decision: `docs/adr/0002-webgpu-renderer-with-tsl.md`
- Tests: `site/src/render/mesher.test.ts`, `cameraMath.test.ts`,
  `landmarkModels.test.ts`, `houseModel.test.ts`, `houseMotion.test.ts` and
  `dataCardMath.test.ts` (a few behavioural checks; the World generator
  stays the main test seam)

## Code layout

| File | What it does | three.js? |
|---|---|---|
| `palette.ts` | `LOOK` (the approved look settings), fixed colours (House, its room and developer, placeholder parts, boat and ship hulls and sail, sky, lights) as OKLCH, `oklchToLinear`. | no |
| `mesher.ts` | `VoxelGrid` (sparse voxel grid) and `meshVoxels` (culling, AO, greedy merge, chunking). | no |
| `worldVoxels.ts` | `worldToVoxels(world)`: the terrain grid and the ¼-unit detail grid with a shared colour list. `meshWorld(world)`: both grids meshed. | no |
| `landmarkModels.ts` | The ¼-unit Landmark models (the Station's and the House's are real models; the rest are placeholders), each filling its footprint, and `landmarkExtent(landmark)`: the box a Landmark covers, measured from what its model draws and never smaller than its footprint. | no |
| `houseModel.ts` | The House in parts: `drawHouseBase` (stays), `drawHouseLid` (lifts), `drawHouseRoom` (desk, computer, chair, plant, the developer's seated body) in `HOUSE_INTERIOR`, the developer's moving parts (`DEVELOPER_PARTS`, `drawDeveloperPart`), the `SCREEN` rectangle and `developerExtent` (the developer's box, for their link). | no |
| `houseMotion.ts` | `roofLift(opening)` (the lid's height, eased), `openingStep` (the opening after a frame) and `developerPose(seconds)` (typing and reading). | no |
| `vesselModels.ts` | `drawBoat(boat, grid, colours)`: a Client's boat in its berth, drawn into the detail grid; `shipVoxels(colours)`: the Partner ship's own small grid, centred on `SHIP_ORIGIN`, bow towards +x. | no |
| `shipMotion.ts` | `sailingPath(cells)`: a ship's loop of cells smoothed into a closed path; `shipPose(path, distance)`: position and heading that far along it. | no |
| `cameraMath.ts` | Pure camera math: `screenToGround`, `panBy`, `zoomAt` (zoom toward a point), `clampState`, `stateShowing` (the state that shows a point at a screen offset), `screenOffsetOf` (where a point is seen; its inverse) and `flightState` (one moment of an eased flight). | no |
| `dataCardMath.ts` | Data Card maths: `nearestDataCard` (which card shows), `dataCardAnchors` (where a card stands or hangs), `dataCardTransform` and `placeDataCard` (the CSS `matrix3d`). | no |
| `landmarkFocus.ts` | `landmarkFocus(world, id)`: the point to look at and the zoom for each of the seven Landmarks. | no |
| `world.worker.ts` | The World Web Worker: `generateWorld` then `meshWorld`, posting the World and its chunk meshes back (mesh buffers transferred). | no |
| `worldSource.ts` | `createWorldSource()`: main-thread side of the worker, with a per-Seed cache. | no |
| `voxelMaterial.ts` | `voxelMaterial(voxelSize, space?)`: the TSL node material, in world space or (for ships) the mesh's own space. | yes |
| `house.ts` | `buildHouse(world)`: the lid and the developer's head and hands as meshes, and the screen's code shader; `setOpening` lifts the lid, `work(seconds)` animates the room. | yes |
| `ships.ts` | `buildFleet(world)`: one mesh per Partner ship, sharing one geometry, and `sail(seconds)` to move them along their loops. | yes |
| `worldMeshes.ts` | `buildWorldObjects(world, meshed?)`: chunk meshes plus the sea, the ships and the House's moving parts, as a `THREE.Group`. | yes |
| `mountWorld.ts` | The scene runtime: renderer, camera, lights, shadows, render on demand, sailing ships, opening the House, swapping Worlds. | yes |
| `cameraRig.ts` | `createCameraRig`: the camera state and the pointer, touch and wheel input that pans and zooms it. | yes |
| `dataCards.ts` | `createDataCards`: lays the page's Data Cards over their Landmarks and shows the one the camera is near. | yes |
| `landmarkHotspots.ts` | `createLandmarkHotspots`: positions the page's Landmark hotspot links over their models, the Garden's tree links over their trees and, while the House is open, the developer's link over the developer. | yes |

Everything above `voxelMaterial.ts` is plain TypeScript; generation and
meshing run in the Web Worker. Only geometry upload, materials, the sea,
the ship mesh and the House's lid and developer parts (small grids) are
built on the main thread.

## Voxel grids

Two grids, both in their own integer voxel coordinates (voxel `(x, y, z)`
spans world `[x·size, (x+1)·size)`):

| Grid | Voxel size | Contents |
|---|---|---|
| terrain | 1 unit | Every land column from y = 0 to its height. The top voxel takes the surface colour (sand, grass, peak) or the path colour; buried voxels take their stratum's colour. |
| detail | ¼ unit (`DETAIL = 4` per unit) | Bridge decks (one ¼ voxel thick, planks alternating in shade), stairs (three ¼-voxel steps on the lower cell), the Landmark models, each filling its footprint (the House's base and room, not its lid), and the Clients' moored boats. |

Colours: each grid voxel holds a colour id into one shared list
(`ColourTable`). Biome colours come from `world.biome`; the House, sky and
light colours are fixed (`FIXED_COLOURS`) and never change with the Biome.
Every chroma is at most 0.10.

### Landmark models

`landmarkModels.ts` draws one model per placed Landmark into the detail grid,
with its origin at the min corner of the Landmark's footprint (see
`world-generator.md`, "Landmark footprints") and local y = 0 the first voxel
above the ground. Each model gets its footprint's size in ¼ voxels
(`4 × width` by `4 × depth`), its ground height, and, in local ¼ voxels, the
Garden's tree cells and the Dock's jetty cells, and fills that footprint.
The Station, the House and the Mailbox have their real models (tickets 09, 11 and 12); the Garden and the Dock are simple placeholders:

| Landmark | Model |
|---|---|
| Station (2×2) | the data station: a concrete pad; a metal control hut with a blue door and windows on the two faces the camera sees, a flat roof and a dish on it; a thin lattice mast at the back corner topped by an accent light (17 ¼ voxels up); two server cabinets with accent status lights and a data tank in the front yard. Tall parts stand at the back, so nothing hides the door. |
| House (3×3) | its base and room (`houseModel.ts`; see "The House and its room"). Its lid is a mesh of its own, but `landmarkExtent` counts it, shut, so the hotspot covers the whole House. |
| Garden | one tree per tree cell, each filling its cell (trunk, 4×4 canopy); a flower in every other cell |
| Dock (2×1) | a plank platform on the land cells; a plank deck level with the ground over each jetty cell, on posts down to the sea floor |
| Mailbox (1×1) | a flagstone pad; a wooden post; a blue box on it, long front to back, with a darker lid, a darker door on its front (+z) and a white letter poking up at the door; a red flag (`flagRed`) raised on its +x side, the side the camera sees, to the top (8 ¼ voxels, 2 units, up); a flower at the pad's front corner |

`landmarkModels.test.ts` checks that every model reaches every footprint
(and jetty) cell and nothing outside it, that each tree's canopy fills
its cell, and that `treeExtent` (a tree's box, for its link) is its cell up
to the top of its canopy, 2 units tall, and that the Mailbox measures one cell by 2 units tall with its red flag on its +x side, up to its top. Later tickets replace a model by editing its entry in `MODELS`;
the `variant` field is passed through for when more variants exist.

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
`voxelMaterial(0.25)`. `voxelMaterial(0.25, 'local')` (the ships) works from
`positionLocal` and `normalLocal` instead and turns the bent normal into
view space with `transformNormalToView`, so a mesh may move and turn (not
scale) and keep its seams.

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

## Boats and ships

Simple code-built models (`vesselModels.ts`), one kind each for now: every
Client gets the same boat and every Partner the same ship. Kinds drawn as
ASCII structures come in a later feature (ADR 0004); a boat's kind will
follow its Client's id, never the Seed.

- **Boats** (Clients) are static, so `worldToVoxels` draws them into the
  detail grid with the Landmarks: they are greedy-meshed with the rest, cast
  shadows into the static shadow map, and cost nothing per frame. A boat is
  4 ¼ voxels long and 3 wide (one voxel in from its berth cell's edge), two
  ¼ voxels tall from the sea floor so it floats at the waterline: a muted
  red hull round an open plank deck, a white bow cap and a white seat. Its
  bow points the way its `facing` says, out along the jetty. About 53
  triangles each.
- **Ships** (Partners) are 8 long, 4 wide and 11 tall: a navy hull with a
  white gunwale and raised bow, a plank deck, a cabin with a window and
  roof at the stern, a mast with a square sail across the deck, and a
  Biome-accent pennant. So a ship is twice a boat's length and more than
  three times its height. `ships.ts` meshes it once (206 triangles), moves
  the geometry so it turns about the middle of its waterline (whole ¼
  voxels, so seams stay on voxel edges), and gives each Partner a mesh of
  its own. Ships use `voxelMaterial(size, 'local')`, so the seams, bevel and
  jitter sail with the ship instead of sliding over it. They receive
  shadows but cast none: the static shadow map would leave a moving ship's
  shadow behind.
- **Sailing.** `shipMotion.ts` smooths a ship's loop of cells into a closed
  path through the cell centres (three rounds of Chaikin corner cutting)
  and gives the ship's position and heading any distance along it; the
  heading looks 0.35 units ahead and behind, so turns ease in. A ship
  starts `phase × length` along its path and sails at 0.45 units a second.
  Its bow (+x) is turned to the heading: `rotation.y = −heading`.
  `shipMotion.test.ts` checks the path's length and bounds, the heading on
  each side, wrapping both ways and that the heading never jumps.
- `vesselModels.test.ts` checks that each boat stays in its berth cell from
  the sea floor up and is longer along its facing, and that a ship is at
  least twice a boat's length, wider and more than twice its height,
  centred on its origin.

## The House and its room

The House (ticket 11) is a code-built model in three parts, so its roof can
lift off and show a room inside, like a doll's house. All in the House's
local ¼ voxels (`houseModel.ts`, pure; 12×12 on its 3×3 footprint):

| Part | What | Drawn |
|---|---|---|
| base | the plinth, a wooden floor with a rug, and the two back walls (low x and low z), each with a window, one with a bougainvillea flower | into the detail grid (static) |
| lid | the roof slab, the blue dome, and the two front walls (high x and high z: the faces the isometric camera sees) with the door, the windows and bougainvillea on the corner | its own mesh, which lifts |
| room | in `HOUSE_INTERIOR` (x and z 2–10, y 1–9: 8×8×8 ¼ voxels, inside the walls and under the roof): a desk along the back-left wall, a computer on it facing into the room (+x), a mug, a chair, a plant, and the developer's seated body (trousers, shirt, arms on the desk) facing the computer, so the camera looks over their shoulder at the screen | into the detail grid (static) |
| developer | head (with hair) and two hands (`DEVELOPER_PARTS`) | one small mesh each, which move |
| screen | `SCREEN`: a rectangle on the computer's face | a plane with a TSL shader |

The base and lid never share a voxel and leave the interior space empty; the
lid covers every interior column from above; with the lid off the base has
no wall on the front sides, so the camera sees in; the room and developer
fit the interior space; the screen sits on the computer's face with nothing
in front of it. `houseModel.test.ts` checks all of these. House Variants and
one room per Biome (the polish feature, ADR 0004) keep the same split and
interior space.

- **Meshes** (`house.ts`). The lid and the developer's parts are meshed on
  the main thread at the House's place in the World (whole ¼ voxels) and use
  `voxelMaterial(0.25, 'local')`, so their seams line up with the base's
  and travel with them. The lid casts and receives shadows; the developer
  only receives them. The screen is a `MeshBasicNodeMaterial` plane a hair
  in front of the computer: a 14 × 7 pixel grid with a gap round each
  pixel, lines indented and as long as a hash of the line number says, in
  one of three muted colours (teal, pink, white), with gaps between words
  and the odd blank line. A `uniform` time scrolls it up 2.5 lines a
  second.
- **Lifting** (`houseMotion.ts`). The House's opening runs from 0 (shut)
  to 1 (open); `openingStep` moves it toward open or shut at a rate that
  takes the given time end to end (a cut at 0). `roofLift(opening)` lifts
  the lid by up to `ROOF_LIFT` = 6 units, eased in and out: high enough
  that, in the House Interior close-up, the lid is clear of the room on
  screen (it rises out of the top of the frame). The sun's shadow map is
  redrawn on every frame while the lid moves, then stays static.
- **The developer at work.** `developerPose(seconds)`: in a 5 s cycle the
  developer types for 3.6 s (each hand taps three times a second, in turn,
  never both up, at most a third of a ¼ voxel; the taps fade in and out)
  and then pauses to read the screen, the head bobbing a fifth of a ¼
  voxel. Smooth everywhere, and the rest pose at 0. `houseMotion.test.ts`
  checks the lift, the opening steps and the pose.
- **Triangles.** The room adds about 320 triangles to the detail mesh; the
  lid is 250 and the developer's parts 48, as their own meshes.

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

`mountWorld(canvas, world, meshed?, ui?)` returns a `WorldView`
`{ show(world, meshed?), camera, focus(id, { at?, ms }), focusState(id, at?), setViewCentre(at), setInterior(open, ms), dispose() }`. `ui` is
`{ frame, hotspots, cards? }`: the element round the canvas that takes pan and zoom
input, the Landmark hotspot links inside it, and the Data Cards (default: the canvas's
parent, no hotspots, no cards). `setViewCentre(at)` says where the visitor
looks (CSS px from the frame's centre: the middle of the part the floating
cards leave free, from `freeCentre`), which picks the Data Card shown and
is where the pan bounds apply (`CameraLimits.at`, below). `setInterior(open, ms)`
opens the House (its lid lifts over `ms`, the developer's link shows) or
shuts it (the lid comes down); 0 cuts. The House stays open or shut across
`show`: a new World's lid starts where the old one was. `camera` is the camera rig (below); `focus` flies the
camera to a Landmark (see "Landmark focus and flights").

- **Renderer:** `WebGPURenderer` (`three/webgpu`), falling back to WebGL 2 by
  itself. Neutral tone mapping, PCF shadows.
- **DPR cap:** 1.5 on coarse-pointer (touch) devices, 2 elsewhere; re-read on
  resize.
- **Camera:** orthographic, on the true isometric axis (1, 1, 1). Zoom 1
  frames the Overview view so every Isle fits at any aspect ratio; the
  camera rig moves and zooms it from there. It never rotates.
- **Lights:** a hemisphere sky light and one directional sun at the approved
  azimuth and elevation. Its shadow camera covers the whole World
  (2048² map).
- **Static shadow map:** `shadow.autoUpdate = false`; `needsUpdate = true` is
  set once each time a World is shown, so the shadow map renders on that
  World's first frame only.
- **Swapping Worlds:** `show(world, meshed?)` removes the old World's group
  and disposes its geometries and materials, builds the new one, re-aims the
  sun and its shadow camera, gives the camera rig the new World's bounds and
  cuts it to the Overview, moves the hotspots onto the new Landmarks, and
  requests one frame. The renderer, scene, lights and camera are kept.
- **Render on demand:** `requestRender()` schedules at most one frame. Mount,
  `show`, canvas resizes and camera moves request frames. While the World
  has ships, the page is visible and the visitor has not asked for reduced
  motion, every frame first moves the ships (`sail(seconds)`) and then asks
  for the next, so ships sail at the display's frame rate; seconds sailed
  advance at most 0.1 s a frame, so ships never leap after a pause. With no
  ships, under `prefers-reduced-motion: reduce` (ships keep still where they
  are) or on a hidden page, nothing renders while idle; a change to either
  setting requests a frame. The House keeps frames coming too: while its
  lid moves (the page cuts it under reduced motion), and while it is open,
  the page visible and motion allowed, when every frame advances the
  developer and the screen (`house.work`). Elapsed time is shared: at most
  0.1 s a frame for ships and the developer alike. Under reduced motion
  the open House renders once and goes idle, the developer in their pose of
  the moment. Each frame first updates the camera's matrices, re-places the hotspots
  and the Data Cards, then renders.
  three's `render()` also starts the renderer's internal animation loop,
  which would then tick `requestAnimationFrame` forever (it only advances
  node time, which nothing here uses); `mountWorld` stops it after each
  frame through the internal `renderer._animation`, guarded in case it
  disappears, so an idle page schedules no `requestAnimationFrame` at all.
  Other animation should request frames only while it moves, like the ships.
- The canvas gets `data-seed` (the Seed actually used, after the default
  fallback), `data-triangles` (voxel triangle count), `data-backend`
  (`webgpu` or `webgl2`), `data-frames` (frames rendered so far),
  `data-interior` (`open`, `shut` or `moving`: the House's lid) and
  `data-camera` (target x, target z, zoom) for checks in a browser. The page
  adds `data-generate-ms`.

## Camera and interaction

The camera state is a `CameraState`: a ground point the camera looks at
(`target`, x and z) and a `zoom` (1 is the Overview). The camera always sits
on the isometric axis above the target.

- **`cameraMath.ts`** (pure, tested in `cameraMath.test.ts` against a real
  three.js camera): `screenToGround(dx, dy)` turns a screen offset into a
  ground offset (screen right is (1, 0, −1)/√2 on the ground, screen up is
  (−1, 0, −1)·√(3/2)); `panBy` moves the target so the ground under the
  pointer follows a drag; `zoomAt` changes the zoom and keeps the ground
  point under the cursor or pinch centre in place; `clampState` keeps the
  ground seen at `limits.at` (where the visitor looks; default the screen
  centre) inside the bounds and the zoom inside its limits. Screen offsets
  are in frame units: world units at zoom 1, from the screen centre, y up.
- **`cameraRig.ts`**: `createCameraRig({ element, camera, onChange })` owns
  the state and listens on the frame element (so a drag that starts on a
  hotspot still pans):
  - Mouse: drag pans. A press must move 4 px before it becomes a drag, so a
    plain click on a hotspot still follows its link; the click that ends a
    drag is swallowed. Pointer capture starts only once dragging.
  - Wheel zooms toward the cursor (`exp(−deltaY · 0.0015)`); a trackpad
    pinch arrives as ctrl+wheel and zooms faster per unit (`0.01`). The
    wheel is always taken over the World, so it does not scroll the page
    there.
  - Touch: one finger pans; two fingers pan by their midpoint and zoom by
    the change in their spread, about the midpoint.
  - The frame has `touch-action: none`, so the browser never scrolls or
    zooms the page for a gesture that starts on the World, and
    `data-dragging` while dragging (grab and grabbing cursors).
  - `reset(limits, state, distance)` sets new bounds and cuts; `jumpTo(state)`
    cuts to a clamped state; `flyTo(state, ms)` flies there (below);
    `limits` are the current bounds and zoom range; `lookAt(at)` sets
    `limits.at` (kept across `reset`) without moving the camera.
- **Limits:** pan bounds are the union of the Isles' footprints (the same
  box the Overview is fitted to), so where the visitor looks is always over
  the World's land box. That is the free part's middle, not the screen's
  centre: with a bottom sheet open on a phone, a Landmark at the World's
  edge can still be brought into the free part above it. `mountWorld`
  keeps `limits.at` in step with `setViewCentre`, resizes and new Worlds. Zoom runs from 1 (the Overview, the farthest out) to
  `max(2, radius / 3)`, about 3 world units from the centre to the frame
  edge.
- **Landmark hotspots** (`landmarkHotspots.ts`): every page renders one
  link per placed Landmark (`a.hotspot[data-hotspot]`, route and label from
  the Landmark list) inside the frame, hidden until the World is shown. On
  every frame each link is sized to the screen rectangle of its Landmark's
  box (`landmarkExtent`: the model's voxels, and never less than the whole
  footprint and the Dock's jetty, so the hotspot covers the whole footprint;
  at least 28 px a side). The Garden's hotspot covers its trees. Hover and keyboard focus
  show an outline and the Landmark's label: the hover affordance and the
  keyboard focus. If a hotspot takes focus while off screen, the camera
  cuts to centre on it. The frame uses `overflow: clip`, so focusing a
  hotspot never scrolls the frame. This is not GPU picking.
- **The developer's link** (ticket 11): right after the House's hotspot, the
  page renders a link to Team (`a.hotspot.developer[data-developer]`,
  `data-hotspot="house-interior"`, labelled "Meet the Team"), sized to the
  developer's box (`developerExtent`). It is hidden while the House is shut
  and shown while it is open (`setInterior`), above the House's hotspot,
  which covers the room. On `/about/team` the page marks it with
  `aria-current="page"` (an outline).
- **Tree links** (ticket 08): right after the Garden's hotspot, the page
  renders one link per Garden tree (`a.hotspot.tree[data-project]`, also
  `data-hotspot="garden"`) to `/garden/<id>`, labelled with the Project's
  title, for the first 24 Projects by id. `setWorld` pairs them with the
  World's tree cells through `gardenTrees` (`src/lib/gardenTrees.ts`), so
  tree `k` is the `k`-th Project by id; a link with no tree is hidden. The
  screen rectangles round neighbouring trees' isometric boxes
  (`treeExtent`: the cell, 2 units tall) overlap, so a tree's link is only
  the middle of its tree: with `s` screen px per world unit, `0.7·s` wide
  and `0.8·s` tall round the box's centre. Neighbouring trees sit `0.71·s`
  apart across or `0.82·s` apart down the screen, so no link covers another
  tree's. A tree link under 12 px wide gets `data-small` and stops taking
  the pointer (clicks fall through to the Garden's hotspot); it still takes
  keyboard focus. At the Overview trees are small on most Seeds, so a click
  on the Garden opens `/garden`; with the camera at the Garden each tree is
  about 38 × 44 px on a 1280 px wide desktop and 13 × 15 px on a phone. The
  page marks the open Project's tree link with `aria-current="page"` (an
  outline).

### Data Cards

The page's Data Cards (see `site-project.md`, "Data Cards") are HTML laid
over the canvas by `dataCards.ts` on every frame, with the pure maths in
`dataCardMath.ts` (tested in `dataCardMath.test.ts` against a real three.js
camera):

- **Which card shows: `nearestDataCard(state, cards, half, centre)`.** A
  card's Landmark is near when the zoom is above 1 (never at the Overview)
  and at least 0.7 × the Landmark's own close-up zoom (`landmarkFocus`),
  and the Landmark is seen within 0.6 of the frame's half width and height
  of `centre`. Of the near Landmarks, the one seen closest to `centre` shows;
  at most one card shows, so neighbours' cards never pile up. `centre` is
  the view centre the page sets: the Landmark sits in the middle of the
  part the floating cards leave free, and that is what counts, not the
  frame's centre. The shown card gets `data-near` (opacity 1); the others fade out
  where they were. Cards are hidden until a World is shown and reset on a
  new World.
- **The tilt: `dataCardTransform(viewProjection, frame, anchor, card, pin)`.**
  A CSS `matrix3d` (column-major, like three's `Matrix4.elements`) built
  as frame-px-from-clip × projection × view × World-from-card-px. The card
  is upright in the World with its text along the World's −z axis, so on
  screen it rises 30° to the right and its sides stay vertical, skewed
  like the voxels round it. It keeps its own CSS size on screen at any zoom
  (one card px is one screen px along each edge), so the text stays real,
  crisp and readable; only the tilt and the position follow the camera.
  Depth is flattened, and z passes through so the matrix stays invertible
  (CSS does not draw an element under a non-invertible transform). The
  card has `transform-origin: 0 0` at the frame's top left. `pin` is
  `bottom` (the card stands on its anchor) or `top` (it hangs from it).
- **Where: `dataCardAnchors(landmark)`.** Both anchors are over the middle
  of the footprint. On the isometric screen a point's height goes with
  `2y − x − z`, so from the model's box (`landmarkExtent`) the `above`
  anchor is just over the box's highest screen point (its top back corner)
  and the `below` anchor just under its lowest (bottom front), each with a
  0.4-unit gap. `placeDataCard` stands the card on `above`, unless its top
  right corner (its highest) would leave the top of the frame; then it
  hangs from `below`. The Station is tall, so in its close-up its card
  usually hangs below it; on a phone it can touch the frame's bottom edge.

### Landmark focus and flights

- **`landmarkFocus(world, id)`** (pure, tested in `landmarkFocus.test.ts`)
  gives each Landmark a point and a zoom:
  - Overview: the Overview view's target at zoom 1, the World's first framing.
  - A placed Landmark: the middle of its footprint, on top of its ground
    (`y`), with its footprint plus 5 world units of ground round it in
    frame: zoom = Overview radius / (half the footprint's longer side + 5),
    never below 1.
  - House Interior: the World's House Interior view (the middle of the
    House), at Overview radius / view radius, so closer than the House.
    Both `/about` and `/about/team` fly here (`routeView` in
    `src/lib/landmarkRoutes.ts`), with the House open.
- **`stateShowing(point, zoom, at, limits)`** is the camera state that shows a
  World point at a screen offset (frame units from the centre). A raised
  point is seen where the view ray through it meets the ground, so the
  target is the point moved `y` back along the isometric axis, then shifted
  by the offset. Tested against a real three.js camera.
- **`view.focus(id, { at, ms })`** combines the two: `at` is where on the
  frame (CSS px from its centre) the Landmark should land. The page passes
  `freeCentre(frame, covers)` (`freeArea.ts`, tested in
  `freeArea.test.ts`): the middle of the part the floating cards (top bar,
  panel or bottom sheet, intro, dice row) leave free, so the Landmark is
  never under a card. See "Full-screen layout" in `site-project.md`.
- **Flights:** `rig.flyTo(state, ms)` tweens with `flightState(from, to, t)`:
  cubic ease in and out, the target in a straight line and the zoom on a
  log scale (zooming in and out feel equally fast); one `jumpTo` per
  animation frame, so frames render only during the flight. Any pointer
  press or wheel stops a flight where it is; `jumpTo`, `reset` and a new
  `flyTo` stop it too. With `ms` 0 it is a cut. The page flies for 900 ms,
  and cuts under `prefers-reduced-motion: reduce`.

## Budget

The spec allows 300k triangles for the World. Greedy merging keeps it far
below that today (counts for the voxel meshes; the sea adds a few hundred):

| Seed | Isles | Terrain | Detail | Total |
|---|---|---|---|---|
| default (`lanternfish`) | 2 | 1,330 | 1,448 | 2,778 |
| `2` | 3 | 1,956 | 1,798 | 3,754 |
| `3` | 3 | 3,422 | 1,576 | 4,998 |
| `13` | 4 | 2,100 | 2,112 | 4,212 |

Counts are with no Projects. Highest
over Seeds `0`–`299`: 5,610; with 24 trees in the Garden, 7,672 (the Station's model, ticket 09, adds 240). Meshing takes about 15–25 ms per World.
`mesher.test.ts` checks the budget on 40 sampled Seeds, including 4-Isle
ones. Boats (ticket 10) add about 53 triangles each, so 12 boats about 640
(highest over Seeds `0`–`299` with 24 trees and 12 boats: 8,320); each
ship adds 206, outside the voxel chunks (`data-triangles` counts them).
The House's room (ticket 11) adds about 320 to the detail mesh, and its
lid (250) and the developer (48) are meshes of their own (counted in
`data-triangles`). Real tree models and decoration (later tickets) will
add most of the remaining triangles.

## Not yet built

Day/Night lighting, animation of water and trees, boat and ship kinds, the reduced-decoration tier,
real models for the Garden and Dock, House Variants and one room per Biome, and the Guide's dissolve and re-form on a new Seed.
