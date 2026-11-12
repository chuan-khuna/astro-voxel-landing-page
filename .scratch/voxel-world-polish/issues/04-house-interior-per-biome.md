# 04: House Interior per Biome

**What to build:** Clicking the House lifts the roof of whichever House Variant the World has, and shows a room furnished in the Biome's style, with the developer at a computer.

**Blocked by:** 03

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] The Interior is a scene of its own at 1/16 unit (ADR 0006): the roof lifts in the World, the camera dives in, and the Interior scene takes over. Leaving reverses it.
- [x] There are four interior rooms, one per Biome, as 1/16-unit ASCII structures. Examples: bamboo furniture in tropical, a fireplace in northern.
- [x] Each room fits the shared interior space of every House Variant in its Biome.
- [x] The roof of every House Variant lifts off, and the camera dives into the room.
- [x] Every room has the developer at a computer, and clicking the developer opens Team.
- [x] Data tests: each room fits its Biome's interior space, and each has a developer anchor.
- [x] The Model Gallery shows the rooms, and screenshots are attached to the report.
- [x] The real page is checked in a browser for all four Biomes, with no console errors, and with reduced motion on.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked; the rooms' look was not reviewed by the user and is logged in `docs/todo.md` ("Polish 04: House Interior look"), with the hand-over design ("Polish 04: how the Interior takes over").

- Rooms: `site/src/structures/room/<biome>-1.structure` (tropical bamboo room with a palm and surfboard; northern timber room with a stone hearth and fire; autumn study with a bookshelf, armchair and floor lamp; volcanic stone den with a lava lamp, glowing crystals and a brazier), and one seated developer, `developer/any-1.structure`, all at 1/16 unit (new `scale: 16` and `developer:` header fields; new parts `head`, `leftHand`, `rightHand`). Each room is 32×32×31 at the min corner of the interior box every House Variant of its Biome shares (32×36×32 at 1/16). Drawn with a throwaway generator script, committed as plain ASCII.
- World: the ¼-unit room (`houseModel.ts`) is gone; the World shows the furnished room coarsened to ⅛ unit in the structure grid while the lid lifts (`render/interiorModel.ts`).
- Interior scene: `render/interior.ts`, built per World: the House's shell and ground, the room at 1/16 unit, the developer's head and hands animated (they cast no shadow; the map is drawn once), the code screen, its own sun, sky light and, at Night, a warm light at the room's lamp or fire and lit back windows. `mountWorld` hands over to it once the lid is up and the camera at rest close on the House (`showsInterior`), through the World's own camera, and back when the House shuts, the visitor zooms out or pans away; the Guide moves with it; only the developer's link shows inside. Leaving: the World comes back first, then the lid comes down as the camera flies out.
- Tests: `structures.test.ts` (each room fits every House Variant's interior space in its Biome, has a developer anchor clear of the furniture and on a seat, a screen facing the developer, a lamp or fire), `parse.test.ts` (`scale`, `developer`), `interiorModel.test.ts` (furnished room, `coarsen`, the room's place in the World and its structure grid, `showsInterior`). 314 tests pass, `bun run check` 0 errors, `bun run build` passes.
- Browser (dev server, Chromium with SwiftShader): `/about` on `harbour` (tropical), `seed-2` (northern), `lanternfish` (autumn), `42` (volcanic) at 1440×900 Day and Night, and 390×844 (touch) with reduced motion on: the Interior takes over in all twelve, the developer's link sits over the developer, clicking it opens Team, leaving for Services hands back to the World with the lid coming down; the dive from the Overview goes World shut → lid moving → Interior; zooming out brings the World back with the House open; the Tour's Team stop shows the Interior with the Guide beside it. No console errors (only the dev-only 404s for the World stills). The Interior scene is about 3,500 triangles; the World's coarse room about 1,000–1,200.
- Screenshots: `.scratch/voxel-world-polish/screenshots/04-*.png` (each Biome on desktop Day and Night and on phone, the dive, zoomed out, Team, leaving, the Tour's Team stop, the Gallery's rooms Day, Night and phone, and the developer).
- Not done: no cross-fade at the hand-over (a cut; see `docs/todo.md`); the Gallery shows no warm lamp light at Night.

**2026-11-12, polish 17.** The Interior scene and its hand-over described above were replaced by ticket 17 (`17-house-interior-in-world.md`): the World draws the room and the developer at 1/16 unit itself while the lid is up or moving, and the ⅛-unit coarse room, `render/interior.ts`, `showsInterior` and `data-scene` are gone.
