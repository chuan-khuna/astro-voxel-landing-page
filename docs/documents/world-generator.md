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

- **pure**: no three.js, no DOM, no I/O, so it can move into a Web Worker later;
- **deterministic**: the same Seed and counts give a deep-equal World. Every
  random choice comes from one seeded PRNG (`prng.ts`: FNV-1a hash of the Seed
  string, then mulberry32). `Math.random` is never used, and a test fails if it is.

`index.ts` also exports the Landmark id lists (`PLACED_LANDMARK_IDS`,
`VIEW_LANDMARK_IDS`, `LANDMARK_IDS`). The site data module and the `pages`
collection schema type their Landmark ids against these, so a typo is a type
or build error.

## World data

All plain, serialisable data (`types.ts`). Grid coordinates are whole
terrain voxels (1 unit): x runs east, z south, y is height (0 = sea).

| Field | Meaning |
|---|---|
| `seed` | The Seed the World was generated from. |
| `terrain` | Row-major grid (`i = z * width + x`): `heights[i]` is the land top in voxels (0 = sea); `isle[i]` is the owning Isle id, or -1 for sea. |
| `isles` | One entry per Isle: id, inclusive cell bounds, cell count. |
| `landmarks` | The five placed Landmarks: id, Isle, cell, ground height `y`, `variant` (always 0 for now). |
| `views` | The two derived Landmarks, as camera views (`target`, `radius`): `overview` and `house-interior`. |

### Placed vs derived Landmarks

Seven Landmarks exist, but only five are places: Station, House, Garden,
Dock and Mailbox. The other two are views derived from the layout:

- **Overview** frames the World's bounds (the union of every Isle's footprint),
  with a small margin.
- **House Interior** looks at the House's cell from close up.

## Current behaviour (ticket 02, tracer bullet)

- One flat Isle, 14–20 cells a side, with its corners rounded off, at height 1.
  A 4-cell sea margin surrounds it.
- Landmarks sit at least 3 cells apart (Chebyshev distance). The Dock goes on
  a shoreline cell; the others go inland.
- `ContentCounts` is accepted but not used yet.

Not yet built (later tickets): noise terrain, 1–4 Isles, bridges, paths,
stairs and cliffs, Biomes, placement rules beyond the Dock, retry, Seed
fallback, trees, boats, ships, decoration, Data Card anchors, House Interior
room layout, and the Web Worker.

## Tests

The suite calls only `generateWorld` and checks properties, never snapshots:
determinism, different Seeds differ, no `Math.random`, each placed Landmark
exactly once over 200 sampled Seeds, Landmarks on land and never stacked,
both derived views defined (House Interior at the House, Overview framing
every Landmark), one flat Isle surrounded by sea, and counts of 0 and 500.

```sh
cd site && bun run test
```
