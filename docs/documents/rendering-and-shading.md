# Rendering and shading

How a World becomes pixels: World data → voxel grids → mesher → chunked
geometry → soft-voxel TSL material → an on-demand render. The look matches
the prototype the user approved in ticket 01 (`prototypes/look/`).

- Code: `site/src/render/`
- Decision: `docs/adr/0002-webgpu-renderer-with-tsl.md`
- Theme tokens: `site/src/data/theme.ts` (see "Day and Night")
- Structures (the ASCII models, their format and the Model Gallery):
  `voxel-structures.md`
- Tests: `site/src/render/mesher.test.ts`, `cameraMath.test.ts`,
  `landmarkModels.test.ts`, `interiorModel.test.ts`, `houseMotion.test.ts`,
  `structureModels.test.ts`, `structureMeshes.test.ts`,
  `buoyModel.test.ts`, `dataCardMath.test.ts`, `frameMeter.test.ts` and
  `voxelCounts.test.ts` (a few behavioural checks; the World generator
  stays the main test seam)

## Code layout

| File | What it does | three.js? |
|---|---|---|
| `palette.ts` | `LOOK` (the approved look settings), fixed colours (House, its room and developer, fire, building materials for the Landmark Variants, placeholder parts, boat and ship hulls and sail, the buoys' lamp) as OKLCH, `oklchToLinear`. The sky and lights are theme tokens (`data/theme.ts`). | no |
| `voxelTiers.ts` | The voxel sizes of ADR 0006, as voxels per unit: `TERRAIN` 1, `GROUND_DETAIL` 4, `STRUCTURE` 8, `INTERIOR` 16. | no |
| `mesher.ts` | `VoxelGrid` (sparse voxel grid) and `meshVoxels` (culling, AO, greedy merge, chunking). | no |
| `worldVoxels.ts` | `worldToVoxels(world)`: the terrain grid, the ¼-unit detail grid and the ⅛-unit structure grid with a shared colour list. `drawDetail(world, grid, colours, drawn?)`: the detail grid's parts in order (bridges, stairs, each Landmark, buoys), telling `drawn` after each. `meshWorld(world)`: the three grids meshed. | no |
| `interiorModel.ts` | The House Interior's room, pure (see `voxel-structures.md`, "The House Interior rooms"): `furnishedRoom(biome)` (the room with the developer seated in it, 1/16 unit), `coarsen` (a structure at a coarser scale), `interiorPlacement` and `drawWorldRoom` (the room's place in the World, and the room at ⅛ unit in the structure grid), `developerBox`, `screenFace`, `roomLight`, `DEVELOPER_PARTS`, and `showsInterior` (when the Interior scene takes over). | no |
| `structureModels.ts` | Structures placed in a World (see `voxel-structures.md`): `structureColour` (a colour role's id), `drawStructure` (a structure, or one part, at a placement, turned to its door), `landmarkStructure` and `landmarkPlacement` (a placed Landmark's Variant, and where and which way it stands), `houseStructure` and `housePlacement` (the same for the House), `drawStructures` (the structure grid's contents) and `houseWindowFaces` (the lit window faces). | no |
| `voxelCounts.ts` | `countVoxels(world)`: voxels by kind (terrain, Landmarks, plants, House room, boats, ships, buoys, bridges, stairs), the total and those in the three meshed grids, for the render stats overlay. Redraws the detail grid with `drawDetail` and tallies each part as it lands (a shared voxel counts once); plants are each Garden plant's structure voxels (`gardenPlantsOf`; instanced, outside the grids), the House room the House Interior's room at ⅛ unit in the structure grid (`drawWorldRoom`); the House Interior scene is not counted; the House's structure (base and lid, ⅛ unit) counts with the Landmarks; boats and ships are each one's structure voxels (instanced, outside the grids). About 2 ms. | no |
| `frameMeter.ts` | `createFrameMeter()`: FPS and frame time from frame timestamps, smoothed (exponential, 0.1); a gap over 250 ms ends a burst and the next starts afresh; `'idle'` with no frame for 500 ms or only a lone frame. | no |
| `landmarkModels.ts` | The ¼-unit parts of the Landmarks (the Dock's deck and jetty), and `landmarkExtent(world, landmark)`: the box a Landmark covers, measured from its ¼-unit parts, its Variant's structure and, for the Garden, its plants, and never smaller than its footprint (for the House, the House's 3×3 up to its roof). | no |
| `gardenPlants.ts` | The Garden's plants (polish ticket 05): `plantStructure` (the Biome's tree; its flowers in turn), `gardenPlantsOf(world)` (every flower and tree with its cell and structure), `plantExtent` (a plant's box, for its link) and `plantedGarden(biome)` (a fence planted full, for the Model Gallery). | no |
| `garden.ts` | `buildGardenPlants(world)`: one `InstancedMesh` per plant structure, one instance per plant, on the Garden's ground. | yes |
| `plantLinks.ts` | `plantLinkSize(kind, pxPerUnit)`: a plant link's size on screen, so no link covers another plant (see "Plant links"). | no |
| `buoyModel.ts` | `drawBuoy(cell, grid, colours)`: a buoy in the detail grid; `buoyLamp(cell)`: its lamp's box, which glows at Night. | no |
| `houseMotion.ts` | `ROOF_LIFT`, `roofLift(opening)` (the lid's height, eased), `openingStep` (the opening after a frame) and `developerPose(seconds)` (typing and reading). | no |
| `vesselModels.ts` | The boats and ships (polish ticket 06): `vesselStructure` (a kind's structure in a Biome), `boatsOf(world)`, `boatPlacement` and `shipPlacement` (see "Boats and ships"). | no |
| `boats.ts` | `buildBoats(world)`: one `InstancedMesh` per boat structure, one instance per moored boat. | yes |
| `shipMotion.ts` | `sailingPath(cells)`: a ship's loop of cells smoothed into a closed path; `shipPose(path, distance)`: position and heading that far along it. | no |
| `guideModel.ts` | The Guide's model: `guideVoxels(colours)` (a 6×6×6 ¼-unit cube centred on its origin, side fins, an antenna, the bezel on +x), `GUIDE_SCREEN` (the screen's rectangle) and `GUIDE_FACES` (a 12 × 10 pixel-eye face per mood, and a blink). | no |
| `guideMotion.ts` | `guideSpot(world, id)` (where the Guide floats beside a placed Landmark), `voxelFlights` and `flightPoint` (the assembly), `travelPoint` (flying between spots on the Tour), `hoverPose(seconds)` (the bob) and `blinking(seconds)`. | no |
| `speechBubble.ts` | `placeBubble(guide, bubble, frame, covers, landmarks?)`: where the speech bubble goes on screen, or nowhere. | no |
| `cameraMath.ts` | Pure camera math: `screenToGround`, `panBy`, `zoomAt` (zoom toward a point), `clampState`, `stateShowing` (the state that shows a point at a screen offset), `screenOffsetOf` (where a point is seen; its inverse) and `flightState` (one moment of an eased flight). | no |
| `dataCardMath.ts` | Data Card maths: `nearestDataCard` (which card shows), `dataCardAnchors` (where a card stands or hangs), `dataCardTransform` and `placeDataCard` (the CSS `matrix3d`). | no |
| `landmarkFocus.ts` | `landmarkFocus(world, id)`: the point to look at and the zoom for each of the seven Landmarks. | no |
| `world.worker.ts` | The World Web Worker: `generateWorld` then `meshWorld`, posting the World and its chunk meshes back (mesh buffers transferred). | no |
| `worldSource.ts` | `createWorldSource()`: main-thread side of the worker, with a per-Seed cache. | no |
| `seaModel.ts` | The sea, pure (see "Sea"): `seaModel(world)` (the water voxels' tops and skirts, the flat water beyond them and the seabed, as typed arrays), `coastDistance` and `seaShade`, and `SEA_LEVEL`. | no |
| `voxelMaterial.ts` | `voxelMaterial(voxelSize, space?)`: the TSL node material, in world space or (for ships) the mesh's own space; `softVoxelLook` is the look on its own (seams, bevel, jitter) for other materials. | yes |
| `seaMaterial.ts` | `seaMaterial()`: the sea's TSL material (the soft-voxel look at 1 unit, shallow to deep colour, opacity, the bob in the vertex shader) and its `time` and colour uniforms. | yes |
| `structureMeshes.ts` | Repeated structures: `structureGeometry` (a structure meshed once, anchor at the origin), `structureInstances` (one `InstancedMesh` per structure, one instance per copy), `instanceMatrix` (a copy's transform: whole quarter turns about a pivot, pure maths) and `mergeChunks`. | yes |
| `house.ts` | `buildHouse(world)`: the House Variant's lid (⅛ unit) as a mesh and the windows' lights; `setOpening` lifts the lid, `setLights` lights the windows. | yes |
| `interior.ts` | `buildInterior(world)`: the House Interior scene: the House's shell and ground, the room at 1/16 unit, the developer's head and hands as meshes, the screen's code shader, its own lights; `work(seconds)` animates the developer and the screen, `setTheme` lights it for Day or Night. | yes |
| `ships.ts` | `buildFleet(world)`: one `InstancedMesh` per ship structure, one instance per Partner of that kind, and `sail(seconds)` to move them along their loops. | yes |
| `worldMeshes.ts` | `buildWorldObjects(world, meshed?)`: chunk meshes plus the sea (water and seabed), the ships, the House's moving parts and the buoys' lamps, as a `THREE.Group`; `swell(seconds)` bobs the sea; `setTheme` recolours the sea and lights the lamps and windows. | yes |
| `guide.ts` | `createGuide`: the Guide's body, screen face and flying voxels, re-formed with each World (`formAt`), its idling (`step`), and its button and speech bubble over the canvas (`place`, `say`, `hush`). | yes |
| `mountWorld.ts` | The scene runtime: renderer, camera, lights, shadows, render on demand and the render tier, the sea's bob, sailing ships, opening the House and handing over to the House Interior scene, the Guide, Day and Night, swapping Worlds, `onFrame` for the stats overlay. | yes |
| `statsOverlay.ts` | `createStatsOverlay({ dice, frame })`: the render stats toggle and card (see `site-project.md`, "Render stats"), loaded only in dev or with `?stats`; its styles are `statsOverlay.css`, imported inline. | DOM only |
| `cameraRig.ts` | `createCameraRig`: the camera state and the pointer, touch and wheel input that pans and zooms it (`onInput` hears that input). | yes |
| `dataCards.ts` | `createDataCards`: lays the page's Data Cards over their Landmarks and shows the one the camera is near. | yes |
| `landmarkHotspots.ts` | `createLandmarkHotspots`: positions the page's Landmark hotspot links over their models, the Garden's plant links over their flowers and trees and, while the House is open, the developer's link over the developer. | yes |

Everything above `voxelMaterial.ts` is plain TypeScript; generation and
meshing run in the Web Worker. Only geometry upload, materials, the sea,
the instanced boats, ships and plants, the House's lid, the House Interior scene and the Guide
(small grids) are built on the main thread.

## Voxel grids

Three grids, one per voxel tier the World uses (ADR 0006, `voxelTiers.ts`),
each in its own integer voxel coordinates (voxel `(x, y, z)` spans world
`[x·size, (x+1)·size)`):

| Grid | Voxel size | Contents |
|---|---|---|
| terrain | 1 unit (`TERRAIN`) | Every land column from y = 0 to its height. The top voxel takes the surface colour (sand, grass, peak) or the path colour (the path's cells, and the House yard's cell in front of its door); buried voxels take their stratum's colour. |
| detail | ¼ unit (`GROUND_DETAIL = 4` per unit) | Bridge decks (one ¼ voxel thick, planks alternating in shade), stairs (three ¼-voxel steps on the lower cell), the Dock's deck and jetty (`landmarkModels.ts`) and the buoys. |
| structure | ⅛ unit (`STRUCTURE = 8` per unit) | Placed structures (`structureModels.ts`, `voxel-structures.md`): each Landmark's Variant: the House's base (its lid is a mesh of its own), the Station, the Mailbox, the things on the Dock's deck and the Garden's fence; and the House Interior's room coarsened to ⅛ unit (`drawWorldRoom`), seen while the lid lifts. The Garden's flowers and trees are ⅛-unit structures too, but instanced (`garden.ts`), not in this grid, and so are the boats and ships (`boats.ts`, `ships.ts`). |

The House Interior's tier (`INTERIOR`, 1/16 unit) belongs to its own scene
(`interior.ts`; see "The House and its room").

Colours: each grid voxel holds a colour id into one shared list
(`ColourTable`). Biome colours come from `world.biome`; the House and other
fixed colours (`FIXED_COLOURS`) never change with the Biome. The sky, the
lights and the water's shade follow the theme instead (see "Day and Night").
Every chroma is at most 0.10.

### Landmark models

`landmarkModels.ts` draws one model per placed Landmark into the detail grid,
with its origin at the min corner of the Landmark's footprint (see
`world-generator.md`, "Landmark footprints") and local y = 0 the first voxel
above the ground. Each model gets its footprint's size in ¼ voxels
(`4 × width` by `4 × depth`), its ground height, and, in local ¼ voxels, the
Dock's jetty cells, and fills that footprint.
Since polish ticket 03 most of what a Landmark shows is its Variant's ⅛-unit
structure (`structureModels.ts`, `voxel-structures.md`); only these stay at ¼ unit:

| Landmark | ¼-unit model |
|---|---|
| Station (2×2) | none: the Station is its Variant's structure |
| House (4×4 plot) | none: the House is a structure and its room the House Interior's (see "The House and its room") |
| Garden (5×5) | none: its fence is its Variant's structure and its flowers and trees are instanced structures (see "The Garden") |
| Dock (2×1) | a plank platform on the land cells (ground detail, ADR 0006), which the Variant's things stand on; a plank deck level with the ground over each jetty cell, on posts down to the sea floor |
| Mailbox (in the House's yard) | none: the Mailbox is its Variant's structure |

`landmarkExtent(world, landmark)` is the box of both: the ¼-unit model and
the Variant's structure as placed (the House whole, lid on, over its own
3×3, not its yard, where the Mailbox has a box of its own).
`landmarkModels.test.ts` checks that every Landmark but the Dock draws
nothing at ¼ unit, that the Dock reaches every footprint (and jetty) cell
and nothing outside it, that the Garden's box is its 5×5, about 1 unit
tall with no plants and as tall as its trees with them, and that each
Landmark's box stays within `LANDMARK_HEIGHT` (the Station 5–6 units, the
Mailbox 1–1.25 in its cell, the Dock's things at most 1).

### The Garden

The Garden (polish ticket 05) is its fence, its Landmark Variant drawn
into the structure grid like the other Landmarks (its gate facing the
Garden's `door`, south or east; the east mirror swaps x and z, and the
fence is the same on every side but the gate), and a plant per planted
Project in its 3×3 bed: a flower per Pinned Project in the front two rows,
a tree in the back row (`world-generator.md`, "The Garden"). Each plant is
the Biome's tree or one of its flowers (taken in turn, so neighbours
differ), a ⅛-unit structure 1×1 with its crown or bloom at most 6×6 in
the cell's 8×8, so neighbouring plants keep 2 voxels apart and read
separately. `garden.ts` draws every copy of one structure with one
`InstancedMesh` (`structureInstances`), its footprint's middle on the
cell's middle, on the Garden's ground. The bed holds nothing else: an
empty Garden is a grass patch in a fence. `gardenPlants.test.ts` checks
the plants' order, kinds and Biome, the flowers alternating, and
`plantExtent` (a plant's cell up to its top, within `LANDMARK_HEIGHT`).

## Mesher

`meshVoxels(grid, { colours, aoStrength, chunkSize, solidOutside })` returns
one `ChunkMesh` (positions, normals, colours, indices, quad count) per
non-empty chunk:

1. **Chunks.** Voxels are grouped into cubes of `chunkSize` voxels: 16 for
   terrain, 64 for detail, 128 for structures (all 16 world units).
2. **Culling.** A face is emitted only when the cell in front of it is empty.
   `solidOutside` adds cells from outside the grid: the terrain treats
   y < 0 as solid (the sea floor, never seen), the detail grid treats
   the terrain as solid, so ¼ voxels resting on the ground lose their bottom
   faces and get contact AO, and the structure grid treats the terrain and
   the detail grid as solid.
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
`voxelMaterial(0.25)`, structures `voxelMaterial(0.125)`: seams and bevels
are fractions of a voxel, so the same look scales to every tier. `voxelMaterial(0.25, 'local')` (the ships) works from
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

Polish ticket 06. Each Client's boat and each Partner's ship is a ⅛-unit
structure (`voxel-structures.md`, "Boats and ships"): the structure of its
kind in the World's Biome, the kind coming from its owner's id
(`world-generator.md`, "Boat and ship kinds"), never the Seed. Every copy
of one structure is one `InstancedMesh` (`structureInstances`), in the
soft-voxel material in local space, so seams, bevel and jitter move and
turn with the vessel.

- `vesselModels.ts` (pure): `vesselStructure('boat' | 'ship', biome,
  kind)`, `boatsOf(world)` (each boat with its structure), and the
  placements: `boatPlacement(boat)` puts a boat's footprint middle on its
  berth cell's middle, on the sea floor, its bow (drawn towards +z) turned
  by whole quarter turns to its `facing`; `shipPlacement(pose)` puts a
  ship's footprint middle on its path, its bow along its heading (heading
  h is 1 − 2h/π quarter turns; `instanceMatrix` takes a fraction as an
  exact angle).
- **Boats** (`boats.ts`) are still: one `InstancedMesh` per boat structure,
  one instance per moored boat. They cast shadows into the static shadow
  map. A boat's first layer is under the sea (sea level 0.15), so it floats
  at the waterline.
- **Ships** (`ships.ts`): one `InstancedMesh` per ship structure, one
  instance per Partner of that kind; `sail(seconds)` resets each
  instance's placement every frame. They receive shadows but cast none:
  the static shadow map would leave a moving ship's shadow behind.
- **Sailing.** `shipMotion.ts` smooths a ship's loop of cells into a closed
  path through the cell centres (three rounds of Chaikin corner cutting)
  and gives the ship's position and heading any distance along it; the
  heading looks 0.35 units ahead and behind, so turns ease in. A ship
  starts `phase × length` along its path and sails at 0.45 units a second,
  turning about its footprint's middle (on the sea floor, under the bow-to-stern
  middle of its waterline).
  `shipMotion.test.ts` checks the path's length and bounds, the heading on
  each side, wrapping both ways and that the heading never jumps.
- `vesselModels.test.ts` checks that each kind maps to its Biome's
  structure, that a boat stays in its berth cell with its bow along its
  facing, that a World's boats take their Clients' kinds, and that a ship
  sails bow first along its heading with its middle on the path.

## Buoys

`buoyModel.ts` draws each of the World's buoys (`world.buoys`, placed by
the generator; see `world-generator.md`) into the detail grid, in the
middle of its cell: a 2×2 float, red (`flagRed`) under a white band, then
a dark post and a lamp (`lamp`) on top, a unit tall from the sea floor, so
it floats at the waterline like the boats. About 40 triangles each. At
Night `worldMeshes.ts` shows a glowing box over each lamp (`buoyLamp`, a
hair bigger than the voxel so it covers the seams), in the `buoyLight`
token. `buoyModel.test.ts` checks each buoy stays in its cell from the sea
floor up, a unit tall, with one lamp voxel on top that `buoyLamp` covers
exactly.

## The House and its room

The House is a structure (polish ticket 01): three Variants per Biome (polish
ticket 03), the Seed's pick, each drawn as an ASCII file at ⅛ unit, 24×24 on
the House's 3×3 at its plot's origin (see `voxel-structures.md` for the
Variants). It stands with its door
south or east, the way the World says (`world-generator.md`, "House
plot"), mirrored by swapping x and z (so the front walls stay on the camera side; a chimney or side window swaps sides). Its voxels come in two parts, so the
roof can lift off and show a room inside, like a doll's house. The room is
the House Interior (polish ticket 04): one room per Biome at 1/16 unit
(`voxel-structures.md`, "The House Interior rooms"), shown at ⅛ unit in the
World and at full detail in a scene of its own:

| Part | What | Drawn |
|---|---|---|
| base | the structure's `base` voxels: the plinth (or stilts and a deck), the floor with a rug, and the two back walls (low x and low z), each with a window | into the World's structure grid (static) |
| lid | the structure's `lid` voxels: the roof with its eaves and chimney (or the Biome's equivalent), and the two front walls (high x and high z: the faces the isometric camera sees) with the door, the windows, shutters and sills | its own mesh, which lifts |
| room in the World | the Biome's furnished room (`furnishedRoom`, the developer seated in it) coarsened to ⅛ unit (`coarsen`: a 2×2×2 block becomes a voxel if at least 2 of its 8 are filled, in its most common role), in the interior box | into the World's structure grid (static; nothing moves) |
| House Interior | the House's base again, a slab of the Biome's grass under the plot and a cell round it, the furnished room at 1/16 unit, the developer's head and hands, and the screen | a scene of its own (`interior.ts`) |

Every House Variant leaves its interior box empty, covers every interior
column from above with the lid, and keeps the base off the front sides
above the floor, so with the lid off the camera sees in
(`structures.test.ts`); each Biome's room fits the interior space of every
House Variant in that Biome, seats the developer at its anchor and puts the
screen in front of them (`structures.test.ts`, `interiorModel.test.ts`). In
the World, the base and the coarse room land in the House's 3×3 and the
door on the face the House's `door` names (`structureModels.test.ts`).

- **Meshes** (`house.ts`). The lid (⅛ unit) is meshed on the main thread
  at the House's place in the World (whole voxels) and uses
  `voxelMaterial(size, 'local')`, so its seams line up with the base's and
  travel with it. It casts and receives shadows.
- **Lights.** `houseWindowFaces(world)` finds every face of window glass
  (role `window`) that faces +x or +z with nothing of the House in front
  of it: on the front walls these face out, towards the camera; on the
  back walls they face into the room. A `MeshBasicNodeMaterial` square a
  hair in front of each, in the `windowLight` token, shows only at Night
  (`setLights`); one mesh for the lid's faces, a child of the lid so it
  lifts with it, and one for the base's. From outside the shut House shows
  lit windows, and inside the open House the back windows glow.
- **Lifting** (`houseMotion.ts`). The House's opening runs from 0 (shut)
  to 1 (open); `openingStep` moves it toward open or shut at a rate that
  takes the given time end to end (a cut at 0). `roofLift(opening)` lifts
  the lid by up to `ROOF_LIFT` = 6 units, eased in and out: high enough
  that, in the House Interior close-up, the lid is clear of the room on
  screen (it rises out of the top of the frame). The sun's shadow map is
  redrawn on every frame while the lid moves, then stays static.
- **Triangles.** The House's base adds about 900–1,100 triangles to the
  structure mesh and the coarse room about 1,000–1,200 (it replaced the ¼
  unit room's 320); the lid is about 2,000–2,400 as its own mesh. The
  House Interior scene is about 3,500 (`data-interior-triangles`: the
  room 2,100–2,800 at 1/16 unit, the shell and the ground).

### The House Interior

The House Interior is a scene of its own (ADR 0006), built with each World
(`buildInterior`, `interior.ts`), so its 1/16-unit voxels never add to the
World's. It stands where the House stands and is drawn through the World's
own camera, so the World hands over to it with nothing moving: the House's
shell and ground stay put, the coarse room becomes the fine one, and the
rest of the World gives way to the sky.

- **Entering** (`setInterior(true, ms)`, About and Team): the lid lifts in
  the World over `ms` while the camera flies to the House Interior close-up;
  once the lid is fully up, the camera at rest (not on a flight), close
  enough (at least half the House Interior's zoom: the Tour stops at about
  0.56 of it, to keep the Guide beside the House in view) and the room's
  middle on screen (`showsInterior`), the next frame renders the Interior
  scene instead of the World. Under reduced motion the lid and camera cut,
  so the Interior shows on the first frame.
- **Leaving:** shutting the House (`setInterior(false, ms)`: any other
  route, the Tour moving on), zooming out past half the close-up, or panning
  the room off screen hands back to the World on the next frame, and then
  the lid comes down while the camera flies on: the entry reversed.
- **In the scene:** the House's base (⅛ unit, `local` material); a 1-unit
  slab of the Biome's grass under the House's plot and a cell round it; the
  furnished room at 1/16 unit, its still voxels as one mesh and the
  developer's head and hands (`DEVELOPER_PARTS`) as one mesh each; the
  screen, a `MeshBasicNodeMaterial` plane a hair in front of the `screen`
  voxels' +x face (`screenFace`): a 14 × 7 pixel grid with a gap round each
  pixel, lines indented and as long as a hash of the line number says, in
  one of three muted colours (teal, pink, white), with gaps between words
  and the odd blank line, scrolled up 2.5 lines a second by a `uniform`
  time.
- **Light:** its own hemisphere light and sun, in the theme's colours and
  from the World's sun direction, with a 1024² shadow map round the House,
  drawn once (the developer's moving head and hands cast no shadow, so
  nothing in it moves). At Night a warm point light (intensity 6, reach 5 units)
  shines from the middle of the room's lamps and fires (`roomLight`), and
  the back walls' windows glow (the base's `houseWindowFaces`). The
  background is the theme's sky.
- **The developer at work.** While the Interior shows, the page is visible
  and motion is allowed, every frame advances the developer and the screen
  (`work(seconds)`). `developerPose(seconds)`: in a 5 s cycle the developer
  types for 3.6 s (each hand taps three times a second, in turn, never both
  up, at most one 1/16-unit voxel; the taps fade in and out) and then
  pauses to read the screen, the head nodding two thirds of a voxel. Smooth
  everywhere, and the rest pose at 0. `houseMotion.test.ts` checks the
  lift, the opening steps and the pose.
- **The Guide** moves into whichever scene shows (an object has one
  parent), so it stays in view beside the House on the Tour.
- **Links:** the frame gets `data-scene="interior"` (and the canvas
  `data-scene`), and CSS hides every hotspot but the developer's, since the
  other Landmarks are out of sight. The developer's link covers
  `developerBox` in world units.

## The Guide

The Guide (`GLOSSARY.md`; its lines and page markup are in `site-project.md`,
"The Guide") is an original design: a pale 6×6×6 cube of ¼-unit voxels
(1.5 units a side) with a darker top and bottom rim, a blue fin on each
side, a thin antenna with a blue lamp set back from the face, and a dark
bezel round a square screen (`guideModel.ts`). Only its tone is inspired by
Portal 2; nothing is drawn from it. It is one mesh (227 voxels, 128
triangles) with the soft-voxel material in local space, so its seams bob
and turn with it, and the screen plane (2 triangles). It casts no shadow
(the shadow map is static) and is built once for the visit: a new World
only moves it.

**Screen face.** The screen is a plane a hair in front of the bezel showing
a 12×12 texture (`DataTexture`, nearest filtering): one of the
`GUIDE_FACES`, 12 × 10 pixel-eye faces centred on it. A TSL colour node
draws each lit pixel in a pale cyan (OKLCH 0.88 0.09 205) with a gap round
it, on the dark screen colour, so it reads as a pixel screen; it is unlit,
so it glows at Night as by Day. Moods: `neutral` (two upright eyes),
`happy` (two arcs), `smug` (one eye lidded, one under a raised brow),
`surprised` (two round eyes), `sleepy` (both half shut) and `wink`; plus
`blink`. A line's mood shows while it is said; otherwise `neutral`. The
texture is rewritten only when the face changes.

**Where it floats.** `guideSpot(world, 'station')`, beside the Station. In
isometric screen space (`x = (x − z)/√2`, `y = (2y − x − z)/√6`) it takes
the clear spot nearest the one just right of the Landmark's box
(`landmarkExtent`) and level with its middle, searching a 0.25-unit grid
up to 2.2 units past it; the left side costs 0.5 more. A spot is clear when
the Guide's reach (`GUIDE_REACH`, 1.3 units round its middle, bob
included) overlaps no placed Landmark's box on screen, so it never stands
in front of or behind one. The point is then pushed along the line of sight
towards the camera, which keeps it on the same screen spot, until its
bottom is clear of the ground in the 3×3 cells under it. The Station's
spot was clear in all of 300 Seeds tested; for the other Landmarks (which
the Tour uses) 1 in 1500 found nothing clear (a Mailbox tucked in
front of its House) and takes the preferred spot anyway.

**Assembling and re-forming** (`guide.ts`, `guideMotion.ts`). On mount
the Guide assembles: one small cube per voxel (an `InstancedMesh` with the
voxels' colours, standard material) flies from a scattered spot 2.5–4.5
units round and 1.5–3.5 below its place, on an arc 1.2 units high, eased
out, growing from nothing; the voxels set off in turn, lower ones first,
over the first 45% of the 1.6 s. Once all have landed the body and screen
replace them. On `show` (a new Seed) the formed Guide dissolves (the same
flights backwards, 0.7 s), moves to the new World's Station spot and
assembles again; `guide.formed` resolves when it has landed, and the page
then has it say a line. A roll during either restarts from where it is.
Under reduced motion or on a hidden page it is simply there, formed.

**Idling.** While formed, with motion allowed and the page visible, it bobs
0.1 units every 2.6 s, turns ±0.08 rad every 7 s about its face-on pose
(turned −45° so the screen faces the camera) and blinks for 0.15 s every
4.2 s. Under reduced motion it keeps still and does not blink.

**Flying on the Tour.** `guide.flyTo(spot, ms)` sends the formed Guide to
another spot (`guideSpot` of the step's Landmark, from
`WorldView.guideSpot(id)`): `travelPoint(from, to, t)` eases in and out
(cubic) along the straight line and rises over it on a sine arc, 0.6 units
plus 0.15 per unit of distance, at most 3. It bobs on top of that and
keeps rendering frames while it flies (`moving`). With `ms` 0 it cuts.
If it is not formed yet it forms at the new spot instead. The promise
resolves when it lands, or when a later flight or a new World (`formAt`)
takes over. `say(lines, { hold: true })` keeps the last line up until the
next `say` or `hush`, so a Tour step's line waits for the visitor.

**Over the canvas.** Each frame `place(camera)` projects its middle: the
button is laid over it (0.8 of its reach each way), and the speech bubble
is placed by `placeBubble` (`speechBubble.ts`): over the Guide, else under,
right or left, the first that fits inside the frame 10 px from its edges
and 10 px clear of every floating card, preferring one also clear of the
Landmark hotspots; over or under it slides along the frame and its tail
(`--tail`, `data-side`) keeps pointing at the Guide. If the Guide's middle
half is off screen or under a card, or nothing fits, the bubble is not
shown (`data-offscreen`).

## Sea

The sea is a 1-unit voxel layer (the terrain tier; polish ticket 07),
built by `seaModel.ts` (pure) and drawn with `seaMaterial.ts`:

- **Voxels.** Every sea cell of the grid, and of a ring 8 cells wide
  round it (`SEA_RING`), is one water voxel 1 unit tall whose top is at
  the sea level, y = 0.15 (`SEA_LEVEL`). Only faces that can show are
  built: each voxel's top, and a short skirt on its +x and +z sides (the
  sides the isometric camera sees) where the neighbour is water too, from
  the top down to y = 0.05, so a voxel bobbing above its neighbour shows a
  side, never a gap. Faces against land and undersides are never seen.
  Beyond the ring, four flat strips of still deep water reach 6× the grid
  (`SEA_SPAN`) round its middle, flush with the ring's outer voxels, so the
  sea fills the frame at any aspect ratio.
- **Shade.** `coastDistance` measures each voxel's distance to the nearest
  land cell (centre to centre, a two-pass chamfer within about half a cell
  of the true distance). `seaShade` turns it into the voxel's `deep` (0
  beside the coast to 1 at 6 cells, `DEEP_REACH`), its `opacity` (0.7
  beside the coast to 1 at 3 cells, `CLEAR_REACH`) and its `swell` (1, fading
  to 0 over the ring's 4 outer cells). The shader mixes the Biome's
  `waterShallow` and `waterDeep` by `deep`.
- **Seabed.** The sea floor is y = 0 (boats, buoys and the jetty's posts
  stand on it). Under every translucent voxel a seabed tile at y = 0, the
  Biome's sand 0.1 darker, shows through the water.
- **Look.** `seaMaterial` uses the soft-voxel look (`softVoxelLook`, shared
  with `voxelMaterial`) at 1 unit, measured at each vertex's place before
  the bob (and from the sea level, so the voxel edges are at y = 0.15),
  so seams, bevels and jitter ride with the voxel. It is transparent
  (`opacityNode` from the shade), receives shadows and casts none.
- **Bob.** In the vertex shader each voxel's top (and its skirts' top
  edges) rises and falls 0.04 units (`SEA_BOB`) round the sea level every
  4.5 s (`SWELL_PERIOD`), out of step with its neighbours (a hash of its
  cell) and with a slow swell running across the sea (its x + z),
  scaled by its `swell`. The `time` uniform is the runtime's seconds of
  swell (`objects.swell`): it advances only while the World (not the House
  Interior) is on show, motion is allowed and the page visible, so under
  reduced motion the water holds still where it is (a fresh page and the
  build's World still show the bob at time 0, the voxels' steps frozen).
  The bob keeps frames coming at the tier's ambient rate (30 fps on
  phones), like the ships.
- **Night** darkens both water colours and the seabed (`seaColour`: the
  `waterShift` token, −0.12 OKLCH lightness).
- **Triangles.** Two for each top, two for each skirt, eight for the flat
  strips, two for each seabed tile: about 34,000 on `lighthouse` (66×64
  grid), 22,000 on `42` (49×49) and 47,000 on `seed-1` (64×98), the
  largest part of `data-triangles` now.

Boats and ships still stand on the sea floor with their first layer under
the water; they do not bob. The Model Gallery floats them on an opaque
1-unit patch of the Biome's shallow water whose top is the sea level.

## World Web Worker and cache

`createWorldSource().load(seed, counts)` returns `{ world, meshed, ms, generateMs }`:

- It posts `{ id, seed, counts }` to `world.worker.ts`, which runs
  `generateWorld` and `meshWorld` and posts back the World and its
  `MeshedWorld` (chunk typed arrays). The mesh buffers are transferred, not
  copied. `ms` is the worker's generate-plus-mesh time (about 15–55 ms per
  Seed in headless Chrome, far inside the 1 s budget). `generateMs` is the
  generate time alone; a cache hit keeps it.
- Results are cached per Seed and content counts (the promise is cached, so
  two requests for one Seed share one build). The cache keeps the 16 most
  recently used Worlds; a cache hit reports `ms: 0`.
- If a `Worker` cannot be created, it generates and meshes on the main thread.
- The cached typed arrays outlive the GPU buffers: disposing a geometry frees
  only its GPU copy, so a cached World can be shown again.

## Scene runtime

`mountWorld(canvas, world, meshed?, ui?)` returns a `WorldView`
`{ show(world, meshed?), camera, focus(id, { at?, ms }), focusState(id, at?), setViewCentre(at), setInterior(open, ms), setTheme(theme), guide, onFrame(listener), backend, dispose() }`. `ui` is
`{ frame, hotspots, cards?, theme?, guide? }`: the element round the canvas that takes pan and zoom
input, the Landmark hotspot links inside it, the Data Cards, the theme of the first frame and the Guide's
button, speech bubble and the boxes its bubble avoids (default: the canvas's
parent, no hotspots, no cards, Day, no Guide button or bubble). `guide` is the Guide's
`{ formed, say(lines, { hold? }), hush(), flyTo(spot, ms) }` (see "The Guide"), and `guideSpot(id)` is its spot beside a placed Landmark of the World on show. `ui.onExplore` hears the visitor pan or zoom (`cameraRig`'s `onInput`) or tab to a Landmark off screen: free exploration, which ends the Tour. `setViewCentre(at)` says where the visitor
looks (CSS px from the frame's centre: the middle of the part the floating
cards leave free, from `freeCentre`), which picks the Data Card shown and
is where the pan bounds apply (`CameraLimits.at`, below). `setInterior(open, ms)`
opens the House (its lid lifts over `ms`, the developer's link shows) or
shuts it (the lid comes down); 0 cuts. The House stays open or shut across
`show`: a new World's lid starts where the old one was. `camera` is the camera rig (below); `focus` flies the
camera to a Landmark (see "Landmark focus and flights").

- **Renderer:** `WebGPURenderer` (`three/webgpu`), falling back to WebGL 2 by
  itself. Neutral tone mapping, PCF shadows; MSAA on the full tier only.
- **DPR cap:** 1.5 on coarse-pointer (touch) devices, 2 elsewhere
  (`pixelRatio` in `lib/renderTier.ts`); re-read on resize.
- **Render tier:** chosen once at mount (`renderTier`, `lib/renderTier.ts`;
  `ui.tierOverride` from `?tier=`). `full`: MSAA, a 2048² shadow map,
  every frame. `reduced` (a touch device whose screen's shorter side is
  under 600px): no MSAA, a 1024² shadow map, and ambient frames at most 30 a
  second (below). It never adds or removes anything in the World.
  `canvas.dataset.tier` and `view.tier` report it.
- **Camera:** orthographic, on the true isometric axis (1, 1, 1). Zoom 1
  frames the Overview view so every Isle fits at any aspect ratio; the
  camera rig moves and zooms it from there. It never rotates.
- **Lights:** a hemisphere sky light and one directional sun at the approved
  azimuth and elevation. Its shadow camera covers the whole World
  (2048² map, 1024² on the reduced tier). Their colours and strengths, and the sky, are theme tokens
  (see "Day and Night").
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
  lid moves (the page cuts it under reduced motion), and while the House
  Interior shows, the page visible and motion allowed, when every frame
  advances the developer and the screen (`work`). Elapsed time is shared:
  at most 0.1 s a frame for ships and the developer alike. Under reduced
  motion the House Interior renders once and goes idle, the developer in
  their pose of the moment. The Guide keeps frames coming while it assembles,
  dissolves or flies on the Tour, and while it idles (bobbing and blinking) with the page
  visible and motion allowed; idling is why, like the ships, an idle World
  with motion allowed renders every frame (ADR 0005). Under reduced motion
  it re-forms by a cut and keeps still.
  The sea bobs while the World (not the House Interior) is on show, the
  page visible and motion allowed (`swell(seconds)` advances its shader's
  time), so it keeps frames coming too; under reduced motion it holds still.
  Frames come two ways: `requestRender()` (mount, `show`, resizes, camera
  moves and flights, a theme change) marks the frame as asked for, and it
  renders on the next animation frame; a frame that only ambient motion
  wants (the sea, the ships, the Guide, the developer, the lid) renders only when
  `ambientFrameDue(now, lastTick, tier.ambientFps)` says so, otherwise it
  waits for the next animation frame. On the full tier that is every frame;
  on the reduced tier at most 30 a second, while the camera still moves at
  the display's rate. Elapsed time is measured between rendered frames, so
  motion keeps its speed. Each frame first updates the camera's matrices, re-places the hotspots
  and the Data Cards, then renders.
  three's `render()` also starts the renderer's internal animation loop,
  which would then tick `requestAnimationFrame` forever (it only advances
  node time, which nothing here uses); `mountWorld` stops it after each
  frame through the internal `renderer._animation`, guarded in case it
  disappears, so an idle page schedules no `requestAnimationFrame` at all.
  Other animation should request frames only while it moves, like the ships.
- **Frame reports:** `onFrame(listener)` (returns an unsubscribe) is told
  after each frame renders: its `requestAnimationFrame` time, triangles and
  draw calls from `renderer.info.render`. Those counts are the frame's own:
  `render()` restarts three's animation loop, which resets them first. It
  never requests a frame, and with no listener nothing is read. `backend`
  is `webgpu` or `webgl2`. The render stats overlay uses both.
- The canvas gets `data-seed` (the Seed actually used, after the default
  fallback), `data-triangles` (voxel triangle count), `data-backend`
  (`webgpu` or `webgl2`), `data-frames` (frames rendered so far),
  `data-interior` (`open`, `shut` or `moving`: the House's lid),
  `data-scene` (`world` or `interior`: the scene on show; the frame gets it
  too), `data-interior-triangles` (the House Interior scene's triangles) and
  `data-camera` (target x, target z, zoom) for checks in a browser. The page
  adds `data-generate-ms`.

## Day and Night

The theme (`site-project.md`, "Day and Night") reaches the World through
`view.setTheme(theme)`, and the first mount takes the theme in force
(`ui.theme`). Everything comes from the `world` tokens of
`THEME_TOKENS` (`site/src/data/theme.ts`), the same set that drives the
page's CSS:

| Token | Day | Night |
|---|---|---|
| `sky` (background) | the approved pale blue | a deep blue (L 0.27) |
| `sunLight`, `sunIntensity` | the approved warm sun, 2.4 | a cool moon, 1.2, from the same direction |
| `skyLight`, `groundLight`, `skyIntensity` | the approved hemisphere, 1.1 | a dim blue hemisphere, 0.95 |
| `waterShift` | 0 | −0.12 lightness on both water colours and the seabed |
| `lightsOn` | off | the House's windows (`windowLight`, a warm white) and the buoys' lamps (`buoyLight`, a warm amber) glow |

`setTheme` recolours the sky, the lights, the water's two colours and the seabed, shows
or hides the window panes and lamp boxes, sets `canvas.dataset.theme` and
renders one frame. A new World (`show`) takes the theme in force. Nothing
moves, nothing is added to or removed from the voxel meshes, the sun keeps
its direction (so the static shadow map is kept), and the camera, hotspots
and Data Cards are untouched: the layout is the same in both themes. The
glow is unlit colour (`MeshBasicNodeMaterial`), not real lights, so it
adds no shader variants and no per-frame cost.

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
- **`cameraRig.ts`**: `createCameraRig({ element, camera, onChange, onInput? })` owns
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
  at least 28 px a side). The Garden's hotspot covers its fence and plants. Hover and keyboard focus
  show an outline and the Landmark's label: the hover affordance and the
  keyboard focus. If a hotspot takes focus while off screen, the camera
  cuts to centre on it. The frame uses `overflow: clip`, so focusing a
  hotspot never scrolls the frame. This is not GPU picking.
- **The developer's link** (ticket 11): right after the House's hotspot, the
  page renders a link to Team (`a.hotspot.developer[data-developer]`,
  `data-hotspot="house-interior"`, labelled "Meet the Team"), sized to the
  developer's box in the House Interior (`developerBox`, in world units). It
  is hidden while the House is shut and shown while it is open
  (`setInterior`), above the House's hotspot, which covers the room. While
  the House Interior scene shows, it is the only hotspot. On `/about/team` the page marks it with
  `aria-current="page"` (an outline).
- **Plant links** (ticket 08, polish ticket 05): right after the Garden's
  hotspot, the page renders one link per planted Project
  (`a.hotspot.plant[data-project]`, `data-pinned` on a Pinned Project's, also
  `data-hotspot="garden"`) to `/garden/<id>`, labelled with the Project's
  title: the first six Pinned Projects (flowers), then the next three
  Projects in Garden order (trees; `plantedProjects`). `setWorld` pairs them
  with the World's flower and tree cells through `gardenPlants`
  (`src/lib/gardenPlants.ts`); a link with no plant is hidden. The screen
  rectangles round neighbouring plants' isometric boxes (`plantExtent`: the
  cell, up to the plant's top) overlap, so a plant's link is only the middle
  of its plant (`plantLinkSize`): with `s` screen px per world unit,
  `0.7·s` wide, a flower's `0.8·s` tall and a tree's `2·s`, round the box's
  centre. Cells side by side sit `0.71·s` apart across the screen, cells one
  behind the other diagonally `0.82·s` apart down it, and a tree's centre
  stands about `0.65·s` above that of the flower diagonally in front of it,
  so no link covers another plant's (`plantLinks.test.ts` checks a full
  Garden in every Biome). A plant link under 12 px wide gets `data-small`
  and stops taking the pointer (clicks fall through to the Garden's
  hotspot); it still takes keyboard focus. With the camera at the Garden
  (`/garden`), flowers are 47 × 53 px and trees 47 × 133 px at 1440 × 900,
  and 13 × 15 px and 13 × 37 px on a 390 × 844 phone, where the Garden fits
  the strip above the bottom sheet; there they take the pointer but are
  below a comfortable tap size (zooming in grows them). The page marks the
  open Project's plant link with `aria-current="page"` (an outline).

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
below that today (counts for the voxel meshes; see below for the sea):

| Seed | Isles | Terrain | Detail | Total |
|---|---|---|---|---|
| default (`lighthouse`, measured after ticket 12) | 1 | 1,088 | 1,624 | 2,712 |
| `2` | 3 | 1,956 | 1,798 | 3,754 |
| `3` | 3 | 3,422 | 1,576 | 4,998 |
| `13` | 4 | 2,100 | 2,112 | 4,212 |

Counts are with no Projects. Highest
over Seeds `0`–`299`: 5,610; with 24 trees in the Garden, 7,672 (the Station's model, ticket 09, adds 240). Meshing takes about 15–25 ms per World.
`mesher.test.ts` checks the budget on 40 sampled Seeds, including 4-Isle
ones. Boats (ticket 10) add about 53 triangles each, so 12 boats about 640
(highest over Seeds `0`–`299` with 24 trees and 12 boats: 8,320); each
ship adds 206, outside the voxel chunks (`data-triangles` counts them).
The House's room (ticket 11) adds about 320 to the detail mesh. Since polish
ticket 01 the House is a ⅛-unit structure: its base adds about 900–1,100
triangles in the structure mesh (902 on `lighthouse`, tropical; 1,114 on
`2`, autumn), and its lid (about 2,000–2,400) and the developer (48) are
meshes of their own (counted in `data-triangles`). The budget is measured
again as more ⅛-unit structures land (ADR 0006). The 4 buoys (ticket 13) add about 160 to the detail
mesh; the Night glow (5 window panes, 4 lamp boxes) adds about 60 more. Polish ticket 02 grew the Isles about 1.5× (about twice the land):
on the site's own content, `data-triangles` reads 7,830–10,832 over `lighthouse` (8,712),
`lanternfish`, `42`, `harbour`, `694157692` and `seed-7`. The camera's pan bounds, zoom range
and Overview framing need no change: they follow `views.overview` and the Isles' bounds;
the sun's shadow camera covers the larger grid (about 1.35× wider) with the same map, so shadows are
about three quarters as sharp. Polish ticket 03 moved the Station, the Mailbox and the
Dock's things to ⅛-unit Variants and added two more House Variants per Biome: on the same
Seeds `data-triangles` now reads 9,240–12,326 (`lighthouse` 9,726, up about 1,000), the
Station's mast and the round tower's cap costing the most. Polish ticket 04
replaced the ¼-unit room (about 320) with the House Interior's room at ⅛ unit
(about 1,000–1,200: 982 northern, 1,144 volcanic, 1,178 autumn, 1,208
tropical); `lanternfish` reads 11,640. The House Interior is a scene of its
own, about 3,500 triangles, rendered instead of the World. Polish ticket 05
replaced the ¼-unit Garden with its ⅛-unit fence and instanced plants: with
the site's six Projects (three pinned: three flowers, three trees)
`data-triangles` reads 13,732 (`42`), 14,538 (`harbour`), 14,978
(`lighthouse`), 16,696 (`lanternfish`) and 19,730 (`seed-2`), about 3,000–3,500
more than before, mostly the fence and the trees' crowns. Polish ticket 06
replaced the ¼-unit boat and ship with ⅛-unit kinds (instanced): with the
site's six Clients and three Partners `data-triangles` reads 16,870 (`42`),
17,662 (`harbour`), 18,100 (`lighthouse`), 19,810 (`lanternfish`) and
22,998 (`seed-2`), about 3,100–3,300 more, mostly the ships' sails and
cabins. Polish ticket 07 replaced the two flat sea planes with the voxel sea,
now counted in `data-triangles`: 38,664 (`42`), 51,948 (`lighthouse`),
62,152 (`seed-2`) and 68,532 (`seed-1`), the sea about two thirds of it.
Headless Chrome (software GL) drew `lighthouse` at about 18 fps on
desktop (20.5 before) and held 30 fps on the phone tier. Decoration (a later ticket) will add most of the remaining
triangles.

## Not yet built

Animation of plants, boats and ships rocking on the swell, and the
reduced-decoration tier.
