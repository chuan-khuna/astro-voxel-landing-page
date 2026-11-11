# 02: Bigger Isles

**What to build:** Isles are about 1.5× wider, so there is room for Landmark Variants, a full Garden and Decoration.

**Blocked by:** 01

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] Isle radii are 14–18 for one Isle, 10–14 for two or three, and 9–12 for four.
- [x] All existing placement, footprint and never-hidden-by-terrain rules still hold over hundreds of Seeds, tested through `generateWorld` only.
- [x] Camera bounds and the Overview framing follow the larger World.
- [x] Generation time and retry rate are measured and reported (before vs after).
- [x] The real page is checked in a browser at desktop and phone sizes on several Seeds, with no console errors.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

- Radii come from `ISLE_RADIUS` in `site/src/world/terrain.ts`; each Isle now carries its `radius` in the World data. The safe layout's Isle is radius 14.
- Landmark-on-Landmark occlusion was added here, as `docs/todo.md` suggested: every Landmark's model counts as a column of `LANDMARK_HEIGHT` (Station 6, House 4, Garden 3.5, Dock 1, Mailbox 2 units), and `landmarkModels.test.ts` checks that no model is taller.
- Camera bounds and the Overview needed no code change: both already follow the Isles' bounds. A test now checks that every Isle lies inside the Overview.
- Measured over `seed-0` to `seed-999` (before → after): with the site's content, retries 56% → 24%, safe layout 1.7% → 0, mean 9 → 16 ms, worst 54 → 70 ms; with 24 Projects, 12 Clients and 6 Partners, retries 74% → 33%, safe layout 13% → 0, mean 16 → 29 ms, worst 58 → 154 ms. Sizes are in `README.md`.
- Browser check (dev server, Chromium with SwiftShader): `lighthouse`, `lanternfish`, `42`, `harbour`, `694157692` and `seed-7` at 1440×900 and 390×844. No script errors; the only console errors are 404s for `/stills/world-*-1600.webp`, which exist only after a build. Screenshots: `.scratch/voxel-world-polish/screenshots/02-*.png`.
