# 03: Landmark Variants for every Biome

**What to build:** Every Landmark has its own style in each Biome and 2–3 Variants within that style, and the Seed picks one.

**Blocked by:** 01 (House look approved), 02

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] House, Station, Mailbox and Dock each have one style per Biome and 2–3 Variants per style, as ASCII structures.
- [x] Each Variant fills its footprint at ⅛ unit (House 3×3 in its 4×4 plot, Station 2×2 at the centre of its group, Mailbox in the House's yard, Dock 2×1 plus jetty), and doors face the path. The Dock's deck and jetty stay ¼ unit.
- [x] Every House Variant in a Biome has a liftable roof and the same interior space.
- [x] The generator picks a Variant per Landmark from the Seed. The same Seed gives the same Variants, and Variants always come from the World's Biome. This is tested through `generateWorld` over hundreds of Seeds.
- [x] Data tests cover every new structure.
- [x] The Model Gallery shows all Variants, and screenshots are attached to the report.
- [x] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked; the look of the new models was not reviewed by the user and is logged in `docs/todo.md` ("Polish 03: Landmark Variant look").

- Variants: House 3, Station 2, Mailbox 3, Dock 2 per Biome, 40 structure files in `site/src/structures/<kind>/<biome>-<n>.structure` (36 new). House Variants 2 and 3 keep Variant 1's walls and interior box and change the roof (hip, gable either way), chimney and porch, so every House in a Biome has the same liftable lid split and interior space. Drawn with throwaway generator scripts, committed as plain ASCII.
- Sizes: Station 16×16, 45–48 layers (5.6–6 units), door 4×10 on +z; Mailbox 1×1 cell, box at most 6 across, 10 layers (1.25 units); Dock things 16×8 on the ¼-unit deck (anchor `0 -2 0`), at most 1 unit up. All within `LANDMARK_HEIGHT`.
- Pick: `LANDMARK_VARIANTS` in `world/landmarks.ts`; `generateWorld` picks from a sequence of the Seed's own, so layouts did not change and content counts never change a Variant. Tested over 200 Seeds through `generateWorld` (Variants from the Biome's set, every Variant seen, the same Variants at other content counts).
- Rendering: the Station, the Mailbox and the Dock's things moved from code-built ¼ unit into the ⅛-unit structure grid (`drawStructures`); `landmarkExtent` and `dataCardAnchors` now take the World, since the box depends on the Variant. The Mailbox faces the House's door; a 1×2 Dock is the 2×1 file mirrored.
- Browser (dev server, Chromium with SwiftShader): `harbour` (tropical), `seed-2` (northern), `lanternfish` (autumn), `42` (volcanic) and `lighthouse` at 1440×900 and 390×844 (touch), on `/`, `/services`, `/about`, `/dock` and `/contact`: no console errors (only the dev-only 404s for the World stills). `data-triangles` rose about 1,000 per World (see `rendering-and-shading.md`, Triangle budget). `bun run build` passes.
- Screenshots: `.scratch/voxel-world-polish/screenshots/03-*.png` (Gallery: each kind, House lids lifted; the World on desktop and phone, and close-ups of the Station, the Dock and the Mailbox).
- Not done: the Garden keeps one Variant until ticket 05. The Gallery now draws a plank deck under the Dock's things.
