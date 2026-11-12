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
| `interiorModel.ts` | The House Interior's room, pure (see `voxel-structures.md`, "The House Interior rooms"): `furnishedRoom(biome)` (the room with the developer seated in it, 1/16 unit), `interiorPlacement` (the room's place in the World), `developerBox`, `developerBounds` (the developer's box in world units, for their link), `screenFace`, `roomLight` and `DEVELOPER_PARTS`. | no |
| `structureModels.ts` | Structures placed in a World (see `voxel-structures.md`): `structureColour` (a colour role's id), `drawStructure` (a structure, or one part, at a placement, turned to its door), `landmarkStructure` and `landmarkPlacement` (a placed Landmark's Variant, and where and which way it stands), `houseStructure` and `housePlacement` (the same for the House), `drawStructures` (the structure grid's contents) and `houseWindowFaces` (the lit window faces). | no |
| `voxelCounts.ts` | `countVoxels(world)`: voxels by kind (terrain, Landmarks, plants, Decoration, House room, boats, ships, buoys, bridges, stairs), the total and those in the three meshed grids, for the render stats overlay. Redraws the detail grid with `drawDetail` and tallies each part as it lands (a shared voxel counts once); plants are each Garden plant's structure voxels (`gardenPlantsOf`; instanced, outside the grids), the House room the House Interior's furnished room at 1/16 unit (a mesh of its own, outside the grids, drawn only while the House is open); the House's structure (base and lid, ⅛ unit) counts with the Landmarks; boats, ships and pieces of Decoration are each one's structure voxels (instanced, outside the grids; every piece, as the full tier shows it). About 2 ms. | no |
| `frameMeter.ts` | `createFrameMeter()`: FPS and frame time from frame timestamps, smoothed (exponential, 0.1); a gap over 250 ms ends a burst and the next starts afresh; `'idle'` with no frame for 500 ms or only a lone frame. | no |
| `landmarkModels.ts` | The ¼-unit parts of the Landmarks (the Dock's deck and jetty), and `landmarkExtent(world, landmark)`: the box a Landmark covers, measured from its ¼-unit parts, its Variant's structure and, for the Garden, its plants, and never smaller than its footprint (for the House, the House's 3×3 up to its roof). | no |
| `gardenPlants.ts` | The Garden's plants (polish ticket 05): `plantStructure` (the Biome's tree; its flowers in turn), `gardenPlantsOf(world)` (every flower and tree with its cell and structure), `plantExtent` (a plant's box, for its link) and `plantedGarden(biome)` (a fence planted full, for the Model Gallery). | no |
| `garden.ts` | `buildGardenPlants(world, clock)`: one `InstancedMesh` per plant structure, one instance per plant, on the Garden's ground, swaying in the wind (`windSway.ts`). | yes |
| `plantLinks.ts` | `plantLinkSize(kind, pxPerUnit)`: a plant link's size on screen, so no link covers another plant (see "Plant links"). | no |
| `buoyModel.ts` | `drawBuoy(cell, grid, colours)`: a buoy in the detail grid; `buoyLamp(cell)`: its lamp's box, which glows at Night. | no |
| `houseMotion.ts` | `ROOF_LIFT`, `roofLift(opening)` (the lid's height, eased), `openingStep` (the opening after a frame, toward a target from 0 to 1) and `developerPose(seconds)` (typing and reading). | no |
| `vesselModels.ts` | The boats and ships (polish ticket 06): `vesselStructure` (a kind's structure in a Biome), `boatsOf(world)`, `boatPlacement` and `shipPlacement` (see "Boats and ships"). | no |
| `boats.ts` | `buildBoats(world)`: one `InstancedMesh` per boat structure, one instance per moored boat; `rock(seconds)` rocks them on the swell. | yes |
| `decorationModels.ts` | Decoration as structures: `decorationStructure(biome, kind)`, `decorationPlacement(world, piece)` (its cell's middle, on its ground, turned to its facing) and `decorationOf(world, tier)` (every piece on the full tier, every other one on the reduced tier). | no |
| `decoration.ts` | `buildDecoration(world, tier, clock)`: one `InstancedMesh` per Decoration structure, one instance per piece the tier shows; its plants sway (`windSway.ts`). | yes |
| `windSway.ts` | `swayMaterial(structure, clock)`: the soft-voxel material with the wind sway in the vertex shader; `swaysInWind(kind)` (grass, clumps, bushes, small trees) and `MAX_SWAY` (see "Ambient Life: wind, leaves and the swell"). | yes |
| `swell.ts` | The sea's swell, pure: `SWELL_PERIOD`, `SWELL_STRIDE`, `swellPhase` and `vesselRock(x, z, seconds)` (a vessel's heave, roll and pitch, in step with the water). | no |
| `fallingLeaves.ts` | Falling leaves, pure: `fallingLeaves(world, tier)` (each leaf's start in a tree's canopy, landing down the wind, colour and timing) and `leavesShown(total, lifeTier)`. | no |
| `leaves.ts` | `buildLeaves(world, tier, clock)`: one `InstancedMesh` of ⅛-unit cubes moved in the vertex shader on the shared clock; `setLife(tier)` shows the tier's share. | yes |
| `swarms.ts` | The Biome's particles, pure: `swarms(world)` (each butterfly's, firefly's, snowflake's and ash flake's path, colour and timing inside its spawn area), `particlesOut(world, theme)`, `swarmShown(total, lifeTier)` and `SWARM_WOBBLE` (see "Ambient Life: butterflies, fireflies, snow and ash"). | no |
| `particles.ts` | `buildParticles(world, clock)`: one `InstancedMesh` of ⅛-unit cubes per particle kind, moved in the vertex shader on the shared clock and wind; `setTheme(theme)` shows the kinds out, `setLife(tier)` the tier's share. | yes |
| `cloudMath.ts` | The clouds, pure: `cloudFade(world, zoom)` (how much of the clouds shows at a zoom: whole at the Overview, gone well before any close-up), `cloudsShown(total, lifeTier)`, `cloudShadowDrift(wind, seconds)` and `cloudShadowStrength(theme)` (see "Ambient Life: clouds and their shadows"). | no |
| `clouds.ts` | `buildClouds(world, clock)`: every cloud meshed from its 1-unit voxels and merged into one translucent mesh, drifted in the vertex shader on the shared clock; `setTheme`, `setZoom` (the fade) and `setLife` (the tier's share). | yes |
| `schools.ts` | The fish, pure: `schoolFish(world)` (each fish's loop, lane, speed, wiggle and leap timing in its school), `fishAt(fish, seconds)` (where it is, its heading and pitch, whether it is leaping), `sprayDrops` and `sprayAt` (the spray its leaps throw up), `fishShown` and `sprayShown` (the life tier's share), `FISH_REACH`. | no |
| `fish.ts` | `buildFish(world, clock)`: one `InstancedMesh` of the Biome's fish structure and one of ⅛-unit spray cubes, both moved in the vertex shader on the shared clock by `schools.ts`' sums; `setLife(tier)` (returns the fish shown), `setTheme(theme)` (the spray takes the foam's colour). | yes |
| `surf.ts` | The shore's surf, pure: `surfFoam(d, u)` and `surfGlow(d, u)` (foam and glow at a distance from the coastline, part-way through a wave), `surfFront`, `SURF_PERIOD`, `SURF_RUN`, `SURF_BREAK`; `seaMaterial` does the same sums per ⅛-unit square. | no |
| `cloudShadow.ts` | `CLOUD_SHADOW` (the shared `drift` and `strength` uniforms) and `cloudShade(position)`: the clouds' soft shadows, a drifting noise mask every voxel material and the sea take into their colour. | yes |
| `shipMotion.ts` | `sailingPath(cells)`: a ship's loop of cells smoothed into a closed path; `shipPose(path, distance)`: position and heading that far along it. | no |
| `guideModel.ts` | The Guide's model: `guideVoxels(colours)` (a 6×6×6 ¼-unit cube centred on its origin, side fins, an antenna, the bezel on +x), `GUIDE_SCREEN` (the screen's rectangle) and `GUIDE_FACES` (a 12 × 10 pixel-eye face per mood, and a blink). | no |
| `guideMotion.ts` | `guideSpot(world, id)` (where the Guide floats beside a placed Landmark), `voxelFlights` and `flightPoint` (the assembly), `travelPoint` (flying between spots on the Tour), `hoverPose(seconds)` (the bob) and `blinking(seconds)`. | no |
| `speechBubble.ts` | `placeBubble(guide, bubble, frame, covers, landmarks?)`: where the speech bubble goes on screen, or nowhere. | no |
| `cameraMath.ts` | Pure camera math: `screenToGround`, `panBy`, `zoomAt` (zoom toward a point), `clampState`, `stateShowing` (the state that shows a point at a screen offset), `screenOffsetOf` (where a point is seen; its inverse), `dampState` (a camera chasing a target, closing about 63% of the gap per time constant; the Story Scroll's damping) and `flightState` (one moment of an eased flight). | no |
| `storyMath.ts` | The Story Scroll on phones (polish 18): `storyPosition(scrollY, stops)` (which two sections the page is between and how far), `sectionInView`, `storyFraming` (the camera there, eased; a cut under reduced motion) and `storyOpening` (how far the House is open). Tested in `storyMath.test.ts`. See `site-project.md`, "Phones: the Story Scroll". | no |
| `dataCardMath.ts` | Data Card maths: `nearestDataCard` (which card shows), `dataCardAnchors` (where a card stands or hangs), `dataCardTransform` and `placeDataCard` (the CSS `matrix3d`). | no |
| `landmarkFocus.ts` | `landmarkFocus(world, id)`: the point to look at and the zoom for each of the seven Landmarks. | no |
| `world.worker.ts` | The World Web Worker: `generateWorld` then `meshWorld`, posting the World and its chunk meshes back (mesh buffers transferred). | no |
| `worldSource.ts` | `createWorldSource()`: main-thread side of the worker, with a per-Seed cache. | no |
| `seaModel.ts` | The sea, pure (see "Sea"): `seaModel(world)` (the water voxels' tops and skirts, the flat water beyond them and the seabed, as typed arrays, with each voxel's surf data: the coast's distance and the calm at its corners), `coastDistance` (from `world/coast.ts`) and `seaShade`, and `SEA_LEVEL`. | no |
| `voxelMaterial.ts` | `voxelMaterial(voxelSize, space?, { displace? })`: the TSL node material, in world space or (for instanced and moving meshes) the mesh's own space, optionally moving each vertex (a swaying plant), shaded by the clouds' shadows (`cloudShadow.ts`); `softVoxelLook` is the look on its own (seams, bevel, jitter) for other materials. | yes |
| `ambientClock.ts` | `createAmbientClock()`: the shared Ambient Life clock (`time`, seconds, advanced only while Ambient Life is alive) and wind (`wind`, the World's direction) uniforms; `windAt(clock, position)`: the wind at a world position in the shader, gusts rolling down the wind (see "Ambient Life: loop, clock and tiers"). | yes |
| `ambientLife.ts` | `createAmbientLife`: whether the World is seen (tab shown, canvas on screen, motion allowed) and alive (seen, at a tier that moves), the life tier watch and the clock, for `mountWorld`'s loop. | DOM only |
| `seaMaterial.ts` | `seaMaterial(clock)`: the sea's TSL material (the soft-voxel look at 1 unit, shallow to deep colour, opacity, the bob in the vertex shader on the shared clock, the shore's surf per ⅛-unit square and its glow at Night) and its colour uniforms (water, foam, glow). | yes |
| `structureMeshes.ts` | Repeated structures: `structureGeometry` (a structure meshed once, anchor at the origin), `structureInstances` (one `InstancedMesh` per structure, one instance per copy, optionally with a material of its own), `instanceMatrix` (a copy's transform: whole quarter turns about a pivot, plus an optional heave, roll and pitch for a vessel on the swell, pure maths) and `mergeChunks`. | yes |
| `house.ts` | `buildHouse(world, clock?)`: the House Variant's lid (⅛ unit) as a mesh, the windows' lights, and the House Interior's room at 1/16 unit (furniture, the developer's head and hands, the code screen, the Night lamp worked out in the room's material); `setOpening` lifts the lid and shows the room while it is above 0, `setLights` lights the windows and the lamp, `work(seconds)` poses the developer; `roomTriangles` and `developer` (the developer's box, for their link). | yes |
| `ships.ts` | `buildFleet(world)`: one `InstancedMesh` per ship structure, one instance per Partner of that kind, and `sail(seconds)` to move them along their loops, rocking on the swell. | yes |
| `worldMeshes.ts` | `buildWorldObjects(world, meshed?, tier?, clock?)`: chunk meshes plus the sea (water and seabed), the ships and boats, the House's moving parts, the Garden's plants, the Decoration, the falling leaves, the Biome's particles, the clouds, the fish and the buoys' lamps, as a `THREE.Group`; `step(seconds)` puts what moves on the CPU (the ships and boats on the swell, the developer, the clouds' shadows' drift) where it is at the clock's seconds; `setLife(tier)` shows the life tier's share of the leaves, particles, clouds and fish (and returns how many fish show); `setZoom(zoom)` fades the clouds; `setTheme` recolours the sea and the clouds, lights the lamps and windows, shows the particles out and sets the clouds' shadows (none at Night). | yes |
| `guide.ts` | `createGuide`: the Guide's body, screen face and flying voxels, re-formed with each World (`formAt`), its idling (`step`), and its button and speech bubble over the canvas (`place`, `say`, `hush`). | yes |
| `mountWorld.ts` | The scene runtime: renderer, camera, lights, shadows, the render loop (continuous while Ambient Life is alive, else on demand) and the render tier, opening the House, the Guide, Day and Night, swapping Worlds, `onFrame` for the stats overlay. | yes |
| `statsOverlay.ts` | `createStatsOverlay({ dice, frame })`: the render stats toggle and card (see `site-project.md`, "Render stats"), loaded only in dev or with `?stats`; its styles are `statsOverlay.css`, imported inline. | DOM only |
| `cameraRig.ts` | `createCameraRig`: the camera state and the pointer, touch and wheel input that pans and zooms it (`onInput` hears that input). | yes |
| `dataCards.ts` | `createDataCards`: lays the page's Data Cards over their Landmarks and shows the one the camera is near. | yes |
| `landmarkHotspots.ts` | `createLandmarkHotspots`: positions the page's Landmark hotspot links over their models, the Garden's plant links over their flowers and trees and, while the House is open, the developer's link over the developer. | yes |

Everything above `voxelMaterial.ts` is plain TypeScript; generation and
meshing run in the Web Worker. Only geometry upload, materials, the sea,
the instanced boats, ships, plants and Decoration, the House's lid and room and the Guide
(small grids) are built on the main thread.

## Voxel grids

Three grids, one per voxel tier the World uses (ADR 0006, `voxelTiers.ts`),
each in its own integer voxel coordinates (voxel `(x, y, z)` spans world
`[x·size, (x+1)·size)`):

| Grid | Voxel size | Contents |
|---|---|---|
| terrain | 1 unit (`TERRAIN`) | Every land column from y = 0 to its height. The top voxel takes the surface colour (sand, grass, peak) or the path colour (the path's cells, and the House yard's cell in front of its door); buried voxels take their stratum's colour. |
| detail | ¼ unit (`GROUND_DETAIL = 4` per unit) | Bridge decks (one ¼ voxel thick, planks alternating in shade), stairs (three ¼-voxel steps on the lower cell), the Dock's deck and jetty (`landmarkModels.ts`) and the buoys. |
| structure | ⅛ unit (`STRUCTURE = 8` per unit) | Placed structures (`structureModels.ts`, `voxel-structures.md`): each Landmark's Variant: the House's base (its lid is a mesh of its own), the Station, the Mailbox, the things on the Dock's deck and the Garden's fence. The Garden's flowers and trees are ⅛-unit structures too, but instanced (`garden.ts`), not in this grid, and so are the boats and ships (`boats.ts`, `ships.ts`). |

The House Interior's tier (`INTERIOR`, 1/16 unit) is the room's own: it is
drawn in the World at that detail while the House is open, as meshes of
its own outside these grids (`house.ts`; see "The House and its room").

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
scale) and keep its seams. In local space the seams and colour jitter are
measured on the geometry as meshed (`positionGeometry`, `normalGeometry`),
so every copy of an `InstancedMesh` keeps them on its voxels' edges however
it is placed, turned, tilted or swayed (polish ticket 10); the bevel is
measured after instancing, exact for whole-voxel placements and a little off
the edges on a heaving or tilted vessel. `displace` moves each vertex in the
vertex shader (`positionNode`), passed to the fragment stage as a varying,
and the bevel is measured where the vertex was before it moved.

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
- **Boats** (`boats.ts`): one `InstancedMesh` per boat structure, one
  instance per moored boat, rocking on the swell (`rock(seconds)`, see
  "Ambient Life: wind, leaves and the swell"). They cast shadows into the
  static shadow map, which keeps the rest pose. A boat's first layer is under the sea (sea level 0.15), so it floats
  at the waterline.
- **Ships** (`ships.ts`): one `InstancedMesh` per ship structure, one
  instance per Partner of that kind; `sail(seconds)` resets each
  instance's placement every frame, rocking on the swell where it is. They
  receive shadows but cast none: the static shadow map would leave a moving
  ship's shadow behind.
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
the House Interior (polish tickets 04 and 17): one room per Biome at 1/16
unit (`voxel-structures.md`, "The House Interior rooms"), drawn in the World
at that detail while the lid is up:

| Part | What | Drawn |
|---|---|---|
| base | the structure's `base` voxels: the plinth (or stilts and a deck), the floor with a rug, and the two back walls (low x and low z), each with a window | into the World's structure grid (static) |
| lid | the structure's `lid` voxels: the roof with its eaves and chimney (or the Biome's equivalent), and the two front walls (high x and high z: the faces the isometric camera sees) with the door, the windows, shutters and sills | its own mesh, which lifts |
| room | the Biome's furnished room (`furnishedRoom`, the developer seated in it) at 1/16 unit in the interior box: its still voxels as one mesh, the developer's head and hands (`DEVELOPER_PARTS`) as one mesh each, and the screen | meshes of their own (`house.ts`), shown only while the lid is lifted or lifting |

Every House Variant leaves its interior box empty, covers every interior
column from above with the lid, and keeps the base off the front sides
above the floor, so with the lid off the camera sees in
(`structures.test.ts`); each Biome's room fits the interior space of every
House Variant in that Biome, seats the developer at its anchor and puts the
screen in front of them (`structures.test.ts`, `interiorModel.test.ts`). In
the World, the base alone lands in the House's 3×3 of the structure grid
and the door on the face the House's `door` names
(`structureModels.test.ts`).

- **Meshes** (`house.ts`). The lid (⅛ unit) and the room (1/16 unit) are
  meshed on the main thread at the House's place in the World (whole
  voxels) and use `voxelMaterial(size, 'local')`, so the lid's seams line
  up with the base's and travel with it, and the developer's carry with
  their head and hands. The lid and the room's furniture cast and receive
  shadows; the head and hands only receive them, since the shadow map is
  not redrawn as they move.
- **Lights.** `houseWindowFaces(world)` finds every face of window glass
  (role `window`) that faces +x or +z with nothing of the House in front
  of it: on the front walls these face out, towards the camera; on the
  back walls they face into the room. A `MeshBasicNodeMaterial` square a
  hair in front of each, in the `windowLight` token, shows only at Night
  (`setLights`); one mesh for the lid's faces, a child of the lid so it
  lifts with it, and one for the base's. From outside the shut House shows
  lit windows, and inside the open House the back windows glow.
- **Lifting** (`houseMotion.ts`). The House's opening runs from 0 (shut)
  to 1 (open); `openingStep` moves it toward its target (open, shut, or
  part-way while the Story Scroll leads it) at a rate that takes the given
  time from shut to open (a cut at 0). `roofLift(opening)` lifts
  the lid by up to `ROOF_LIFT` = 6 units, eased in and out: high enough
  that, in the House Interior close-up, the lid is clear of the room on
  screen (it rises out of the top of the frame). The sun's shadow map is
  redrawn on every frame while the lid moves, then stays static. The room
  shows from the first frame the opening leaves 0 and hides on the frame
  it is back at 0 (`setOpening`), so a shut House draws none of it.
- **Triangles.** The House's base adds about 900–1,100 triangles to the
  structure mesh; the lid is about 2,000–2,400 as its own mesh. The room is
  about 2,100–2,800 (`data-room-triangles`), drawn only while the House is
  open or opening and not counted in `data-triangles`.

### The House Interior

The House Interior is part of the World (polish ticket 17, amending ADR
0006): there is no scene of its own and no hand-over. From the moment the
lid starts to lift until it is down again the visitor sees the same
1/16-unit room and developer, so nothing in it changes resolution or
texture as the House opens or shuts. The camera dives in and out of the
House as for any other Landmark close-up.

- **Entering** (`setInterior(true, ms)`, About and Team): the lid lifts
  over `ms` while the camera flies to the House Interior close-up; the room
  shows as soon as the lid moves. Under reduced motion the lid and the
  camera cut.
- **Leaving:** shutting the House (`setInterior(false, ms)`: any other
  route, the Tour moving on) lowers the lid while the camera flies on; the
  room hides once the lid is down. Zooming out or panning away leaves the
  House open, the room in view in the World.
- **The screen:** a `MeshBasicNodeMaterial` plane a hair in front of the
  `screen` voxels' +x face (`screenFace`): a 14 × 7 pixel grid with a gap
  round each pixel, lines indented and as long as a hash of the line
  number says, in one of three muted colours (teal, pink, white), with
  gaps between words and the odd blank line, scrolled up 2.5 lines a second
  by the shared clock's `time` uniform (`ambientClock.ts`), so it stops
  with the rest of Ambient Life.
- **Light:** the World's own sun and sky light. At Night the room's lamp or
  fire lights it warmly: the light a three.js point light (intensity 6,
  reach 5 units, no shadow) at the middle of the room's lamps and fires
  (`roomLight`) would give a diffuse surface, worked out in the room's own
  material as its emissive term (`roomLamp` in `house.ts`). Only the room's
  furniture and the developer catch it, not the House's walls or anything
  else in the World, and it costs nothing elsewhere: a real light in the
  World's scene would be evaluated by every World material. The back
  walls' windows glow (the base's `houseWindowFaces`).
- **The developer at work.** `WorldObjects.step(seconds)` poses the
  developer on the shared clock (`house.work`), so they work while Ambient
  Life is alive and stop with it (reduced motion, a hidden tab, the still
  life tier); on phones at the ambient frame rate.
  `developerPose(seconds)`: in a 5 s cycle the developer types for 3.6 s
  (each hand taps three times a second, in turn, never both up, at most one
  1/16-unit voxel; the taps fade in and out) and then pauses to read the
  screen, the head nodding two thirds of a voxel. Smooth everywhere, and
  the rest pose at 0. `houseMotion.test.ts` checks the lift, the opening
  steps and the pose.
- **The Guide** stays in the World, so on the Tour's Team stop it floats
  beside the open House in view.
- **Links:** the developer's link covers `developerBounds(world)`; every
  other hotspot stays as it is in the World.

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
  scaled by its `swell`. Its time is the shared Ambient Life clock's
  `time` uniform (polish ticket 09, "Ambient Life: loop, clock and
  tiers"): it advances only while Ambient Life is alive, so under reduced
  motion, at the still tier, on a hidden page or with the canvas off
  screen the water holds still where it is (a fresh page and the build's
  World still show the bob at time 0, the voxels' steps frozen).
- **Surf** (polish ticket 13; see "Ambient Life: shore waves, fish and
  glowing surf"). Each voxel also carries, at its four corners, the
  distance from the coastline (`coast`: the mean of the four cells' coast
  distances round the corner, less half a cell, so a land cell's edge is
  0; 8 units at most) and whether surf may break there (`calm`: 0 at any
  corner of the jetty's cells or a moored boat's). The shader runs the
  foam in along them.
- **Night** darkens both water colours and the seabed (`seaColour`: the
  `waterShift` token, −0.12 OKLCH lightness).
- **Triangles.** Two for each top, two for each skirt, eight for the flat
  strips, two for each seabed tile: about 34,000 on `lighthouse` (66×64
  grid), 22,000 on `42` (49×49) and 47,000 on `seed-1` (64×98), the
  largest part of `data-triangles` now.

Boats and ships stand on the sea floor with their first layer under the
water, and rock on the same swell (polish ticket 10, `swell.ts`, see
"Ambient Life: wind, leaves and the swell"). The Model Gallery floats them on an opaque
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
`{ show(world, meshed?), camera, focus(id, { at?, ms }), focusState(id, at?, zoomScale?), setViewCentre(at), setInterior(open, ms), setOpening(amount, ms), setDataCardFocus(id), setTheme(theme), guide, onFrame(listener), backend, tier, lifeTier, dispose() }`. `ui` is
`{ frame, hotspots, cards?, theme?, guide?, onExplore?, tierOverride?, lifeOverride? }`: the element round the canvas that takes pan and zoom
input, the Landmark hotspot links inside it, the Data Cards, the theme of the first frame and the Guide's
button, speech bubble and the boxes its bubble avoids (default: the canvas's
parent, no hotspots, no cards, Day, no Guide button or bubble). `guide` is the Guide's
`{ formed, say(lines, { hold? }), hush(), flyTo(spot, ms) }` (see "The Guide"), and `guideSpot(id)` is its spot beside a placed Landmark of the World on show. `ui.onExplore` hears the visitor pan or zoom (`cameraRig`'s `onInput`) or tab to a Landmark off screen: free exploration, which ends the Tour. `setViewCentre(at)` says where the visitor
looks (CSS px from the frame's centre: the middle of the part the floating
cards leave free, from `freeCentre`), which picks the Data Card shown and
is where the pan bounds apply (`CameraLimits.at`, below). `setInterior(open, ms)`
opens the House (its lid lifts over `ms`, the developer's link shows) or
shuts it (the lid comes down); 0 cuts. `setOpening(amount, ms)` opens it
part-way (0–1; the Story Scroll leads the lid with the page), moving at
the rate of a full lift over `ms`; `setInterior(open, ms)` is
`setOpening(open ? 1 : 0, ms)`, and the developer's link shows once the
House is more open than shut. `canvas.dataset.interior` is `shut`, `open`
or `moving`. `setDataCardFocus(id)` narrows which Data Card may show (see
"Data Cards"). `focusState(id, at, zoomScale)` scales the close-up's zoom
(the Story Scroll's intro and Garden framings). The House stays open or shut across
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
  second (below), and every other piece of Decoration (`decorationOf`). It
  never adds or removes a Landmark, plant, boat, ship or buoy.
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
- **Render loop, two modes (ADR 0005):** while Ambient Life is alive (see
  "Ambient Life: loop, clock and tiers" below) every frame asks for the
  next: the World renders continuously and the shared clock runs. Each
  frame advances the clock by the frame's elapsed time (at most 0.1 s, so
  nothing leaps after a pause), then `objects.step(clock.seconds)` sails
  the ships and poses the developer in the House, the sea bobs and the
  House's screen scrolls from the clock's uniform, and the Guide
  idles (bobbing and blinking). Otherwise the World renders on demand:
  `requestRender()` schedules at most one frame, and frames keep coming
  only while a one-off motion plays (the House's lid lifting or lowering,
  which the page cuts under reduced motion; the Guide assembling,
  dissolving or flying on the Tour). An idle World then schedules no
  `requestAnimationFrame` at all, and the clock stays where it stopped:
  under reduced motion the open House renders once, the developer in
  their pose of the moment, and the Guide re-forms by a cut and keeps
  still. The tab coming back, the canvas scrolling back on screen or
  reduced motion turning off requests a frame, which starts the loop again.
  Frames come two ways: `requestRender()` (mount, `show`, resizes, camera
  moves and flights, a theme change) marks the frame as asked for, and it
  renders on the next animation frame; a frame that only ambient motion
  wants renders only when `ambientFrameDue(now, lastTick, life.ambientFps())`
  says so, otherwise it waits for the next animation frame. That rate is
  the stricter of the render tier's and the life tier's: every frame on a
  desktop at the full life tier; at most 30 a second on phones (the
  reduced render tier) and at the reduced life tier, while the camera
  still moves at the display's rate. Elapsed time is measured between
  rendered frames, so motion keeps its speed. Each frame first updates the
  camera's matrices, re-places the hotspots and the Data Cards, then renders.
  three's `render()` also starts the renderer's internal animation loop,
  which would then tick `requestAnimationFrame` forever (it only advances
  node time, which nothing here uses); `mountWorld` stops it after each
  frame through the internal `renderer._animation`, guarded in case it
  disappears, so an idle page schedules no `requestAnimationFrame` at all.
  Ambient Life motion runs on the shared clock (its uniforms in the
  shader, or `objects.step` on the CPU); a one-off motion requests frames
  only while it plays, like the lid.
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
  `data-room-triangles` (the House Interior room's triangles, drawn only
  while the House is open),
  `data-tier` (the render tier), `data-life` (the Ambient Life tier on
  show), `data-clock` (the shared clock's seconds, at the last frame) and
  `data-camera` (target x, target z, zoom) for checks in a browser. The page
  adds `data-generate-ms`.

### Ambient Life: loop, clock and tiers

Polish ticket 09 (ADR 0005) laid the ground every Ambient Life motion
stands on. Tickets 10–14 add the motions themselves.

- **Seen and alive** (`ambientLife.ts`). The World is *seen* while the tab
  is shown (`visibilitychange`), the canvas is on screen (an
  `IntersectionObserver` on it) and the visitor has not asked for reduced
  motion. It is *alive* while it is seen and the life tier on show moves.
  Alive, it renders continuously; otherwise it renders on demand (above).
  One-off animations (the Guide assembling on a new World) play when the
  World is seen and cut otherwise. Reduced motion is heard on a
  `MediaQueryList` of its own: Chromium fires no `change` on a list whose
  `matches` was read between the change and the event, and the loop reads
  it every frame.
- **One clock** (`ambientClock.ts`). `clock.time` is a TSL uniform holding
  seconds of Ambient Life; only `advance` moves it, and only the loop
  advances it, while alive. Every Ambient Life material reads it (the sea,
  the swaying plants, the leaves), and CPU motion takes `clock.seconds`
  through `objects.step` (the ships and boats). Stopping the clock stops everything at once.
  A clock never advanced stays at 0: `buildWorldObjects` makes a frozen
  one by default, the Model Gallery has no clock-driven material yet and
  will pass a frozen clock when it gets one, and the build-time stills are
  captured under reduced motion, so at time 0.
- **One wind.** `World.wind.direction` is a unit vector across the ground
  that `generateWorld` draws from the Seed's own sequence (`<seed>/wind`,
  `world/wind.ts`): the same Seed always blows the same way, and the
  layout and content counts never change it. `show` puts it in
  `clock.wind`. `windAt(clock, position)` gives the wind at a world
  position in the shader: the direction times a strength from 0.35
  (`WIND_CALM`) to 1, raised by gusts that roll down the wind at 2.2 units
  a second, about 9 units apart, in two bands so they never repeat exactly.
- **Tiers** (`lib/lifeTier.ts`, pure). `full`, `reduced` and `still`. A
  desktop starts at full and a phone (the reduced render tier) at reduced;
  `?life=full|reduced|still` (`ui.lifeOverride`) starts at one and pins it,
  for measuring. The watch averages the time between continuous frames over
  windows of 3 s (`TIER_WINDOW_MS`); a window averaging under 40 fps at full,
  or under 20 fps at reduced, drops one tier, and the tier never climbs back
  during the visit. A gap over 1 s (a hidden tab, an idle World) is not a
  frame, and one hitch (a shader compiling) does not tip a window. Reduced
  motion shows still whatever the watch says, and follows the media query
  both ways (`lifeTierShown`). At reduced, ambient frames come at most 30 a
  second; at still nothing moves, the clock freezes and the World renders
  on demand. `share` is the part of each kind of living thing a tier shows
  (1 at full, 0.5 at reduced and at still, frozen where it stands); the
  falling leaves follow it (`objects.setLife`, every frame). `canvas.dataset.life`, `view.lifeTier` and the
  stats overlay's `life` row say which tier is on show.
- **Measured** (headless Chromium, software GL, `lighthouse`). Desktop
  (1440×900): about 4–6 fps, so the watch drops full to reduced in the
  first 3 s and to still 3 s later; `data-frames` then stops climbing and
  the clock stays put. Phone (393×852 at 3×, reduced): a steady 27–30 fps,
  no drop. Hidden tab, canvas off screen and reduced motion: no frames and
  a frozen clock, at desktop and phone sizes; each picks up again when it
  ends. A camera drag measured from the page's own frames costs the same
  with the loop running as at still: 38.5–38.8 ms a frame on the phone and
  184–186 ms on desktop (software GL), so the loop adds no stutter.

### Ambient Life: wind, leaves and the swell

Polish ticket 10 (ADR 0005) puts the shared wind and clock to work:

- **Wind sway** (`windSway.ts`). The Garden's trees and flowers and
  Decoration's grass, flower clumps, bushes and small trees take
  `swayMaterial(structure, clock)`, the soft-voxel material with a
  `displace`: each vertex moves down the wind by `windAt` where it stands
  (gusts roll across the Isle, so neighbours sway in turn) times how far
  up the canopy it is (0 over the lower 35% of the plant, its trunk or stem,
  rising to 1 at the top, from the geometry as meshed).
  The top moves at most `MAX_SWAY`, half a ⅛-unit voxel (1/16 unit): 0.55 of
  it a lean with the wind and 0.45 a flutter round it (1.8 s, each copy in
  its own phase from `instanceIndex`). It is linear above that line, so
  greedy-merged faces bend exactly unless one spans it. Landmarks, minor buildings, fences, lamps and rocks
  never sway; the Model Gallery uses the plain material. Plant hotspots are
  sized from the plant's cell, so they still line up (at most 1/16 unit
  off). The shadow map is static, so shadows keep the rest pose.
- **Falling leaves** (`fallingLeaves.ts`, pure; `leaves.ts`). Each tree (the
  Garden's, and the small trees and bushes the render tier draws) drops 2
  leaves, autumn's 3, at most 72 a World, from a sequence of the Seed's own
  (`<seed>/leaves`). A leaf starts on one of its tree's foliage voxels and
  takes that voxel's colour (the Biome's foliage roles, or autumn's gold),
  and lands down the wind 0.6–1.3 units per unit it falls (at most 2.5), on
  land as high as its tree's ground and off every Landmark but its own (the
  Garden); a way that leaves the land, changes height or crosses a Landmark
  is shortened in 0.25-unit steps, down to straight below. Its cycle: fade
  in over 0.4 s, fall at 0.28 units a second (at least 1.5 s), fluttering
  across the wind and pushed by gusts on the way (0 at either end), tumbling
  1–3 whole turns about x and half that about z so it lies flat, lie 1.5 s
  fading, then wait 2–9 s unseen. All of it is in the vertex shader of one
  `InstancedMesh` (per-leaf instanced attributes; the instance matrices
  stay identity), so a frozen clock holds every leaf where it is; a gone
  leaf shrinks to a point. The list is shuffled so the first half covers the
  World: `setLife` shows `leavesShown` (all at full, half rounded up at
  reduced and still). Leaves fall in every Biome, by Day and at Night.
  They are transparent, cast no shadow, are never frustum-culled and never
  raycast. At most 72 × 12 = 864 triangles.
- **The swell** (`swell.ts`). The sea's period (4.5 s) and stride (0.55
  radians a cell along x + z) live here, shared by `seaMaterial` and
  `vesselRock(x, z, seconds)`: a vessel heaves `SEA_BOB` (0.04) in step with
  the water voxel of its cell, whose own phase (three's TSL `hash` of the
  cell) `seaHash` works out on the CPU exactly as the shader does, and
  rolls up to 0.05 and pitches up to 0.035 radians a quarter swell later.
  `instanceMatrix` takes the heave, roll (about the vessel's length, its
  +x side up) and pitch (about its beam, its bow up) in the vessel's own
  frame. The boats rock in `step` (`boats.rock`), the ships as they sail.
- **Checked** in headless Chromium (SwiftShader) on `harbour` (tropical),
  `seed-1` (autumn), `seed-2` (northern) and `seed-3` (volcanic), desktop Day
  and Night and phone, with no console errors: the leaves fall and lie,
  the boats roll between frames, seams stay on the voxels. Under reduced
  motion the clock stays 0 and the canvas does not change
  (`e2e/ambient-life.spec.ts`).

### Ambient Life: butterflies, fireflies, snow and ash

Polish ticket 11 (ADR 0005) gives each Biome its own flying particles.
Each is a single-colour ⅛-unit cube with no structure file, and Day or
Night decides which are out (`PARTICLE_SETS`, `world/particles.ts`):

| Biome | Day | Night |
|---|---|---|
| tropical | butterflies | fireflies |
| northern | snow | fireflies, snow |
| autumn | (the falling leaves) | fireflies |
| volcanic | ash | ash |

- **Spawn areas** come from `generateWorld` (`World.particles`, see
  `world-generator.md`, "Particles"): boxes of air over the land, off every
  footprint and out of every Landmark's sight line. The World holds the
  areas of both Day's and Night's kinds, so switching theme never rebuilds.
- **Paths** (`swarms.ts`, pure, from a sequence of the Seed's own,
  `<seed>/swarms`): 3 butterflies an area, 5 fireflies, 8 snowflakes, 7
  ash flakes. Each moves about its `centre` by at most `sweep` on each axis,
  plus `SWARM_WOBBLE` (what the shader adds, and the cube's edge), so it never
  leaves its area. Butterflies and fireflies wander round a loose loop
  (`centre + sweep × (sin a, sin(1.7a + 1), sin(0.6a + 2))`, 5–9 s round for
  a butterfly, 9–15 s for a firefly). Snow and ash fall from the top of the
  box to its floor (snow 0.35 units a second, ash 0.25), drifting down the
  wind 0.3–0.6 (snow) or 0.5–0.9 (ash) units per unit they fall, as far as
  the box allows, then start again. The list is ordered round the areas,
  so the life tier's share (`swarmShown`: all at full, half rounded up at
  reduced and still) reaches every area.
- **The shader** (`particles.ts`): one `InstancedMesh` per kind, all
  motion in the vertex shader on the shared clock (per-particle instanced
  attributes; the instance matrices stay identity). A butterfly folds
  across to a third and back as it flaps (0.18–0.28 s) and bobs 0.06; its
  colour is one of five bright ones. A firefly is unlit
  (`MeshBasicNodeMaterial`), warm yellow-green, and blinks every 2–4.5 s,
  dim (40%, 15% opaque) between blinks. Snow (white) and ash (greys, one in
  four an ember) sway 0.1 across the wind, are pushed up to 0.15 by its
  gusts (`windAt`), turn slowly, and fade in over the first 8% of the fall
  and out over the last 12%. A frozen clock holds every particle where it
  is. `setTheme` shows the kinds out; `setLife` the tier's share.
- **Never in the way.** Particles cast no shadow, are never frustum-culled
  and never raycast (`raycast` is a no-op), and Landmark and plant hotspots
  are HTML over the canvas, so pointers reach them through the particles.
  At most 6 × 3 butterflies, 8 × 5 fireflies, 14 × 8 snowflakes or 12 × 7
  ash flakes a World: at most (40 + 112) × 12 = 1,824 triangles (northern).
- **Checked** in headless Chromium (SwiftShader) on `harbour` (tropical),
  `seed-1` (autumn), `seed-2` (northern) and `seed-3` (volcanic), desktop
  and phone, Day and Night, with no console errors
  (`e2e/ambient-life.spec.ts` runs all four by Day and at Night).

### Ambient Life: clouds and their shadows

Polish ticket 12 (ADR 0005). Clouds drift high over the sea round the
Isles, and their soft shadows cross the whole World.

- **Where** comes from `generateWorld` (`World.clouds`, see
  `world-generator.md`, "Clouds"): up to 8 clouds, each a shape of 1-unit
  voxels from the Seed (3–8 long down the wind, 2–5 wide, 2–3 high), its
  underside 2–4 units above the tallest Landmark, and a drift of 6–14 units
  down the wind at 0.2–0.4 units a second. All along its drift no column of
  it is over an Isle, a bridge, the jetty or a moored boat, straight down or
  down the camera's view ray, so a cloud never floats over one nor hides
  one, wherever the camera goes.
- **The body** (`clouds.ts`). Each cloud is meshed with the mesher (hidden
  faces culled, light AO), so the translucent body shows one skin, and all
  of them are merged into one mesh, cloud after cloud. Per vertex: its
  cloud's start and underside, its drift and its period and phase. The
  vertex shader moves it `fract(time / period + phase)` of the way along
  its drift on the shared clock, and round again; it fades in over the
  first 15% of a drift and out over the last 15%. The soft-voxel look at
  1 unit is measured on the cloud's own voxels, so the seams ride with it.
  It is lit, gives off 30% of its colour (so its shaded sides stay soft,
  not stony), and is 80% opaque at most. A frozen clock holds every cloud
  where it is.
- **Day and Night.** `WorldTokens.cloud`: white by Day (L 0.99), a dark
  grey-blue at Night (L 0.45, under the moon's dimmer light).
- **Zoom** (`cloudFade`, `setZoom`, every frame). The clouds show whole up
  to a tenth of the way (on a log scale of zoom) from the Overview to the
  World's closest Landmark close-up, and are gone by 60% of the way, eased
  between. They are gone in every Landmark's close-up, and in the phone
  Story Scroll's framings (which stand back to 0.8× a close-up's zoom).
  `canvas.dataset.clouds` says how much shows (`1.00` at the Overview,
  `0.00` in a close-up).
- **Tiers.** `setLife` shows the life tier's share of the clouds (all at
  full, half rounded up at reduced and still) with a draw range over the
  merged mesh.
- **Shadows** (`cloudShadow.ts`). Computed in the shader, never cast into
  the shadow map: `cloudShade(positionWorld)` is two octaves of MaterialX
  noise (`mx_noise_float`) over the ground (blots about 11 units across),
  thresholded softly, times `CLOUD_SHADOW.strength`. Every voxel material
  (terrain, bridges, stairs, Landmarks, the House's lid and room, the
  Garden's plants, Decoration, boats, ships, the Guide) and the sea's water
  and seabed multiply their colour by it, so the shadows cross Isles and
  sea alike. They do not follow the cloud bodies (which stay over the
  sea). `CLOUD_SHADOW.drift` moves them down the wind at 0.3 units a second
  (`cloudShadowDrift`), set from the clock's seconds in `objects.step`, so
  they stop with the clock. `strength` is `WorldTokens.cloudShadow`: 0.2 by
  Day (a shadow darkens to 80%), 0 at Night. Both uniforms are shared by
  the page; disposing a World's objects puts `strength` back to 0, and the
  Model Gallery never sets it, so it has no shadows. The
  shadow darkens the surface's colour, not just the sun's light, so the sky
  light under a shadow dims too: it reads as a passing cloud's shade.
- **Never in the way.** Clouds cast no shadow-map shadow, are never
  frustum-culled (the shader moves them) and never raycast; they draw
  after the sea (`renderOrder` 1), so the water shows through them.
  At most 8 clouds of up to about 80 voxels; greedy merging keeps them to
  a few hundred triangles a World (`harbour` 198 with 4 clouds, `seed-1`
  354, `seed-2` 402; at most 538 over 100 Seeds), in `data-triangles`.
- **Checked** in headless Chromium (SwiftShader), desktop and phone, with
  no console errors: `harbour` and `seed-2` by Day at the Overview and
  every Landmark's close-up, `seed-1` and `seed-3` by Day and at Night at
  the Overview and the Garden
  (`e2e/ambient-life.spec.ts` checks `data-clouds` at the Overview and in
  the Garden's close-up).

### Ambient Life: shore waves, fish and glowing surf

Polish ticket 13 (ADR 0005). Foam runs in and breaks along every coast,
schools of fish swim in the shallows and now and then one leaps, and at
Night the breaking surf glows faintly.

- **Surf** (`surf.ts`, pure; `seaMaterial.ts`). Computed in the sea's
  fragment shader from the water's distance-from-coast data (`seaModel`'s
  `coast` corners, see "Sea"), with no work on the CPU. Each ⅛-unit square
  of a water voxel's top takes the distance at its middle (bilinear
  between the voxel's corners) and how far through its wave it is: a wave
  every 7 s (`SURF_PERIOD`), arriving a little out of step along the coast
  (a slow wobble of a quarter of a wave across the sea). For the first 55%
  of a wave (`SURF_BREAK`) a crest of foam runs in from 2 units out
  (`SURF_RUN`), speeding up and thickening; then it lies thick along the
  edge and washes out to 0.85 units as it draws back, thinning to nothing;
  a thin rim always laps the edge. `surfFoam` gives the amount; a square is
  foam when a hash of it (new each wave) falls under it, so the foam is
  scattered ⅛-unit squares with the soft-voxel look at ⅛ unit (seams
  and jitter), nearly opaque (0.95), in `WorldTokens.foam`. Surf never
  breaks on the jetty's cells or a moored boat's (`calm` is 0 at their
  corners, fading over the next cell), so no foam runs under the deck or
  through a hull. Only voxel tops foam; the flat water beyond the ring is
  far from any coast. A frozen clock holds the surf where it is.
- **Glow at Night.** `surfGlow`: where a wave breaks (within about half a
  unit of the edge), brightest as it breaks and fading as it draws back.
  It is emissive, `WorldTokens.surfGlow` (a cyan) times
  `surfGlowStrength` (0 by Day, 0.8 at Night): 0.6 of it as a soft wash,
  the whole of it on the foam's squares where waves break, and a quarter
  of it on every square of foam. The foam itself dims at Night
  (`foam`: L 0.97 by Day, 0.72 at Night), so at Night the surf reads as
  faint cyan lines. It throws no light and does not
  bloom (that is ticket 16's).
- **Fish** (`schools.ts`, pure; `fish.ts`). `generateWorld` places up to 6
  schools in the shallows (`World.fish`, see `world-generator.md`, "Fish"),
  each a 2×2-cell square round a grid corner. A school's 3–5 fish swim
  round a loop of radius 0.35–0.42 units about its centre at 0.18–0.28 units a
  second, one behind the other 0.28 units apart in three lanes 0.1 apart,
  wiggling ±0.15 rad; they swim with their back 0.105 units up, under the
  lowest the water sinks to (0.11), so the translucent shallows tint them.
  The Biome's species (`fish/<biome>-1`, see `voxel-structures.md`) is one
  `InstancedMesh`, one instance a fish, in the soft-voxel look at ⅛ unit;
  it gives off 45% of its colour by Day, so it still reads through the
  water's tint, and 10% at Night, so it never glows.
- **Leaps.** Each school leaps once every 7–14 s, its fish taking turns
  (never two at once): out of the water nose up, 0.45 units high over
  0.9 s, landing nose down 0.3 units ahead, then drifting back to its
  place under the water over 2 s. As it leaves the water and as it falls
  back, 3 drops of spray (⅛-unit cubes in the foam's colour, glowing a
  little at Night) fly up 0.8–1.3 units a second and out 0.2–0.4 and fall
  back to the sea; between leaps a drop has no size. All of it in the
  vertex shader by the same sums as `fishAt` and `sprayAt` (tested: every
  fish and drop stays in its school's square, a swimming fish stays under
  the water, a leap clears it), so a frozen clock holds every fish.
- **Tiers and clicks.** `setLife` shows the life tier's share of the
  schools, whole schools (all at full, half rounded up at reduced and
  still), and their spray; `canvas.dataset.fish` says how many fish show.
  Fish and spray cast no shadow (the shadow map is static), are never
  frustum-culled (the shader moves them) and never raycast; the foam is
  the sea's own colour. Neither is a hotspot.
- **Triangles.** A fish is 40–60 triangles and a drop of spray 12 (6 a
  fish): about 2,900 a World on `harbour` (6 schools, 22 fish: 1,320 for
  the fish, 1,584 for the spray), in `data-triangles`. The surf adds none.
- **Checked** in headless Chromium (SwiftShader), desktop and phone, with
  no console errors: all four Biomes by Day and at Night at the Overview,
  and close-ups near a school (`harbour`'s Contact, `seed-1`'s Dock,
  `seed-2`'s Garden), with recordings of the waves and the leaps
  (`screenshots/13-*`); `e2e/ambient-life.spec.ts` checks `data-fish`
  follows the life tier.

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
| `cloud`, `cloudShadow` | white clouds, shadows 0.2 | dark grey-blue clouds, no shadows |
| `foam`, `surfGlow`, `surfGlowStrength` | white foam, no glow | dimmer grey-blue foam, glowing a faint cyan, brightest where waves break (0.8) |

`setTheme` recolours the sky, the lights, the water's two colours, the seabed and the clouds, sets the clouds' shadows, shows
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
  - `setInput(false)` stops all of it (the Story Scroll on phones): no
    pointer or wheel event is taken, so a swipe or the wheel scrolls the
    page; flights and cuts still move the camera.
  - `reset(limits, state, distance)` sets new bounds and cuts; `jumpTo(state)`
    cuts to a clamped state; `flyTo(state, ms)` flies there (below);
    `limits` are the current bounds and zoom range; `lookAt(at)` sets
    `limits.at` (kept across `reset`) without moving the camera.
- **Limits:** pan bounds are the union of the Isles' footprints (the same
  box the Overview is fitted to), so where the visitor looks is always over
  the World's land box. That is the free part's middle, not the screen's
  centre: with a panel open beside it, a Landmark at the World's edge can
  still be brought into the free part. `mountWorld`
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
  developer's box in the House Interior (`developerBounds`, in world units). It
  is hidden while the House is shut and shown while it is open
  (`setInterior`), above the House's hotspot, which covers the room. On `/about/team` the page marks it with
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
  and about 32 × 37 px and 32 × 92 px on a 390 × 844 phone, where the Story
  Scroll frames the Garden as close as the camera may come (flowers stay
  under 44 px: that would need a closer zoom than the World allows). The page marks the
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
  where they were. `view.setDataCardFocus(id)` narrows the choice to one
  Landmark's card (`null`: none; `undefined`, the default: any); the Story
  Scroll shows only its section's, once the camera holds there, and marks
  a card under a section's card `data-covered` (hidden). Cards are hidden until a World is shown and reset on a
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
  panel, intro, dice row) leave free, so the Landmark is
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
own, about 3,500 triangles, rendered instead of the World (polish ticket 17
removed both: the World now draws the 1/16-unit room, about 2,100–2,800
triangles, only while the House is open, so a shut House costs none of
it). Polish ticket 05
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
desktop (20.5 before) and held 30 fps on the phone tier. Polish ticket 08 added
the Decoration (instanced): with the site's content `data-triangles` reads 50,526
(`42`, volcanic, sparse), 95,524 (`lighthouse`), 98,748 (`lanternfish`), 104,704
(`seed-2`) and 133,734 (`seed-1`) on the full tier, and 44,934, 73,716, 75,076,
83,478 and 100,446 on the reduced tier (half the Decoration): the Decoration costs
about 11,000–65,000, roughly 240 a piece. In headless Chrome (software GL, a
slower run than the one above) `lighthouse` drew about 5.7 fps with it and 6.0–6.7
without; the phone tier held 29 fps.

## Not yet built

Nothing in this document's scope. The other Ambient Life motions (shore waves and fish, animals and birds, including bats and seabirds) come with polish tickets 13–14.
