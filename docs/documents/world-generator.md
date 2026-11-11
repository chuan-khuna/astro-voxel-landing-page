# World generator

The World generator turns a Seed and content counts into World data. It is
the one piece of logic the tests target.

- Code: `site/src/world/`
- Tests: `site/src/world/generateWorld.test.ts` (Vitest)
- Decision: `docs/adr/0001-seed-generated-world.md`

## Interface

```ts
import { generateWorld, type ContentCounts, type World } from '../world';

const world: World = generateWorld(seed, { projects, clients, partners });
```

`generateWorld` is the single public function and the single test seam. It is:

- **pure**: no three.js, no DOM, no I/O. In the browser it runs in a Web
  Worker (`site/src/render/world.worker.ts`; see `rendering-and-shading.md`);
- **deterministic**: the same Seed and counts give a deep-equal World. Every
  random choice comes from one seeded PRNG (`prng.ts`: FNV-1a hash of the Seed
  string, then mulberry32). `Math.random` is never used, and a test fails if it is.

`index.ts` also exports the Landmark id lists (`PLACED_LANDMARK_IDS`,
`VIEW_LANDMARK_IDS`, `LANDMARK_IDS`), the Biome lists (`BIOME_IDS`,
`BIOME_COLOUR_ROLES`) and `MAX_SEED_LENGTH`. The site data module and the
`pages` collection schema type their Landmark ids against these, so a typo
is a type or build error.

The generator reads two values from the site data module (`src/data/site.ts`):
`defaultSeed` and `brandBiome`. That module is plain data with no Astro or DOM
imports, so the generator stays pure.

### Code layout

| File | What it does |
|---|---|
| `generateWorld.ts` | The public function: Seed fallback, Biome choice, the retry loop, the Dock-to-House route, derived views. |
| `landmarks.ts` | Landmark footprints: placement, levelling, the occlusion check and the Garden's tree layout. |
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
| `isles` | One entry per Isle: id, inclusive cell bounds, cell count. |
| `bridges` | Straight bridges over the sea: `from` and `to` Isle ids, the sea `cells` spanned (in order from `from`), and the deck height `y`, which equals the land height at both ends. |
| `paths` | Walkable paths between Landmarks. For now one: Dock to House, as 4-connected cells over land and bridges. |
| `stairs` | One per single-step height change along a path: the lower `cell`, its height `y`, and the `facing` the stairs climb towards. |
| `landmarks` | The five placed Landmarks: id, Isle, `footprint` (`origin` cell, `width` along x, `depth` along z, and every `cells` entry it covers), ground height `y` (the whole footprint is at this height), `variant` (always 0 for now), `trees` (Garden only: one cell per tree, in Project order) and `jetty` (Dock only: its sea cells, from the shore outwards). |
| `views` | The two derived Landmarks, as camera views (`target`, `radius`): `overview` and `house-interior`. |

### Placed vs derived Landmarks

Seven Landmarks exist, but only five are places: Station, House, Garden,
Dock and Mailbox. The other two are views derived from the layout:

- **Overview** frames the World's bounds (the union of every Isle's footprint
  and the Dock's jetty), with a small margin.
- **House Interior** looks at the middle of the House's footprint from close up.

## How a World is generated

1. **Biome.** The default Seed always gets the brand Biome (`site.brandBiome`,
   currently tropical). Any other Seed picks one of the four Biomes from a
   hash of the Seed. The Biome is chosen once, before any retry, and sets the
   relief: how many steps an Isle's peak rises (tropical and autumn 2–4,
   northern 3–5, volcanic 4–6).
2. **Isles.** One to four (weighted towards two and three). The first sits at
   the origin; each next one sits beside an earlier one with a 4–7 cell sea
   gap. Fewer Isles are larger.
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
   ground; the Garden, then the House (3×3) on the Garden's Isle; the Dock
   (2×1 either way) on the shore with a jetty, preferring height 1; the
   Mailbox (1×1) within 4 cells of the House if it can.
7. **Path and stairs.** The cheapest route from a cell beside the Dock's
   footprint to a cell beside the House's (each at most one voxel above or
   below the Landmark) over land and bridges, never stepping more than one
   voxel up or down (two or more is a cliff) and never through a footprint;
   climbing costs extra, so paths prefer level ground. Every single-step
   change on the path gets stairs on its lower cell.
8. **Cliff strata.** The waterline layer is dark rock; above it, bands of soil
   and rock alternate, one or two voxels thick. All columns share them, so
   cliffs show the same layered cross-section all round the World.

### Landmark footprints

`landmarks.ts` places the Landmarks in this order: Station, Garden, House,
Dock, Mailbox. Each tries the Isles in a Seed-shuffled order (the House
always takes the Garden's Isle), and on each Isle picks at random among the
footprints that keep every rule:

| Landmark | Footprint |
|---|---|
| Station | 2 × 2, containing a cell at its Isle's top height |
| House | 3 × 3 |
| Garden | at least 3 × 3, sized to its trees (below); either orientation |
| Dock | 2 × 1 or 1 × 2 on land, plus a jetty of 2–3 sea cells running straight out from one of its cells |
| Mailbox | 1 × 1 |

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
- **Never hidden by terrain.** The camera never rotates and looks along
  −(1, 1, 1) (true isometric). For each ground point of a candidate
  footprint (and jetty) on a ¼-cell grid, the generator follows the ray
  towards the camera, (1, 1, 1), and rejects the footprint if the ray enters
  a terrain column (or a bridge cell, treated as a column up to its deck)
  below the column's top. Only columns on the diagonal band ahead of the
  point, up to the highest ground, are checked. Points above the ground (the
  model) are then visible too, because their rays run higher. The check uses
  the terrain as levelled for that footprint. Lowering ground never hides
  anything, and the Station (the only raise) is placed first, so a footprint
  checked once stays in view. The Garden's trees are inside its footprint,
  so they count as part of the Garden. Landmarks do not count as occluders
  of each other.
- **The Garden.** Trees shown are `min(projects, 24)`. The layout is pairs of
  tree rows with a path row between them (local rows with `z mod 3 = 2` are
  paths), at least 3 × 3, the smallest area that fits the trees and still
  has room for a path, as square as it can be (sides differ by at most 2).
  Tree `k` fills the rows in order, so it keeps its place: 0–6 trees give
  3 × 3, 24 trees give 6 × 5.

### Retry

If a rule fails (two Isles touch, an Isle is under 30 cells, an Isle cannot
be bridged, a Landmark has no valid footprint, or there is no path), the
layout is redone from a Seed derived from the given one (`<seed>#retry<n>`).
After 8 noise layouts comes the safe layout: one round Isle of radius 10
with no noise and at most 2 terrace steps, flat enough that every footprint,
even a 24-tree Garden, fits in view (checked over 2,000 runs per Biome). So
retry always ends, in at most 9 attempts, and the same input always gives
the same World.

With up to 6 Projects, about 35 in 100 Seeds need a retry and the safe
layout is reached by about 1 Seed in 1,000; with 24 trees, about half need
a retry and about 1 in 70 reaches the safe layout. Generation takes about
2 ms on average (4 ms with 24 trees), under 25 ms at worst.

### Biome colours

Each Biome colour is a swatch from one of the Lospec palettes named in the
design record (late night bath, Cryptic Ocean, Punolite Plus Remake,
Aquaverse), converted to OKLCH with L and h kept and chroma clamped to at
most 0.10 (lower where a swatch read too loud). `biomes.ts` names the source
swatch next to each colour. The House, brand and UI colours do not come from
the Biome.

## Not yet built

Later tickets: boats, ships, decoration, Data Card anchors, House Interior
room layout, and Landmark variants beyond 0. Of `ContentCounts`, only
`projects` is used yet (the Garden's trees). The site passes the size of
the `projects` collection and pairs tree `k` with the `k`-th Project by id
(`site/src/lib/gardenTrees.ts`; see `site-project.md`); the generator never
sees ids. `MAX_TREES` (24) is exported from `index.ts` for the site.

## Tests

The suite calls only `generateWorld` and checks properties over 200 sampled
Seeds, never snapshots:

- determinism (every sampled Seed), different Seeds differ, no `Math.random`;
- each placed Landmark exactly once; both derived views, House Interior at
  the middle of the House's footprint; every covered cell inside the Overview;
- footprints: rectangles of the right size, on flat land of the named Isle
  at the Landmark's height, never overlapping each other, a bridge, a bridge
  end or the path; out of the sea except the Dock's 2–3 cell straight jetty;
  the Garden holds one cell per tree (capped at 24) plus room for paths and
  grows with the trees; no ground point of any footprint or jetty (¼-cell
  grid) is hidden from the isometric camera by terrain or a bridge (an
  independent ray march in the test);
- 1–4 Isles, with every count seen; whole-step heights, sea at 0, mostly
  three or more land heights; sea all round; each Isle one connected piece
  matching its bounds and cell count;
- bridges link every Isle, each a straight run of sea between level ends on
  the Isles it names;
- House and Garden share an Isle, the Dock's footprint has sea beside it,
  the Station is at its Isle's top height;
- one walkable path from beside the Dock to beside the House; stairs exactly at its single-step changes,
  climbing the right way;
- a stratum for every buried voxel height, in at least two bands when tall;
- Biome in the set, every Biome seen, every Biome colour chroma ≤ 0.10, the
  default Seed gets the brand Biome, empty and 33-character Seeds fall back;
- retry happens for some Seeds, stays deterministic and stops within 9
  attempts; each World generates in under 250 ms; counts of 0 and 500.

```sh
cd site && bun run test
```
