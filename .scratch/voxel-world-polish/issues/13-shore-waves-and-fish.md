# 13: Shore waves, fish and glowing surf

**What to build:** Foam runs in and breaks along every coast. Schools of fish swim in the shallows and sometimes leap. At Night the surf glows faintly.

**Blocked by:** 07, 09

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [x] Shore foam is white ⅛-unit voxels that run in towards the coast, break along the Isle's edge and draw back. It is computed in the shader from the water's distance-from-coast data, with no per-frame CPU work.
- [x] Waves never break over the Dock's jetty or under moored boats in a way that looks wrong.
- [x] Fish are ⅛-unit ASCII structures, one species per Biome, drawn with `InstancedMesh`. Schools of 3–5 swim in the shallows and are seen through the translucent water. Now and then one leaps and splashes with ⅛-unit spray.
- [x] School areas are deterministic from the Seed through `generateWorld`, in shallow water only. The number of schools follows the tier.
- [x] At Night the foam dims and a faint bioluminescent glow shows where waves break. If Day/Night is not built yet, note this.
- [x] Nothing moves when the clock is frozen, and fish and foam are never click targets.
- [x] Data tests cover the fish structures. Tests through `generateWorld` cover school areas: deterministic, shallow water only.
- [x] The Model Gallery shows the fish, and screenshots are attached. The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [x] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.

## Comments

Built (polish 13):
- **Surf** in the sea's fragment shader (`site/src/render/seaMaterial.ts`, the sums in the pure `render/surf.ts`): each ⅛-unit square of a water voxel's top takes its distance from the coastline, bilinear between the voxel's four corner distances (new `coast` data from `seaModel`, from the same `coastDistance` as the water colour, now in `world/coast.ts`), and is foam when a hash of it (new each wave) falls under the wave's foam there: a crest running in from 2 units out over 55% of a 7 s wave, breaking thick along the edge, washing out to 0.85 units as it thins, a thin rim always lapping; waves arrive out of step along the coast. Foam keeps the soft-voxel seams at ⅛ unit and is nearly opaque. No CPU work; a frozen clock holds it.
- **Jetty and boats:** `seaModel`'s `calm` is 0 at every corner of the jetty's cells and the moored boats' cells, so no foam breaks under the deck or through a hull, fading across the next cell.
- **Night:** foam dims (`WorldTokens.foam`), and an unlit cyan glow (`surfGlow` × `surfGlowStrength` 0.8) washes where waves break, brightest on the foam squares, and every foam square glows a little. Day/Night was already built.
- **Fish:** one species per Biome, `site/src/structures/fish/<biome>-1.structure` (clownfish, herring, koi, a black fish with ember spots), one ⅛-unit voxel tall, 4 long, 3 wide. `generateWorld` places up to 6 schools (`World.fish`, `world/fish.ts`, from `<seed>/fish`) on 2×2-cell squares of sea within 2 cells of land, clear of (and a cell away from) the jetty and boats, off bridges, buoys and ships' loops, 3 units apart. `render/schools.ts` (pure) gives each school's 3–5 fish a loop, lanes, a wiggle and turns at leaping (once every 7–14 s a school, 0.45 units up), plus 3 spray drops out and 3 back in; `render/fish.ts` plays them in the vertex shader (one `InstancedMesh` of the species, one of spray cubes). The life tier shows its share of whole schools (`canvas.dataset.fish`). Never raycast, no shadow casting.
- Tests: `generateWorld.test.ts` ("Fish": deterministic, counts and sizes, shallow water only by an independent measure, clear of jetty/boats/bridges/buoys/ships, apart), `structures.test.ts` ("the fish"), `schools.test.ts`, `surf.test.ts`, `seaModel.test.ts` ("surf data"); e2e `ambient-life.spec.ts` checks the fish follow the life tier.
- Model Gallery: kind `fish`, on a patch of the Biome's water (`screenshots/13-gallery-*`). Checked in headless Chromium on `harbour`, `seed-1`, `seed-2`, `seed-3` (all four Biomes), desktop and phone, Day and Night, at the Overview and close-ups near a school, with recordings (`screenshots/13-*.png`, `*.webm`), no console errors.

Decisions and deviations (also in `docs/todo.md`):
- Foam is ⅛-unit squares on the water voxels' tops (with ⅛-unit seams), not raised cubes: cubes would cost more triangles than the sea and need CPU-side geometry.
- Fish are 4×3×1 voxels, not the README's 6×2×2: the shallows are 0.15 units deep, so anything taller breaks the surface, and 6-long fish piled up in a 2×2-cell school. README row updated.
- Fish give off some of their own colour (45% by Day, 10% at Night) so they read through the 70%-opaque shallows.
- Schools circle within their square rather than roam the coast.
- Test seams chosen without confirming with the user: `generateWorld`, the structure data tests, and the pure `schools.ts`, `surf.ts` and `seaModel` data.
