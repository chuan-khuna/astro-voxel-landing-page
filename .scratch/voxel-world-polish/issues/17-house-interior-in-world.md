# 17: House Interior stays in the World

**What to build:** Opening the House shows the room in the World itself, with no switch to a separate Interior scene. The room and the developer look the same from the moment the lid starts to lift until it comes down again.

**Blocked by:** 04, 09 (ticket 09 reworks the render loop in `mountWorld.ts`)

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

## Why

The user's decision (2026-11-12): drop the hand-over to the Interior scene. When the House opens, the World first shows the room coarsened to ⅛ unit (`render/interiorModel.ts`). Then the 1/16-unit Interior scene (`render/interior.ts`) cuts in, so the developer and furniture visibly change texture partway through. Render the opening smoothly instead, in one scene.

## What to do

- [x] No scene switch: remove the Interior scene hand-over (`showsInterior`, the cut in `mountWorld.ts`, `data-scene`). The camera dives in and out of the House in the World, as for any other Landmark close-up.
- [x] Draw the room and the developer in the World at the room's own detail, 1/16 unit: the same structures from `site/src/structures/room/` and `developer/`, so what you see never changes resolution. Drop the ⅛-unit coarsened copy.
- [x] Show the room only while the lid is lifted or lifting, so a shut House costs no room triangles (ticket 04 added about 1,000–1,200 per World even with the House shut).
- [x] Keep what the Interior scene had, now in the World: the developer's head and hands typing, the code screen, the developer's link to Team, the Guide beside the House on the Tour's Team stop, and at Night a warm light at the room's lamp or fire, if it can be done cheaply (otherwise an unlit glow, and log it).
- [x] Reduced motion, a hidden tab and the phone tier behave as for the rest of the World.
- [x] Tests at the existing seams (`interiorModel.test.ts`, structure data tests) are updated; delete the tests for the removed hand-over.
- [x] Checked in a browser on `/about` for all four Biomes, Day and Night, desktop and phone, with reduced motion: opening and closing the House shows no change of texture or detail. Screenshots or a short frame sequence are attached (`.scratch/voxel-world-polish/screenshots/17-*.png`).
- [x] ADR 0006 is amended (the Interior is no longer its own scene), a record of the decision is written to `docs/records/2026-11-12-house-interior-in-world.md`, and the spec, README, `GLOSSARY.md` and `docs/documents/` (with INDEX) are updated. The `docs/todo.md` items this settles ("how the Interior takes over", the ADR's own-camera question, `data-scene`, the room's triangle cost) are ticked with a note.

## Comments

**2026-11-12, agent (user away).** Built and checked. Assumptions are logged in `docs/todo.md` ("Polish 17: House Interior in the World").

- **No scene switch.** `render/interior.ts` is deleted, with `showsInterior`, the cut in `mountWorld.ts`, `data-scene` (canvas and frame) and the CSS that hid the other hotspots inside. `coarsen` and `drawWorldRoom` are gone too: the World's structure grid holds only the House's base.
- **The room in the World** (`render/house.ts`): the furnished room at 1/16 unit from `structures/room/` and `developer/`, its still voxels as one mesh, the developer's head and hands one mesh each (no shadow), and the code screen, all in a `house-room` group shown only while the opening is above 0 (`setOpening`). The room's furniture casts into the World's shadow map, which is redrawn while the lid moves, so it is right on both sides of the show and hide. The screen scrolls on the shared clock's `time` uniform; `WorldObjects.step(seconds)` poses the developer (`house.work`), so reduced motion, a hidden tab, the still life tier and the phone's 30 fps apply as for the ships and the sea. The developer's link uses the new pure `developerBounds(world)`.
- **Night light:** done cheaply in the room's own material: `roomLamp` adds what a point light (intensity 6, reach 5 units, as in the old Interior scene) at the room's lamp or fire (`roomLight`) would give a diffuse surface, as an emissive term lit by Night (`setLights`). No light is added to the World's scene, so no other material pays. Only the room's own voxels (furniture, floor, developer) catch it, not the House's walls; the back windows glow as before.
- **Triangles:** the room is 2,116 (northern), 2,480 (autumn), 2,718 (volcanic) and 2,760 (tropical), drawn only while open (`data-room-triangles`, replacing `data-interior-triangles`); `data-triangles` no longer includes the ⅛-unit coarse room (about 1,000–1,200 less a World): `harbour` 64,110, `seed-2` 103,682, `lanternfish` 97,678, `42` 49,500 on desktop.
- **Tests:** `structureModels.test.ts` (the House's 3×3 in the structure grid holds only its base), `voxelCounts.test.ts` (House room counted at 1/16 unit, outside the grids), `interiorModel.test.ts` (removed `coarsen`, the structure-grid room and `showsInterior`; added `developerBounds`). 370 tests pass, `bun run check` 0 errors, `bun run build` passes.
- **Browser** (dev server :4321, Chromium with SwiftShader, no console errors): `/about` on `harbour` (tropical), `seed-2` (northern), `lanternfish` (autumn) and `42` (volcanic) at 1440×900 Day and Night, and 390×844 touch with reduced motion: the room shows open with the developer's link over the developer. A frame sequence was captured by copying the canvas after every rendered frame (screenshots are too slow for the 800 ms lift): from the Overview to About, shut → 7 frames moving → open, and About/Team to Services, open → 7 moving → shut, by Day (`harbour`) and Night (`lanternfish`). The room and developer are the same 1/16 voxels in every moving and open frame; only the screen's code scrolls. Clicking the developer opens Team. The Tour's Team stop (`seed-2`) shows the open House with the Guide beside it.
- **Screenshots:** `.scratch/voxel-world-polish/screenshots/17-*.png`: each Biome Day, Night and phone (reduced motion), the Tour's Team stop, and the sequences `17-seq-tropical-open-*`, `17-seq-tropical-shut-*` and `17-seq-autumn-night-open-*` (the file name ends in the lid's state).
- The dev server on :4321 did not need a restart (no structure files or colour roles changed).
