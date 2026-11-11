# 05: Garden with Pinned Project flowers and Biome trees

**What to build:** Pinned Projects bloom as large flowers at the front of the Garden, other Projects grow as the Biome's trees with gaps between them, and the Garden holds no decorative flowers.

**Blocked by:** 01, 02

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] The `projects` schema gains an optional `pinned` flag, and a few mock Projects are pinned.
- [x] The Garden is a fixed 3×3 bed inside a one-cell fence (5×5 in all) with a gate on the path side.
- [x] The first six Pinned Projects by id bloom as flowers in the front two rows (3×2 as the camera sees it). Other Projects, and Pinned Projects beyond six, grow as trees in the back row (3×1).
- [x] One plant per cell: at most 9 Projects in the Garden, and Pinned Projects take places first.
- [x] Settle with the user first: may other Projects take empty flower cells when fewer than six are pinned? _Not settled: the user was away; assumed no (flower cells stay grass), logged in `docs/todo.md`._
- [x] Trees and flowers are ASCII structures per Biome. At ⅛ unit, each canopy is 6×6 in an 8×8 cell, so each plant reads separately. The fence is an ASCII structure too.
- [x] Trees and flowers are drawn with `InstancedMesh`.
- [x] There is no Decoration inside the Garden. An empty Garden is a grass patch.
- [x] Clicking a flower or tree opens its Project. Click targets do not overlap, and the tap size on phones is checked.
- [x] `/garden` lists Pinned Projects first, and every Project, including those beyond the cap, is listed.
- [x] Tests:
  - flower count is min(pinned, 6)
  - trees are at most 3, and flowers plus trees at most min(Projects, 9)
  - 0 Projects is handled
  - all Projects pinned is handled
- [x] The real page is checked in a browser at desktop and phone sizes on several Seeds and Biomes, with no console errors. Gallery screenshots are attached.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked. The open question was not settled with the user: other Projects never take an empty flower cell (they stay grass), logged in `docs/todo.md` ("Polish 05: open question in the ticket"), with the look ("Polish 05: Garden look") and the layout decisions ("Polish 05: Garden layout").

- Content: `projects` gains an optional `pinned` flag; `archive-search`, `mill-sensors` and `tide-forecasting` are pinned. `/garden` and the sitemap list Projects in Garden order (Pinned Projects first, each by id), every Project included (`lib/gardenPlants.ts`, which replaces `gardenTrees.ts`).
- World: the Garden is always 5×5 (`GARDEN_SIZE`), a 3×3 bed in a fence; `gardenCounts` gives min(pinned, 6) flowers in the front two rows (`GARDEN_BED`) and up to 3 trees in the back row, Pinned Projects beyond six first; `PlacedLandmark` gains `flowers`, and the Garden's `door` is its gate (south or east, towards the House). Placement treats the Garden as three height bands (`GARDEN_HEIGHT`).
- Structures: per Biome a fence (`garden/<biome>-1`, the Garden's Landmark Variant), a tree (`tree/<biome>-1`, crown 6×6, 25–27 voxels) and two flowers (`flower/<biome>-1`, `-2`, 6×6, 12–13 voxels), drawn with a throwaway script and committed as ASCII; new roles for stems, petals, pollen and autumn leaves.
- Rendering: the fence goes into the structure grid; trees and flowers are one `InstancedMesh` per structure (`render/garden.ts`, `render/gardenPlants.ts`). The ¼-unit Garden is gone. Plant links (`a.hotspot.plant`) are sized by `plantLinkSize` so none covers another (tested for a full Garden in every Biome); the stats overlay counts `plants`.
- Tests: `generateWorld.test.ts` (5×5 and gate; flower count min(pinned, 6), trees at most 3, plants at most min(Projects, 9), 0 Projects, every Project pinned; plants keep their cells), `lib/gardenPlants.test.ts`, `structures.test.ts` (fence, trees, flowers), `render/gardenPlants.test.ts`, `plantLinks.test.ts`, `landmarkModels.test.ts`, `voxelCounts.test.ts`. 324 tests pass, `bun run check` 0 errors, `bun run build` passes.
- Browser (Chromium, SwiftShader): `/garden` on `lighthouse`, `harbour`, `7` (tropical), `seed-2` (northern), `lanternfish` (autumn), `42` (volcanic) at 1440×900 and 390×844 (touch), Day and Night: plants show, no plant links overlap, no console errors on the built site (the dev server gives only its usual 404s for the World stills). The running dev server on :4321 has a stale structure plugin (new roles), so `/dev/models` answered 500 there; the Gallery was checked on a temporary build instead. Restart the dev server with `astro dev --force`.
- Tap size: flowers' links are 47×53 px and trees' 47×133 px on desktop, but 13×15 and 13×37 px on a phone at `/garden`; logged under "Known issues not yet fixed".
- Screenshots: `.scratch/voxel-world-polish/screenshots/05-*.png` (the Gallery's Gardens Day, Night and phone, trees and flowers; `/garden` per Biome on desktop and phone, Day and Night).
- Not done: no path to the gate (it faces the House); one Seed (`seed-30`) now reaches the safe layout; see `docs/todo.md`.
