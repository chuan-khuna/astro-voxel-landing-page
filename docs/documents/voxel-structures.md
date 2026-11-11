# Voxel structures

Predefined voxel models drawn as ASCII files (ADR 0004) at ⅛ unit (ADR
0006): how a file is written, how it becomes voxels at build time, how a
structure is placed in a World or repeated with instancing, and how to
review structures in the Model Gallery.

- Files: `site/src/structures/` (`house/<biome>-<variant>.structure`)
- Code: `site/src/structures/` (parser, roles, registry, Vite plugin),
  `site/src/render/structureModels.ts` (placing), `structureMeshes.ts`
  (instancing), `site/src/dev/` and `site/src/integrations/modelGallery.ts`
  (the Model Gallery)
- Decisions: `docs/adr/0004-ascii-voxel-structures.md`,
  `docs/adr/0006-voxel-resolution-tiers.md`
- Tests: `structures/parse.test.ts`, `structures/structures.test.ts`,
  `render/structureModels.test.ts`, `render/structureMeshes.test.ts`

## The format

A structure file is a header, a key, and one block of characters per
⅛-unit layer, bottom to top:

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
| `kind` | What the structure is: `house` today; later Station, Mailbox, trees, flowers, boats, ships, Decoration, creatures. |
| `biome` | The Biome whose style it is (`tropical`, `northern`, `autumn`, `volcanic`), or `any` for one shared by every Biome. |
| `variant` | Its Variant number within that kind and Biome, from 1 with no gaps. |
| `footprint` | Its footprint in cells, `<width>x<depth>`; each cell is 8 voxels, so every layer is `8 × width` characters wide and `8 × depth` rows deep. |
| `door` | The face its door is on, `+x`, `-x`, `+z` or `-z`, or `none`. Draw doors on `+z` (south): a placement turns the structure to face its Landmark's way. |
| `anchor` | The voxel corner (x, y, z) that stands on the footprint's min corner, on the ground. `0 0 0` for anything that stands on its footprint; a boat's anchor will sit at its waterline. |
| `interior` | Optional: a box of voxels (min x y z, then max x y z, max exclusive) that must stay empty, for a room. |
| `key:` | One line per character: the character, a colour role, and optionally a part (`lid`; the default is `base`). |
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
| Ground and floors | `plinth`, `floor`, `rug`, `post`, `deck`, `deckDark` |
| Walls | `wall`, `wallShade`, `bamboo`, `bambooDark`, `timber`, `timberDark`, `brick`, `brickDark`, `mortar`, `stone`, `stoneDark` |
| Roofs | `roof`, `thatch`, `thatchDark`, `shingle`, `shingleDark`, `tile`, `tileDark`, `slate`, `slateDark`, `snow` |
| Openings and trim | `door`, `doorWood`, `window`, `frame`, `trim`, `accent` (the Biome's accent), `metal` |
| Plants | `foliage`, `foliageLight` (the Biome's foliage), `flower`, `flowerLight` |

A new material is a new role in `roles.ts` (and, if needed, a fixed colour
with chroma at most 0.10 in `palette.ts`).

### Parts

Every voxel is in the `base` part unless its key says `lid`. The House's
lid is its roof and its two front walls (high x and high z, the faces the
camera sees): it lifts off as a mesh of its own, leaving the room open to
the camera like a doll's house.

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
- `drawHousePart(world, colours, part, paint)`: one part of the World's
  House Variant where the House stands.
- `houseStructure(world)` (the World's Biome's House Variant, by the
  House's `variant`), `housePlacement(house)` (its plot's origin, on the
  ground, its door the House's way) and `drawStructures(world, …)` (the
  World's structure grid: today the House's base).
- `houseWindowFaces(world)`: the open +x and +z faces of window glass, lit
  at Night (`rendering-and-shading.md`, "The House and its room").

Placed Landmarks are drawn into the World's ⅛-unit structure grid and
greedy-meshed once with it, with the soft-voxel material at ⅛ unit.

## Repeated structures

`render/structureMeshes.ts` is ready for structures that repeat (trees,
flowers, Decoration, boats, ships): `structureInstances(structure,
colours, placements, { part?, pivot? })` meshes the structure once
(`structureGeometry`) and draws every copy as one `InstancedMesh`, in the
soft-voxel material in local space. A placement is a point in world units
and a number of quarter turns about a pivot (by default the middle of the
footprint, on the ground); `instanceMatrix` builds its transform (one
quarter turn takes +z to +x). Copies move by whole voxels and turn by
quarter turns, so their seams stay on voxel edges. The Model Gallery uses
it today; Garden plants (polish ticket 05) are the first World use.

## The House Variants

One per Biome for now (polish ticket 03 adds 2–3 per Biome). Each is 24×24
at ⅛ unit on the House's 3×3, 23–32 layers tall (3.5–4 units with the roof),
with the door (4×10) in the middle of the +z wall, windows with shutters
and sills on the two front walls, one window in each back wall, eaves
overhanging the walls by two voxels, and a shared interior box (x and z
4–20, y 2–20) that holds the ¼-unit room:

| Biome | Variant 1 |
|---|---|
| tropical | a stilt house: bamboo walls on a plank deck on posts, pink shutters and flower boxes, a steep thatched hip roof with a finial in place of a chimney |
| northern | a log cabin: alternating log walls on a stone plinth, a steep shingled gable roof under snow, a stone chimney on the back slope |
| autumn | a brick cottage: running-bond brick on a stone plinth, green door and shutters, flower boxes, a tiled gable roof (gable to the front), a brick chimney |
| volcanic | a squat stone house: dark stone blocks, a low slate hip roof, a chimney with an ember glowing in it |

The four were drawn with a throwaway generator script and then committed as
plain ASCII; edit the files directly. `structures.test.ts` checks every
House Variant: 3×3, 28–32 layers, the door on +z with a 4×10 opening, an
interior box per Biome that holds the room and stays empty, a lid over
every interior column, no base wall on the front sides above the floor,
glass in the walls, and everything above the walls in the lid.

## Data tests

`structures.test.ts` reads every `*.structure` file from disk and checks
that it parses, that the build-time module holds the same voxels, that it
uses only known roles, and that it fills its declared footprint (every
cell has voxels; the grid is the footprint's size). `parse.test.ts`
checks the format on a small inline structure, including its errors.

## The Model Gallery

`/dev/models` shows every structure of one kind (a picker) in a grid:
Biomes across, then structures shared by every Biome, and Variants down,
each on a patch of its Biome's grass with a label. It uses the World's
renderer (`WebGPURenderer`, WebGL 2 fallback), soft-voxel material, sun,
sky light and Day and Night tokens (the light only: window glow shows in the World, not here). **Turn** turns every model a quarter
turn; **Lift lids** lifts the House lids to show the interior; **Night**
switches the light. It renders on demand.

The route is injected by the `modelGallery` integration only under
`astro dev` (`command === 'dev'`), so `bun run build` never builds it.
Agents attach Gallery screenshots whenever they add or change models.
