# Voxel structures

Predefined voxel models drawn as ASCII files (ADR 0004) at ⅛ unit (ADR
0006), and the House Interior's rooms at 1/16 unit: how a file is written,
how it becomes voxels at build time, how a structure is placed in a World
or repeated with instancing, and how to review structures in the Model
Gallery.

- Files: `site/src/structures/<kind>/<biome>-<variant>.structure` (`house`,
  `station`, `mailbox`, `dock`, `garden`; `tree` and `flower`; `boat` and
  `ship`; `room` and `developer` for the House Interior; the Decoration kinds `grass`, `clump`, `rocks`, `bush`, `sapling`, `fence`, `lamp`, `shed`, `windmill`)
- Code: `site/src/structures/` (parser, roles, registry, Vite plugin),
  `site/src/render/structureModels.ts` (placing), `structureMeshes.ts`
  (instancing), `interiorModel.ts` (the House Interior's room), `site/src/dev/` and `site/src/integrations/modelGallery.ts`
  (the Model Gallery)
- Decisions: `docs/adr/0004-ascii-voxel-structures.md`,
  `docs/adr/0006-voxel-resolution-tiers.md`
- Tests: `structures/parse.test.ts`, `structures/structures.test.ts`,
  `render/structureModels.test.ts`, `render/structureMeshes.test.ts`,
  `render/interiorModel.test.ts`, `render/vesselModels.test.ts`, `render/decorationModels.test.ts`

## The format

A structure file is a header, a key, and one block of characters per
layer (⅛ unit unless it says `scale: 16`), bottom to top:

```text
# Comments start with #.
kind: house
biome: tropical
variant: 1
footprint: 3x3
door: +z
anchor: 0 0 0
interior: 4 2 4 20 20 20
key:
  P plinth
  W wall
  w wall lid
layer 0
PPPPPPPPPPPPPPPPPPPPPPPP
... (24 rows)
layers 2-7
...
```

| Field | Meaning |
|---|---|
| `kind` | What the structure is: a Landmark (`house`, `station`, `mailbox`, `dock`, `garden`: the Garden's fence), a Garden plant (`tree`, `flower`), a Client's `boat` or a Partner's `ship`, a House Interior `room` or the `developer`, a piece of Decoration (`grass`, `clump`, `rocks`, `bush`, `sapling`, `fence`, `lamp`, `shed`, `windmill`); later creatures. |
| `biome` | The Biome whose style it is (`tropical`, `northern`, `autumn`, `volcanic`), or `any` for one shared by every Biome. |
| `variant` | Its Variant number within that kind and Biome, from 1 with no gaps. For a boat or ship it is the vessel's kind. |
| `footprint` | Its footprint in cells, `<width>x<depth>`; each cell is `scale` voxels (8 by default), so every layer is `scale × width` characters wide and `scale × depth` rows deep. |
| `door` | The face its door is on, `+x`, `-x`, `+z` or `-z`, or `none`. Draw doors on `+z` (south): a placement turns the structure to face its Landmark's way. |
| `anchor` | The voxel corner (x, y, z) that stands on the footprint's min corner, on the ground. `0 0 0` for anything that stands on its footprint; the Dock's things use `0 -2 0`, so their first layer stands on the Dock's ¼-unit deck. Boats and ships use `0 0 0` and stand on the sea floor, their first layer under the water. |
| `interior` | Optional: a box of voxels (min x y z, then max x y z, max exclusive) that must stay empty, for a room. |
| `scale` | Optional: voxels a unit, `8` (the default, ⅛ unit) or `16` (1/16 unit: the House Interior's rooms and the developer). |
| `developer` | Optional, a room's: the voxel (x y z) where the seated developer's anchor goes. |
| `key:` | One line per character: the character, a colour role, and optionally a part (`lid`, `head`, `leftHand`, `rightHand`; the default is `base`). |
| `layer N` / `layers A-B` | One block of rows for layer N, or the same block for every layer A to B. Every layer from 0 to the top appears exactly once. |

In a block, rows run north to south (z = 0 first) and the characters of a
row west to east (x = 0 first), so a block reads like the World seen from
above with north up. `.` is always empty. A row may not start with `#`.

Malformed files fail the build with the file and line: an unknown role or
part, a character missing from the key, a row or layer of the wrong size, a
missing or repeated layer, a bad header value.

### Colour roles

A structure never holds a raw colour. Each key character names a role
(`structures/roles.ts`), and the role resolves to a Biome colour or a
fixed colour (`render/palette.ts`), with an optional OKLCH lightness shift,
so every structure gets the same OKLCH, per-voxel jitter and seam shading as
the terrain:

| Group | Roles |
|---|---|
| Ground and floors | `plinth`, `concrete`, `floor`, `rug`, `post`, `postDark`, `deck`, `deckDark` |
| Walls | `wall`, `wallShade`, `bamboo`, `bambooDark`, `timber`, `timberDark`, `brick`, `brickDark`, `mortar`, `stone`, `stoneDark` |
| Roofs | `roof`, `thatch`, `thatchDark`, `shingle`, `shingleDark`, `tile`, `tileDark`, `slate`, `slateDark`, `snow` |
| Openings and trim | `door`, `doorWood`, `window`, `frame`, `trim`, `accent` (the Biome's accent), `metal`, `metalDark`, `flag` (a mailbox's red flag), `canvas` (sail, awning, rope), `lamp` |
| Hulls | `hullRed`, `hullRedDark`, `hullNavy`, `hullNavyDark` (painted hulls; wooden and iron hulls use `bamboo`, `timber`, `slate` and their dark shades) |
| Plants | `foliage`, `foliageLight`, `foliageDark` (the Biome's foliage), `leafGold` (autumn leaves), `flower`, `flowerLight`, and for the Garden's flowers `stem`, `stemLight`, `stemDark` (one green in every Biome), `petalWhite`, `petalYellow`, `petalOrange`, `petalRed`, `petalBlue`, `petalBlueLight` and `pollen` |
| Decoration | `rock`, `rockDark` (the Biome's stone, for rock piles), `turf`, `turfLight` (the Biome's grass, darker or lighter, for tufts) |
| House Interior | `screen` (the computer's screen, which glows with code), `fire` (a hearth or brazier), `desk`, `chair`, and the developer's `skin`, `hair`, `shirt`, `trousers`, `shoe` |

A new material is a new role in `roles.ts` (and, if needed, a fixed colour
with chroma at most 0.10 in `palette.ts`).

### Parts

Every voxel is in the `base` part unless its key says otherwise. The
House's `lid` is its roof and its two front walls (high x and high z, the
faces the camera sees): it lifts off as a mesh of its own, leaving the room
open to the camera like a doll's house. The developer's `head`,
`leftHand` and `rightHand` are their moving parts, each a mesh of its own
in the World while the House is open.

## Build-time parsing

`parseStructure(text, name)` (`structures/parse.ts`) turns a file into a
`Structure`: the header fields, `size` in voxels, a `palette` of
`{ role, part }` entries and `voxels`, a `Uint8Array` with one byte per
voxel at `x + size.x · (z + size.z · y)` (0 empty, else 1 + a palette
index). `structureVoxels(s)` walks the filled voxels and `voxelAt(s, x,
y, z)` reads one.

`structurePlugin()` (`structures/vitePlugin.ts`) is a Vite plugin that turns
each `*.structure` import into a module whose default export is the parsed
structure, its voxels decoded from base64 into a `Uint8Array`. The browser
never parses ASCII. It is in `astro.config.mjs` for pages and for the World
Web Worker's bundle (`vite.worker.plugins`), and in `vitest.config.ts`. The
parser and plugin import with relative paths, because the configs load them
before the `@/` alias exists.

`structures/index.ts` is the registry: `import.meta.glob` loads every
`*.structure` file under it, as `STRUCTURE_FILES` (by path) and
`STRUCTURES` (sorted by kind, Biome and Variant); `variantsOf(kind,
biome)` lists one kind's Variants for a Biome.

## Placing a structure

`render/structureModels.ts` (pure):

- `structureColour(colours, role)`: a role's colour id in a World's colour
  table.
- `drawStructure(structure, at, colours, paint, part?)`: paints a structure
  (or one part) with its anchor at `at` (World ⅛ voxels), facing
  `at.facing`. Files are drawn with the door south (`door: +z`; any other
  door face is refused); `east` swaps x and z. That is a mirror, not a
  quarter turn: it keeps the front walls on the camera's two sides, so the
  lid still opens the room to the camera, but a chimney or side window swaps
  sides. The Gallery's **Turn** shows quarter turns, not this mirror.
- `landmarkStructure(world, landmark)`: the Landmark's Variant, the file of
  its kind in the World's Biome numbered by the Landmark's `variant` (the
  generator's pick, `world-generator.md`); the Garden's is its fence.
- `landmarkPlacement(world, landmark)`: its footprint's origin, on the
  ground. The House faces its door (`housePlacement`: its plot's origin);
  the Mailbox faces the same way, onto the yard; a Dock whose footprint
  runs north to south (1×2) is laid along it with the `east` mirror; the
  Garden's fence turns its gate the Garden's way (`door`, south or east;
  the fence is the same on every side but the gate); the Station faces
  south.
- `drawHousePart(world, colours, part, paint)` and `houseStructure(world)`:
  one part of the World's House Variant, and that Variant.
- `drawStructures(world, …)`: the World's structure grid: the House's base,
  the Station, the Mailbox, the Dock's things and the Garden's fence. The House Interior's room
  is not in the grid: the World draws it at its own 1/16 unit, as meshes of
  its own (below).
- `houseWindowFaces(world)`: the open +x and +z faces of window glass, lit
  at Night (`rendering-and-shading.md`, "The House and its room").

Placed Landmarks are drawn into the World's ⅛-unit structure grid and
greedy-meshed once with it, with the soft-voxel material at ⅛ unit.

## Repeated structures

`render/structureMeshes.ts` draws structures that repeat (the Garden's
flowers and trees, the boats and ships, the Decoration): `structureInstances(structure,
colours, placements, { part?, pivot? })` meshes the structure once
(`structureGeometry`) and draws every copy as one `InstancedMesh`, in the
soft-voxel material in local space. A placement is a point in world units
and a number of quarter turns about a pivot (by default the middle of the
footprint, on the ground); `instanceMatrix` builds its transform (one
quarter turn takes +z to +x). Copies move by whole voxels and turn by
quarter turns, so their seams stay on voxel edges; a sailing ship turns by
any fraction (its heading), its seams turning with it. The Model Gallery
uses it for every model, and the World for the Garden's plants
(`render/garden.ts`, see "The Garden" below) and the boats and ships
(`render/boats.ts`, `render/ships.ts`; see "Boats and ships") and the Decoration (`render/decoration.ts`; see "Decoration").

## The Landmark Variants

Each Landmark has one style per Biome and a few Variants in it (polish
ticket 03): the House 3, the Station 2, the Mailbox 3 and the Dock 2 per
Biome, 40 files; and the Garden 1, its fence (polish ticket 05), 44 in all. The
counts are `LANDMARK_VARIANTS` in `world/landmarks.ts`, which the
generator picks from; a data test holds the files to it. The Garden's
flowers and trees are structures of their own ("The Garden" below).

Except the first House of each Biome (polish ticket 01), they were drawn
with throwaway generator scripts (a roof generator for the House; box, disc
and cone helpers for the rest) and committed as plain ASCII; edit the files
directly.

### House

24×24 at ⅛ unit on the House's 3×3, 32 layers (4 units with the roof or
chimney), with the door (4×10) in the middle of the +z wall, windows with
shutters and sills on the two front walls, one window in each back wall,
eaves overhanging the walls by two voxels, and a shared interior box (x and
z 4–20, y 2–20) that holds the Biome's room. Variants 2 and 3 keep Variant
1's walls (layers 0–19) and change the roof, the chimney and the porch:

| Biome | 1 | 2 | 3 |
|---|---|---|---|
| tropical | a stilt house: bamboo walls on a plank deck on posts, pink shutters and flower boxes, a steep thatched hip roof with a finial in place of a chimney | a thatched gable roof, its gable to the front (bamboo, with a window), and a thatched porch on bamboo posts over the door | a long thatched gable roof, its ridge east to west, a window in the east gable |
| northern | a log cabin: alternating log walls on a stone plinth, a steep shingled gable roof (ridge east to west) under snow, a stone chimney on the back slope | a steep shingled hip roof, snow on its top, a shingled porch on log posts, a stone chimney at the back | a shingled gable roof to the front, a window in the gable, a stone chimney on the west slope |
| autumn | a brick cottage: running-bond brick on a stone plinth, green door and shutters, flower boxes, a tiled gable roof (ridge north to south), a brick chimney | a tiled gable roof, ridge east to west, a tiled porch on wooden posts, a brick chimney at the back | a steep tiled hip roof with a brick chimney at the back corner |
| volcanic | a squat stone house: dark stone blocks, a low slate hip roof, a chimney with an ember glowing in it | a low slate gable roof to the front, a slate porch on stone posts, an ember in the chimney | a steep slate hip roof, an ember in the chimney at the back corner |

`structures.test.ts` checks every House Variant: 3×3, 28–32 layers, the
door on +z with a 4×10 opening, an interior box per Biome that holds the
room and stays empty, a lid over every interior column, no base wall on the
front sides above the floor, glass in the walls, and everything above the
walls in the lid. So every House Variant in a Biome has a liftable roof and
the same interior space (the Biome's room fits them all; see below).

### Station

16×16 on its 2×2, 40–48 layers (5–6 units), door 4×10 on +z, tall parts at
the back so nothing hides the door:

- **1, a hut and mast:** a 10×10 hut one storey tall in the Biome's walls,
  its door and a window on the front, a window on the east side; the Biome's
  roof over it (tropical: thatched hip; northern: steep shingled gable under
  snow; autumn: tiled gable; volcanic: flat slate with a parapet); a dish on
  the roof's front corner; a lattice mast at the back corner with the accent
  light on top (47 layers); two server cabinets with accent status lights
  and a water tank in the yard, and a planter in the tropical and autumn
  ones.
- **2, a round tower:** a round tower three storeys tall in the Biome's
  walls, its door on the front, a band of windows near the top and a gallery
  ring; a conical cap (thatch in the tropics, tile in autumn) or a dome (a
  white observatory dome with a slit in the north, slate with an ember-red
  slit in the volcanic Biome); an antenna and its light on top; a dish on
  the ground and a cabinet in the yard.

### Mailbox

8×8 on one cell of the House's yard, the box itself at most 6 voxels
across, 10 layers (1.25 units), its front on +z (turned the way the House's
door faces):

- **1, a box on a post**, its flag raised on the +x side, the side the
  camera sees (tropical: a pink box on bamboo; northern: a red box on a log
  post under snow; autumn: a green box on wood; volcanic: a metal box on
  iron, its flag ember red).
- **2, a pillar** of the Biome's material (bamboo canes, stone, brick, dark
  stone) with a letter slot and a plate on the front and a cap.
- **3, a little house:** the box shaped like a house under the Biome's roof,
  on a post.

### Dock

16×8 on its 2×1, standing on the Dock's ¼-unit plank deck (anchor `0 -2
0`), at most 6 layers, so at most 1 unit above the ground:

- **1, bollards and crates:** bollards at the four corners, a stack of
  crates (bamboo, timber or stone) and a coil of rope; snow on the northern
  crates.
- **2, a lamp and barrels:** a lamp on a post (an ember lamp in the volcanic
  Biome), barrels, a bollard, and the Biome's touch: a potted palm in the
  tropics, pumpkins in autumn, a coil of rope otherwise.

`structures.test.ts` checks every Landmark Variant: as many per Biome as
`LANDMARK_VARIANTS`, numbered from 1; never taller above the ground than
`LANDMARK_HEIGHT`; the Station 2×2, 40–48 layers, its door 4 wide and 10
tall on the front; the Mailbox 1×1, 8–10 layers, its box at most 6 across;
the Dock 2×1 on its deck, at most 1 unit up. `structureModels.test.ts`
checks them in the World: each Landmark draws its own Variant from the
World's Biome, fills its footprint on its ground, the Mailbox faces the
House's door, and the Dock's things stand on its deck.

### The Garden

Polish ticket 05. The Garden is 5×5: a 3×3 bed inside a fence one cell
wide (`world-generator.md`, "The Garden"). Each Biome has a fence
(`garden/<biome>-1`), a tree (`tree/<biome>-1`) and two flowers
(`flower/<biome>-1`, `-2`), drawn with a throwaway generator script and
committed as plain ASCII.

- **Fence** (40×40, at most 8 layers, so at most 1 unit): a fence along
  the middle of the ring of cells round the bed, the bed left empty, a
  gate in the middle of +z between two taller posts (`door: +z`). Tropical:
  bamboo, a pink gate, flowers on the gate posts. Northern: a split-rail
  log fence, snow on every post, a plank gate. Autumn: a white picket
  fence, a green gate. Volcanic: a low dry-stone wall, an iron gate
  between posts with embers on top.
- **Tree** (8×8, 24–28 layers, 3–3.5 units): a 2×2 trunk and a crown at
  most 6×6 (x and z 1–6 in the cell's 8×8), so neighbouring trees keep 2
  voxels apart and never merge into a hedge. Tropical: a coconut palm.
  Northern: a spruce in three tiers, snow on each. Autumn: a round oak in
  red and gold. Volcanic: a dragon tree, an umbrella crown on fanning
  branches, red berries beneath.
- **Flower** (8×8, 10–14 layers, 1.25–1.75 units): a 2×2 green stem with
  two leaves and a bloom 5–6 voxels across, filling the cell. Tropical: a
  pink hibiscus and a white frangipani. Northern: a blue crocus and a
  white daisy. Autumn: a sunflower and an orange chrysanthemum. Volcanic:
  a fire lily and an ember tulip. A Garden takes its Biome's flowers in
  turn, so neighbours differ.

`GARDEN_HEIGHT` (`world/landmarks.ts`) holds each to its height band:
the fence 1, a flower 1.75, a tree 3.5 units (`LANDMARK_HEIGHT.garden`);
placement keeps the other Landmarks in view past them. `structures.test.ts`
checks that every Biome has a tree and its flowers numbered from 1, the
fence's size, empty bed and gate, the trees' height and 6×6 crown and the
flowers' height and bloom. The fence is the one structure that does not
fill its whole footprint (its bed is empty).

## Boats and ships

Polish ticket 06. Each Client's boat and each Partner's ship comes in a
kind that follows its owner's id (`world-generator.md`, "Boat and ship
kinds"), styled per Biome: `boat/<biome>-<kind>` (3 kinds) and
`ship/<biome>-<kind>` (3 kinds), 24 files. `BOAT_KINDS` and `SHIP_KINDS`
(`world/vessels.ts`) are the counts; a data test holds the files to them.
They were drawn with a throwaway generator script (a hull helper: a beam
per row, a narrower keel, a deck and a gunwale) and committed as plain
ASCII; edit the files directly. Every one is drawn with its bow towards +z
(`door: none`), standing on the sea floor (anchor `0 0 0`), its first layer
under the water.

- **Boats** (1×1, 8×8): 6–8 long, 4–6 across, 4–8 tall.
  1. A rowing boat: two thwarts, a bow post, oars in their rowlocks.
  2. A sailing dinghy: a mast forward of the middle, a triangular sail on
     a boom, a pennant.
  3. A fishing boat: a wheelhouse at the stern with a window to the bow, a
     short mast forward.
- **Ships** (1×3, 8×24): 23–24 long, 8 across, 20–29 tall.
  1. A two-masted schooner: square sails on both masts, a jib to the
     bowsprit, a low cabin aft.
  2. A steamer: two decks of cabins with rows of windows, the bridge on
     top, a banded funnel, a mast at the bow.
  3. A cargo trader: the bridge house at the stern with an antenna light,
     stacks of crates forward, a crane over them.

| Biome | Boats | Ships |
|---|---|---|
| tropical | bamboo hulls, pink gunwales; the rowing boat is a canoe with an outrigger float; a thatched wheelhouse | white hulls with a pink gunwale, bamboo cabins, thatched roofs, a pink funnel |
| northern | red hulls, white gunwales, snow on the seats and the wheelhouse | red hulls with a white gunwale, timber cabins under snow, a black funnel with a red band, snow on the crates |
| autumn | timber hulls, green gunwales, a gold sail, a tiled wheelhouse | navy hulls with a gold gunwale, white cabins, tiled roofs, a red funnel |
| volcanic | iron (slate) hulls, ember gunwales, a red sail, a lantern at the stern | slate hulls with an ember gunwale, stone cabins, red sails, an ember glowing in the funnel |

`structures.test.ts` checks that every Biome has one boat per boat kind
and one ship per ship kind, numbered from 1; each boat's and ship's size;
that every ship is at least twice as long as any boat, 2.5 times as tall
and five times the voxels; and that each hull narrows towards its bow (+z).

## Decoration

Polish ticket 08. Each Biome has one piece of each Decoration kind
(`DECORATION_KINDS` in `world/types.ts`), `<kind>/<biome>-1`, 36 files, all
1×1 (8×8), standing on the ground (anchor `0 0 0`). The generator places
them (`world-generator.md`, "Decoration"); `render/decorationModels.ts`
takes each piece's structure, its placement (its cell's middle, on its
ground, turned to its facing) and the pieces a render tier shows, and
`render/decoration.ts` draws one `InstancedMesh` per structure. They were
drawn with a throwaway generator script and committed as plain ASCII; edit
the files directly. Sizes follow `.scratch/voxel-world-polish/README.md`;
no file may stand taller than `DECORATION_HEIGHT` for its kind.

| Kind | Size (⅛ voxels) | tropical | northern | autumn | volcanic |
|---|---|---|---|---|---|
| `grass` | tufts 2–4 tall | lush green tufts | pale tufts, frost on the tips | dry gold grass | sparse dark tufts, black pebbles |
| `clump` | two 3×3 clumps, 3–4 tall | red and pink blossoms | blue and white wildflowers | orange and yellow marigolds | fire-red blooms, ember hearts |
| `rocks` | a pile up to 6 across, 4 tall | boulders with moss | boulders under snow | boulders, fallen gold leaves | black basalt, glowing cracks |
| `bush` | 4×4, 5–6 tall | a shrub with pink blossoms | a juniper under snow | a shrub turning gold and red | a dark fern, ember berries |
| `sapling` | 12–15 tall, crown 4–5 across | a young papaya | a young birch | a young maple | a charred snag |
| `fence` | a run across the cell, 6–8 tall | bamboo poles and rails | a split-rail log fence under snow | a woven willow hurdle | iron railings, ember tips |
| `lamp` | 13–16 tall | a tiki torch | an iron lamp post | a lantern on a crooked post | a stone lantern with fire |
| `shed` | 6×6 walls, 11–12 tall, door +z | a bamboo hut under thatch | a log shed, snow on its shingles | a timber shed, tiled roof, green door | a stone store, slate roof |
| `windmill` | a 4×5 tower, sails on +z, 15 tall | bamboo, thatch cap, canvas sails | timber, snowy shingle cap | whitewash, tiled cap | stone, slate cap, red sails |

The small tree (`sapling`) is a different, smaller species than each
Biome's Garden tree. The lamps' glass and flames are plain colours for now;
they light up with the torches and Night light ticket (16). The shed and
windmill front on +z (`door: +z`), so the generator turns them south or
east to face the camera.

## The House Interior rooms

One room per Biome (polish ticket 04), drawn at 1/16 unit (`scale: 16`,
ADR 0006) in `structures/room/<biome>-1.structure`, and one seated
developer for every room, `structures/developer/any-1.structure`. They were
drawn with a throwaway generator script and committed as plain ASCII; edit
the files directly.

A room is 2×2 cells (32×32 voxels) and 31 layers, standing at the min
corner of the House Variants' interior box (16×18×16 at ⅛ unit, so 32×36×32
at 1/16): its back walls are the House's own (low x and low z), and its
front is open to the camera. Each has its own floor, a desk on the west
wall with the computer (its `screen` voxels face +x), keyboard and mug, a
chair, the developer at its `developer:` anchor (9 1 4), a lamp or a fire,
and the Biome's furniture. Tall furniture keeps clear of the back walls'
windows, wherever they fall with the door south or east.

| Biome | The room |
|---|---|
| tropical | bamboo slat floor, a woven pink rug, a bamboo desk and chair, a tall potted palm, a surfboard on the wall, a low bamboo table with a fruit bowl, a rolled-up hammock |
| northern | plank floor, a fur rug before a stone hearth with a fire and a mantel, stacked logs, a timber desk and chair, snowshoes on the wall, a little spruce in a pot |
| autumn | plank floor, a patterned rug, a bookshelf full of books, an armchair under a floor lamp, a padded chair, a pumpkin, a plant in a pot |
| volcanic | checked stone floor, a dark rug, a slate desk with a lava lamp, a shelf of glowing crystals, a brazier with a fire, crystals by the wall, a plant in a stone pot |

The developer is 20 voxels tall seated (1.25 units; a 6×5×6 head under a
layer of hair), facing −x, so the camera looks over their shoulder at the
screen; their head and hands are moving parts.

`render/interiorModel.ts` (pure):

- `furnishedRoom(biome)`: the room with the developer merged in, one
  1/16-unit structure (cached), their moving parts kept apart.
- `interiorPlacement(world)`: where the room's min corner stands in a
  World (1/16-unit World voxels): the House Variant's interior box as
  placed. The room never turns with the door (the box is square in plan).
- `developerBox`, `screenFace`, `roomLight`: the developer's box in the
  room, the screen's face (for its glowing code) and the middle of the
  lamps and fires (for the Night light).
- `developerBounds(world)`: the developer's box in a World, in world units,
  for their link to Team.

The World draws the furnished room at 1/16 unit, only while the House's
lid is lifted or lifting (`render/house.ts`; `rendering-and-shading.md`,
"The House and its room"): the same room from the moment the lid starts
to lift until it is down again (polish ticket 17).

## Data tests

`structures.test.ts` reads every `*.structure` file from disk and checks
that it parses, that the build-time module holds the same voxels, that it
uses only known roles, and that it fills its declared footprint (every
cell has voxels, but the Garden fence's bed; the grid is the footprint's size). `parse.test.ts`
checks the format on a small inline structure, including its errors.

For the House Interior, `structures.test.ts` checks one 1/16-unit room per
Biome; that each fits the interior space of every House Variant in its
Biome; that each seats the developer at its anchor, inside the room, clear
of the furniture and on a seat; that the screen faces the developer at eye
height; and that each has a lamp or a fire. `interiorModel.test.ts` checks
the furnished room, the room's place in the World and the developer's
box in it. `structureModels.test.ts` checks that the room stays out of the
World's structure grid, and `voxelCounts.test.ts` that the stats count it
at 1/16 unit.

For Decoration, `structures.test.ts` checks one piece of each kind per
Biome, numbered 1; that each is 1×1, anchored on the ground and no taller
than `DECORATION_HEIGHT`; the README's sizes per kind; that the small tree
is lower than the Garden's tree with a crown at most 5 across; that the
shed and windmill front on +z; and that every Landmark Variant stands at
least `LANDMARK_MIN_HEIGHT` tall (Decoration by a Landmark stays below it).
`decorationModels.test.ts` checks each piece's structure and placement, and
which pieces each render tier shows.

## The Model Gallery

`/dev/models` shows every structure of one kind (a picker) in a grid:
Biomes across, then structures shared by every Biome, and Variants down,
each on a patch of its Biome's grass (the Dock's things on a plank deck, as in the World) with a label. On a tall screen (a
phone) the Biomes wrap two to a band, each band with its Variants down it,
so the models stay large enough to judge; the grid re-lays when the screen
turns. It uses the World's
renderer (`WebGPURenderer`, WebGL 2 fallback), soft-voxel material, sun,
sky light and Day and Night tokens (the light only: window glow shows in the World, not here). **Turn** turns every model a quarter
turn; **Lift lids** lifts the House lids to show the interior; a House
Interior room (kind `room`) shows furnished, the developer at the
computer, at its own 1/16 unit; a Garden fence (kind `garden`) shows
planted full, six flowers and three trees, as a World lays them out
(`plantedGarden`); boats and ships float on a patch of their Biome's
shallow sea (darker at Night), its top at sea level as in the World, the
boats packed closer so each shows larger; the Decoration kinds sit in a
group of their own in the picker, packed closer still; **Night**
switches the light, and the page's own colours follow (the site's theme
tokens and fonts). On a phone the buttons show icons only (their names stay
as tooltips and for screen readers). It renders on demand and on resize.

The route is injected by the `modelGallery` integration only under
`astro dev` (`command === 'dev'`), so `bun run build` never builds it.
Agents attach Gallery screenshots whenever they add or change models.
