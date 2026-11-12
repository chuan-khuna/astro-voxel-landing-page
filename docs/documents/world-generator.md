# World generator

The World generator turns a Seed and content counts into World data. It is
the one piece of logic the tests target.

- Code: `site/src/world/`
- Tests: `site/src/world/generateWorld.test.ts` (Vitest)
- Decision: `docs/adr/0001-seed-generated-world.md`

## Interface

```ts
import { generateWorld, type ContentCounts, type World } from '../world';

const world: World = generateWorld(seed, { projects, pinned, clients, partners, clientIds, partnerIds });
```

`pinned`, `clientIds` and `partnerIds` are optional. The ids (each list in
id order) give each boat and ship its kind; without them, stand-ins
(`client-1`, `partner-1`, …) are used.

`generateWorld` is the single public function and the single test seam. It is:

- **pure**: no three.js, no DOM, no I/O. In the browser it runs in a Web
  Worker (`site/src/render/world.worker.ts`; see `rendering-and-shading.md`);
- **deterministic**: the same Seed and counts give a deep-equal World. Every
  random choice comes from one seeded PRNG (`prng.ts`: FNV-1a hash of the Seed
  string, then mulberry32). `Math.random` is never used, and a test fails if it is.

`index.ts` also exports the Landmark id lists (`PLACED_LANDMARK_IDS`,
`VIEW_LANDMARK_IDS`, `LANDMARK_IDS`), the Biome lists (`BIOME_IDS`,
`BIOME_COLOUR_ROLES`), `MAX_SEED_LENGTH`, the Garden's layout
(`GARDEN_SIZE` 5, `GARDEN_BED`, `GARDEN_HEIGHT`, `gardenCounts`) and the caps
`MAX_FLOWERS` (6), `MAX_TREES` (3) and `MAX_BOATS` (12), and the vessel kinds
(`BOAT_KINDS` 3, `SHIP_KINDS` 3, `vesselKind`). The site data module and the
`pages` collection schema type their Landmark ids against these, so a typo
is a type or build error.

The generator reads two values from the site data module (`src/data/site.ts`):
`defaultSeed` and `brandBiome`. That module is plain data with no Astro or DOM
imports, so the generator stays pure.

### Code layout

| File | What it does |
|---|---|
| `generateWorld.ts` | The public function: Seed fallback, Biome choice, the retry loop, the Dock-to-House route, derived views. |
| `landmarks.ts` | Landmark footprints: placement, levelling, the occlusion check (`sightline.ts`), `LANDMARK_HEIGHT` and `LANDMARK_MIN_HEIGHT`, the Garden's bed (its flowers and trees) and gate, and the Dock's berths (the moored boats). |
| `ships.ts` | The Partners' sailing routes: loops through open sea. |
| `buoys.ts` | The buoys: sea marks just off the Isles, nearest the Dock first. |
| `decoration.ts` | Decoration: `placeDecoration`, `DECORATION_HEIGHT` and `MINOR_BUILDINGS`: pieces of scenery on free land, each below the nearest Landmark and out of every Landmark's sight line. |
| `sightline.ts` | `forEachRayColumn`: the columns the camera's ray from a ground point passes through, the occlusion check shared by Landmark placement and Decoration. |
| `vessels.ts` | Boat and ship kinds: `BOAT_KINDS`, `SHIP_KINDS`, `vesselKind(id, kinds)` (a stable hash of the id) and the stand-in ids. |
| `terrain.ts` | Isle layout, noise heights, surface kinds, cliff strata. |
| `noise.ts` | Seeded 2D simplex noise and FBM. |
| `bridges.ts` | Bridges between Isles. |
| `paths.ts` | The Dock-to-House path and its stairs. |
| `biomes.ts` | The four Biomes' OKLCH colours and relief ranges. |
| `prng.ts` | Seed hashing and the PRNG. |
| `types.ts` | The World data types. |

## Seed

- A Seed is a short string. An empty Seed, or one longer than 32 characters,
  falls back to the default Seed (`site.defaultSeed`). `World.seed` is the
  Seed actually used.
- The Seed string is hashed (FNV-1a) to drive the PRNG (mulberry32).

## World data

All plain, serialisable data (`types.ts`). Grid coordinates are whole
terrain voxels (1 unit): x runs east, z south, y is height (0 = sea).

| Field | Meaning |
|---|---|
| `seed` | The Seed used (after fallback). |
| `attempts` | How many layouts were tried; 1 means the first one kept every rule. |
| `biome` | The Biome: `id` and one OKLCH colour (`{ l, c, h }`) per role (sand, grass, peak, foliage, soil, rock, rockDark, path, bridge, waterShallow, waterDeep, accent). |
| `terrain` | Row-major grid (`i = z * width + x`): `heights[i]` is the land top in whole voxels (0 = sea); `isle[i]` is the owning Isle id, or -1 for sea; `surface[i]` is the top voxel's kind (`sea`, `sand`, `grass`, `peak`). |
| `strata` | Cliff layering: `strata[y]` is the layer (`soil`, `rock`, `rockDark`) of every buried voxel at height `y`. |
| `isles` | One entry per Isle: id, inclusive cell bounds, cell count, and the `radius` it was shaped from (see "How a World is generated"). |
| `bridges` | Straight bridges over the sea: `from` and `to` Isle ids, the sea `cells` spanned (in order from `from`), and the deck height `y`, which equals the land height at both ends. |
| `paths` | Walkable paths between Landmarks. For now one: Dock to House, as 4-connected cells over land and bridges. |
| `stairs` | One per single-step height change along a path: the lower `cell`, its height `y`, and the `facing` the stairs climb towards. |
| `landmarks` | The five placed Landmarks: id, Isle, `footprint` (`origin` cell, `width` along x, `depth` along z, and every `cells` entry it covers), ground height `y` (the whole footprint is at this height), `variant` (its Landmark Variant, 1 to `LANDMARK_VARIANTS[biome][id]`; see "Landmark Variants"), `door` (House and Garden only, else null: `south` or `east`, the way the House's door or the Garden's gate faces; see "House plot" and "The Garden"), `flowers` and `trees` (Garden only: one cell per flower and per tree, in Garden order; see "The Garden") and `jetty` (Dock only: its sea cells, from the shore outwards). |
| `boats` | One per Client, up to 12 (`MAX_BOATS`), in Client order: the berth `cell` (a sea cell beside the jetty or off its tip; it may lie past the grid's edge, in the open sea), the `facing` its bow points, out to sea along the jetty, and its `kind` (1 to `BOAT_KINDS`, from its Client's id; see "Boat and ship kinds"). |
| `ships` | One per Partner, in Partner order: `cells`, a closed loop of sea cells (each an 8-neighbour of the one before, the last of the first) sailed in order, `phase` (0–1), how far round it the ship starts, and its `kind` (1 to `SHIP_KINDS`, from its Partner's id). Cells may lie past the grid's edge. |
| `buoys` | Up to 4 (`MAX_BUOYS`) sea cells, each with a buoy (its lamp glows at Night; see `rendering-and-shading.md`). Inside the grid, clear of the ships, boats, jetty and bridges. |
| `decoration` | Decoration, in placement order (row by row): each piece's `kind` (`DECORATION_KINDS`), land `cell` and `facing` (its structure is drawn facing south; see "Decoration"). |
| `views` | The two derived Landmarks, as camera views (`target`, `radius`): `overview` and `house-interior`. |

### Placed vs derived Landmarks

Seven Landmarks exist, but only five are places: Station, House, Garden,
Dock and Mailbox. The other two are views derived from the layout:

- **Overview** frames the World's bounds (the union of every Isle's footprint
  and the Dock's jetty), with a small margin.
- **House Interior** looks at the middle of the House (its 3×3, not its yard) from close up.

## How a World is generated

1. **Biome.** The default Seed always gets the brand Biome (`site.brandBiome`,
   currently tropical). Any other Seed picks one of the four Biomes from a
   hash of the Seed. The Biome is chosen once, before any retry, and sets the
   relief: how many steps an Isle's peak rises (tropical and autumn 2–4,
   northern 3–5, volcanic 4–6).
2. **Isles.** One to four (weighted towards two and three). The first sits at
   the origin; each next one sits beside an earlier one with a 4–7 cell sea
   gap. Fewer Isles are larger: the radius is 14–18 cells for one Isle,
   10–14 for two or three, and 9–12 for four (`ISLE_RADIUS` in
   `terrain.ts`; polish ticket 02 grew them about 1.5× to make room for
   Landmark Variants, the Garden and Decoration).
3. **Terrain.** Each Isle is a radial falloff (1 at the centre, 0 at its
   radius) pushed in and out by FBM simplex noise. A cell belongs to the
   Isle with the strongest field. Stray pieces of an Isle are dropped.
   Heights are `1 + floor(t × (peak + 1))`, where `t` is the falloff plus a
   little relief noise, so they come in whole 1-voxel steps.
4. **Surface.** Low shore cells are sand; the top cells of an Isle 4 or more
   voxels tall are peak; the rest is grass.
5. **Bridges.** Kruskal over Isle pairs, nearest first: for each pair not yet
   linked, the shortest straight run of sea (at most 12 cells) between two
   land cells of equal height, with open sea on both sides.
6. **Landmarks.** Each placed Landmark stands on a footprint of whole cells
   (see "Landmark footprints" below): the Station (2×2) on its Isle's high
   ground; the Garden, then the House's 4×4 plot on the Garden's Isle; the Dock
   (2×1 either way) on the shore with a jetty, preferring height 1; the
   Mailbox in the House's front yard. The Dock's jetty must have a berth for
   every boat (see "Boats" below).
7. **Path and stairs.** The cheapest route from a cell beside the Dock's
   footprint to the cell just outside the House's plot in line with its
   door (each at most one voxel above or below the Landmark; see "House
   plot") over land and bridges, never stepping more than one
   voxel up or down (two or more is a cliff) and never through a footprint;
   climbing costs extra, so paths prefer level ground. Every single-step
   change on the path gets stairs on its lower cell.
8. **Cliff strata.** The waterline layer is dark rock; above it, bands of soil
   and rock alternate, one or two voxels thick. All columns share them, so
   cliffs show the same layered cross-section all round the World.
9. **Ships.** One sailing route per Partner (see "Ships" below). No
   randomness: the loops follow from the layout, so they draw nothing from
   the PRNG.
10. **Decoration.** After everything else, each Biome places its own
    Decoration over the Isles (see "Decoration" below).

### Landmark footprints

`landmarks.ts` places the Landmarks in this order: Station, Garden, House,
Dock, Mailbox. Each tries the Isles in a Seed-shuffled order (the House
always takes the Garden's Isle), and on each Isle picks at random among the
footprints that keep every rule:

| Landmark | Footprint |
|---|---|
| Station | 2 × 2, containing a cell at its Isle's top height |
| House | 4 × 4: the House's plot (see "House plot") |
| Garden | 5 × 5: a 3 × 3 bed inside a fence one cell wide (below) |
| Dock | 2 × 1 or 1 × 2 on land, plus a jetty of 2–3 sea cells running straight out from one of its cells |
| Mailbox | 1 × 1, a cell of the House's plot (not placed on its own) |

- **Land of one Isle, at one height.** Every cell is land of the Isle. If
  the cells differ by at most 2 voxels, the generator levels the terrain
  under the footprint: down to its lowest cell, except the Station, which is
  levelled up to the Isle's top so it stays on the high ground. Surface
  kinds are recomputed afterwards.
- **No overlaps.** A footprint never covers a bridge cell or the land beside
  one (the bridge ends), and every placed footprint and jetty blocks its
  cells and a one-cell margin round them, so footprints keep a cell apart.
  A jetty stays off bridges too. The Dock-to-House path is routed after
  placement and never enters a footprint.
- **Never hidden by terrain or another Landmark.** The camera never rotates and looks along
  −(1, 1, 1) (true isometric). For each ground point of a candidate
  footprint (and jetty) on a ¼-cell grid, the generator follows the ray
  towards the camera, (1, 1, 1), and rejects the footprint if the ray enters
  a terrain column (or a bridge cell, treated as a column up to its deck,
  or a placed Landmark's model, below) below the column's top. Only columns on the diagonal band ahead of the
  point, up to the highest ground, are checked. Points above the ground (the
  model) are then visible too, because their rays run higher. The check uses
  the terrain as levelled for that footprint. Lowering ground never hides
  anything, and the Station (the only raise) is placed first, so a footprint
  checked once stays in view. The Garden's plants are inside its footprint,
  so they count as part of the Garden.
- **Never hidden by another Landmark.** Each placed Landmark's model counts
  as a column as tall as `LANDMARK_HEIGHT` allows over the cells it stands
  on: Station 6 units, House 4 (its plot's 3 × 3 only; the yard is ground),
  Garden 3.5, Dock 1 (over its jetty too), Mailbox 2 (its yard cell, set
  with the House). The Garden is three bands (`GARDEN_HEIGHT`): its fence
  ring 1, the flowers' two rows 1.75 and the trees' row 3.5, whether or
  not a plant stands there. The heights leave room for the polish models (a Station
  of 5–6, Garden trees of 3–3.5); `landmarkModels.test.ts` and the
  structure data tests check that no model is taller. A candidate must be in view past the models already
  placed, and its own model must hide none of them (the same ray march,
  skipped when the model lies wholly west or north of a Landmark, since
  rays run towards +x and +z). The Mailbox, in the House's own yard, is
  not an occluder of its House.
- **The Garden** (polish ticket 05). Always 5 × 5, whatever the content: a
  3 × 3 bed (local cells 1–3) inside a fence one cell wide. The camera
  looks from the south-east, so the bed's back row is its north row (local
  z = 1) and its front two rows are z = 3 and z = 2. `gardenCounts(projects,
  pinned)`: the first `MAX_FLOWERS` (6) Pinned Projects bloom as flowers;
  the Pinned Projects after them, then the other Projects, grow as trees,
  up to `MAX_TREES` (3). So the Garden shows at most 9 Projects, Pinned
  Projects take places first, and other Projects never take an empty
  flower cell (it stays grass). Flower `k` takes `GARDEN_BED.flowers[k]`
  (the front row west to east, then the second row), tree `k`
  `GARDEN_BED.trees[k]` (west to east), so a plant keeps its place as
  Projects are added. The fence's gate faces the House: south or east (the
  sides the camera sees), whichever the House lies further towards from
  the Garden's middle (`door`). There is no path to the gate.

### House plot

The House stands on a 4 × 4 plot (`HOUSE_PLOT`): the House itself fills
its north-west 3 × 3 (`HOUSE_CELLS`), and the other seven cells, along its
south and east sides (the two the camera sees), are its front yard.
`houseYard(house, door?)` names the cells:

- **The door** faces `south` or `east`: the Seed picks one, and if the
  path from the Dock cannot reach it, `generateWorld` turns it the other
  way (and retries the layout if neither works). The door is in the middle
  of the House's front wall, so `door` is the yard cell in front of it
  (column 1 of the plot) and `approach` the cell just outside the plot in
  line with it, where the path from the Dock ends. The renderer paints the
  `door` cell as path too, so the path runs on to the door.
- **The Mailbox** stands in the yard's south-east corner (`mailbox`,
  whichever way the door faces), on the plot's ground: a `PlacedLandmark`
  with that one cell as its footprint and the House's height, so it keeps
  its own hotspot and Data Card but has no ground of its own. The camera
  looks along −(1, 1, 1), so the corner never hides the door.

### Boats

Boats moored are `min(clients, 12)`, one per Client in Client order. Their
berths are sea cells within 2 cells (Chebyshev) of the jetty: beside it or
off its tip. They are taken nearest first (the ring of cells touching the
jetty before the ring beyond it), then from the shore outwards, then the
nearer side before the farther; a cell past the grid's edge counts as sea.
A berth is never a bridge cell or beside one, and it must be in plain view
at sea level: the same ray check as footprints, with the Dock levelled and
its jetty a deck at the Dock's height. Every boat faces the way the jetty
runs, bow out to sea.

A Dock candidate is kept only if it has a berth for every boat, so the
boats are part of choosing the Dock. Nothing placed after the Dock goes to
sea, so berths never clash with a later Landmark. Each Client keeps the
same kind of boat in every World (see "Boat and ship kinds").

### Ships

`ships.ts` gives every Partner a closed loop through open sea: sea cells at
least 2 cells (Chebyshev) from land, bridges, the jetty and the boats, over
a chart that runs 6 cells past the grid's edge. A loop sails round a
**body**: a centre cell on solid ground and an axis through it.

- **Bodies.** Each bridge with at least 3 sea cells is a body: its middle
  cell, along the bridge. With none (one Isle, or only short bridges), the
  body is all the land: the land cell nearest the middle of the Isles'
  bounds, along x.
- **A loop.** From the centre, walk across the axis both ways to the first
  open water joined to the open sea (never a closed-off bay): `a` and `b`.
  Sail the shortest way from `a` to `b` (8-connected; a diagonal step needs
  both cells beside it open) with a wall along the axis past one end, then
  back from `b` to `a` with a wall past the other end, so the two halves go
  round opposite ends. Any spur where the halves share cells (a waypoint in
  a dead-end strait) is cut out, keeping the longer arc.
- **Between Isles.** A bridge's `a` and `b` lie in the strait on either side
  of it, so its loop sails through both straits between the two Isles it
  links. Since bridges link every Isle, every loop also goes round all the
  land. With one Isle the loop goes round it. Where a strait is too tight
  (under 5 cells of clear water), `a` and `b` fall outside it and the ship
  sails round instead: about 1 in 15 Worlds with a bridge of 5+ cells.
- **Lanes.** Partner `k` takes body `k mod bodies`. The first round of
  Partners sails at clearance 2; the next round takes a wider loop
  (clearance 3) the other way round; later rounds share those loops.
  Ships on the same loop start evenly spread round it (`phase` = j / n).
- **Fallbacks.** If a body's loop fails, the generator tries clearance 2,
  then the all-land body, then a ring just inside the chart's edge, which is
  always open. In 2,000 sampled Seeds the ring is never needed.

### Boat and ship kinds

Polish ticket 06. A boat's kind is its Client's, a ship's its Partner's:
`vesselKind(id, kinds)` is `1 + hash(id) mod kinds` (`vessels.ts`: the
Seed's FNV-1a hash with a fixed salt), so it never depends on the Seed, the
Biome, the place in the list or the other Clients. Boat `i` takes
`clientIds[i]`, ship `i` `partnerIds[i]`. There are `BOAT_KINDS` (3) boat
kinds and `SHIP_KINDS` (3) ship kinds; the World's Biome only picks the
style (the structure `boat/<biome>-<kind>` or `ship/<biome>-<kind>`; see
`voxel-structures.md`). Kinds are added after the layout, so they never move
it. The salt was picked so the three mock Partners get three different
ships; any hash may make two Clients share a kind.

### Decoration

Polish ticket 08 (`decoration.ts`). Scenery that stands for nothing and
cannot be clicked: `World.decoration` lists pieces, each a kind
(`DECORATION_KINDS`: `grass`, `clump` (a flower clump), `rocks`, `bush`,
`sapling` (a small tree, a smaller species than the Garden's), and the
minor buildings `fence`, `lamp`, `shed`, `windmill`), a land cell and a
facing. The renderer draws each kind in the World's Biome's style
(`voxel-structures.md`, "Decoration").

`placeDecoration` runs on the finished layout and draws from a sequence
of the Seed's own (`<seed>/decoration`), so it never moves the layout and
the same layout always gets the same Decoration. It visits every cell row
by row; a land cell may take a piece with the Biome's density (tropical and
autumn 22%, northern 17%, volcanic 14%), then picks a kind by the Biome's
weights among the kinds that fit there. A piece:

- never stands on or beside (8-neighbour) a footprint or the Dock's jetty,
  so the Garden and the House's yard stay clear and nothing crowds a
  Landmark; never on a path or on the land at a bridge's end;
- is never taller than the nearest Landmark: `DECORATION_HEIGHT[kind]`
  (grass, clump and rocks 0.5 units, bush 0.75, fence 1, sapling, lamp and
  shed 2, windmill 2.5) is at most `LANDMARK_MIN_HEIGHT` of the Landmark
  nearest the cell (Station 5.5, House 4, Garden 1 (its fence), Dock 0.875,
  Mailbox 1.25: each Landmark's lowest Variant; the lowest of several as
  near). So only grass, clumps, rocks and bushes stand by the Dock or the
  Garden;
- never stands between the camera and a Landmark: every Landmark's ground
  points (the ¼-cell grid of its footprint and jetty) cast the same sight
  line as Landmark placement (`sightline.ts`, `forEachRayColumn`), and a
  cell's piece must stay below the lowest sight line through it;
- if a minor building, faces the camera (south or east), keeps 3 cells
  from other minor buildings, and the World holds at most 5 fences, 4
  lamps, 2 sheds and 1 windmill. Plants and rocks face any way.

Over `seed-0`–`seed-399` (8 Projects) a World gets 46–369 pieces, 181 on
average; placing it takes under 1 ms (at most about 3). The reduced render
tier draws every other piece (`rendering-and-shading.md`).

### Buoys

`buoys.ts` sets out up to 4 buoys after the ships, from the layout alone
(no randomness, so the theme or anything else never moves them). A
candidate is a sea cell inside the grid, 1–4 cells (Chebyshev) off the
land, at least 2 cells from every cell a ship sails through (as ships keep
from the boats) and from the jetty, the boats and the bridges, with its
lamp (1 unit up, mid-cell) in plain view of the isometric camera (the same
ray march as for footprints, with bridge decks and the jetty). The
candidates nearest the jetty's tip are taken first (ties north to south,
then west to east), each at least 4 cells from the ones already taken, so
the buoys lead the way to the Dock. Every one of 200 sampled Worlds gets 4.

### Retry

If a rule fails (two Isles touch, an Isle is under 30 cells, an Isle cannot
be bridged, a Landmark has no valid footprint, or there is no path), the
layout is redone from a Seed derived from the given one (`<seed>#retry<n>`).
After 8 noise layouts comes the safe layout: one round Isle of radius 14
(the smallest lone Isle; 10, then 12 before polish ticket 02) with no noise and at most 2 terrace steps, flat enough that every footprint,
the 5 × 5 Garden included, fits in view. So
retry always ends, in at most 9 attempts, and the same input always gives
the same World.

Measured over Seeds `seed-0` to `seed-999` (polish ticket 02, before →
after the larger Isles and the Landmark-on-Landmark check):

| Content | Retried | Safe layout | Mean | 95th percentile | Worst |
|---|---|---|---|---|---|
| 6 Projects, 6 or 12 Clients, 3 Partners | 56% → 24% | 1.7% → 0 | 9 → 16 ms | 17 → 26 ms | 54 → 70 ms |
| 24 Projects, 12 Clients, 6 Partners | 74% → 33% | 13% → 0 | 16 → 29 ms | 32 → 58 ms | 58 → 154 ms |

Polish ticket 05 fixed the Garden at 5 × 5 (it was 3 × 3 for up to 6
Projects, up to 6 × 5 for 24) and gave it three height bands. Measured
over Seeds `seed-0` to `seed-399` on one machine (before → after; the
numbers above came from another run, so compare within a row):

| Content | Retried | Safe layout | Mean | Worst |
|---|---|---|---|---|
| 8 Projects, 6 Clients, 4 Partners | 29% → 30.5% | 0 → 1 (`seed-30`) | 19 → 26 ms | 70 → 102 ms |
| 24 Projects, 12 Clients, 6 Partners | 35.5% → 30.5% | 0 → 1 (`seed-30`) | 33 → 27 ms | 132 → 103 ms |

The Garden's size no longer depends on the Projects, so both rows now give
the same layouts.

Larger Isles leave more room, so far fewer layouts fail; most retries now
come from bridges (no straight, level run of at most 12 cells between two
Isles) and then from Landmarks with no footprint in view. Each World costs
more: the grid is about twice the area, and the reverse occlusion check
marches rays for every placed Landmark.

### Biome colours

Each Biome colour is a swatch from one of the Lospec palettes named in the
design record (late night bath, Cryptic Ocean, Punolite Plus Remake,
Aquaverse), converted to OKLCH with L and h kept and chroma clamped to at
most 0.10 (lower where a swatch read too loud). `biomes.ts` names the source
swatch next to each colour. The House, brand and UI colours do not come from
the Biome.

## Landmark Variants

Each placed Landmark carries a `variant`: which of its Biome's Variants it
shows (polish ticket 03). `LANDMARK_VARIANTS` (`landmarks.ts`) says how
many each Landmark has per Biome: the House 3, the Station 2, the Mailbox 3,
the Dock 2 and the Garden 1 (its fence; its flowers and trees are
structures of their own, `voxel-structures.md`). The renderer draws
the structure file of that kind, Biome and number
(`voxel-structures.md`, "The Landmark Variants"); a data test holds the
files to the table.

`pickVariants` draws them after the layout, from a sequence of the Seed's
own (`<seed>/variants`), one number per Landmark in `PLACED_LANDMARK_IDS`
order. So the same Seed always gives the same Variants, whatever the
content counts or how many retries the layout took, and the pick never
moves the layout (every Seed kept its polish 02 layout). The generator's
height rule (`LANDMARK_HEIGHT`) holds for every Variant, so the pick needs
no new placement check.

Tests (`generateWorld.test.ts`): over 200 sampled Seeds each Landmark's
Variant is a whole number from 1 to its Biome's count, and every Variant of
every Biome occurs; the House, Station, Mailbox and Dock have 2–3 each; and
the same 200 Seeds keep their Variants with the largest content counts.

## Not yet built

Later tickets: Data Card anchors. The site passes the sizes
of the `projects`, `clients` and `partners` collections, how many Projects
are pinned, and the Clients' and Partners' ids (for the boat and ship
kinds); it pairs flower `k` with the `k`-th Pinned Project by id and tree
`k` with the next Projects in Garden order (`site/src/lib/gardenPlants.ts`;
see `content-model.md`); the generator never sees Project ids.

## Tests

The suite calls only `generateWorld` and checks properties over 200 sampled
Seeds, never snapshots:

- determinism (every sampled Seed), different Seeds differ, no `Math.random`;
- each placed Landmark exactly once; both derived views, House Interior at
  the middle of the House's 3×3; every Isle and every covered cell inside the Overview;
- footprints: rectangles of the right size, on flat land of the named Isle
  at the Landmark's height, never overlapping each other (but the Mailbox,
  which stands on the House's plot), a bridge, a bridge end or the path; out of the sea except the Dock's 2–3 cell straight jetty;
  the Garden is 5 × 5 with its gate south or east (both seen), and holds
  `min(pinned, 6)` flowers in its bed's front two rows and at most 3 trees
  in its back row, at most `min(projects, 9)` plants, each plant keeping
  its cell as Projects are added (0 Projects and every Project pinned
  included); no ground point of any footprint or jetty (¼-cell
  grid) is hidden from the isometric camera by terrain or a bridge (an
  independent ray march in the test), nor by another Landmark's model at
  its `LANDMARK_HEIGHT` (the Garden in its three bands; the Mailbox
  excepted for its own House);
- 1–4 Isles, with every count seen; each Isle's radius in its range for
  the count (14–18, 10–14, 9–12) and the Isle at least that wide; whole-step heights, sea at 0, mostly
  three or more land heights; sea all round; each Isle one connected piece
  matching its bounds and cell count;
- bridges link every Isle, each a straight run of sea between level ends on
  the Isles it names;
- House and Garden share an Isle, the Dock's footprint has sea beside it,
  the Station is at its Isle's top height;
- the House's plot is 4 × 4 with its door south or east (both seen), every
  other Landmark's `door` null; the Mailbox in the plot's south-east
  corner at the House's height;
- one walkable path from beside the Dock to the cell in line with the House's door; stairs exactly at its single-step changes,
  climbing the right way;
- a stratum for every buried voxel height, in at least two bands when tall;
- Biome in the set, every Biome seen, every Biome colour chroma ≤ 0.10, the
  default Seed gets the brand Biome, empty and 33-character Seeds fall back;
- retry happens for some Seeds, stays deterministic and stops within 9
  attempts; each World generates in under 250 ms; counts of 0 and 500;
- boats: `min(clients, 12)` for 0, 1, 5, 12, 13 and 500 Clients; each in its
  own sea cell within 2 cells of the jetty, never on the jetty or a bridge,
  bow out along the jetty, in plain view at sea level (the ray march, with
  the jetty as a deck) and inside the Overview;
- ships: one per Partner for 0, 1, 3, 7 and 500; each a closed loop of
  distinct cells, 8-neighbour steps, at least 2 cells from land, bridges,
  the jetty and boats; every loop encloses all the land (so with one Isle it
  sails round it; checked on one cell per Isle, since a loop clear of land
  that goes round one cell of a connected Isle goes round all of it); over 80% of Worlds with a bridge of 5+ cells sail
  through a strait between two Isles; ships sharing a loop start at
  different phases;
- boat and ship kinds: the same ids give the same kinds over 60 Seeds
  covering every Biome; a Client keeps its kind when others leave; every
  kind is used over 40 ids; kinds stay in range without ids;
- buoys: at most 4, at sea inside the grid, 1–4 cells off the land, at
  least 2 cells from ship cells, the jetty, boats and bridges, 4 apart, the
  lamp in plain view (the ray march); over 90% of Worlds get two or more.
- Decoration: more than 5 pieces in every sampled World and every kind in
  every Biome; one piece a cell, on land, at least 2 cells (Chebyshev) from
  every footprint and jetty cell (so never in the Garden), never on a path
  or a bridge end; never taller than the nearest Landmark's
  `LANDMARK_MIN_HEIGHT`; no Landmark ground point hidden by a piece's
  column (an independent ray march); minor buildings face south or east,
  3 cells apart;

```sh
cd site && bun run test
```
