# 17: House Interior stays in the World

**What to build:** Opening the House shows the room in the World itself, with no switch to a separate Interior scene. The room and the developer look the same from the moment the lid starts to lift until it comes down again.

**Blocked by:** 04, 09 (ticket 09 reworks the render loop in `mountWorld.ts`)

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

## Why

The user's decision (2026-11-12): drop the hand-over to the Interior scene. When the House opens, the World first shows the room coarsened to ⅛ unit (`render/interiorModel.ts`). Then the 1/16-unit Interior scene (`render/interior.ts`) cuts in, so the developer and furniture visibly change texture partway through. Render the opening smoothly instead, in one scene.

## What to do

- [ ] No scene switch: remove the Interior scene hand-over (`showsInterior`, the cut in `mountWorld.ts`, `data-scene`). The camera dives in and out of the House in the World, as for any other Landmark close-up.
- [ ] Draw the room and the developer in the World at the room's own detail, 1/16 unit: the same structures from `site/src/structures/room/` and `developer/`, so what you see never changes resolution. Drop the ⅛-unit coarsened copy.
- [ ] Show the room only while the lid is lifted or lifting, so a shut House costs no room triangles (ticket 04 added about 1,000–1,200 per World even with the House shut).
- [ ] Keep what the Interior scene had, now in the World: the developer's head and hands typing, the code screen, the developer's link to Team, the Guide beside the House on the Tour's Team stop, and at Night a warm light at the room's lamp or fire, if it can be done cheaply (otherwise an unlit glow, and log it).
- [ ] Reduced motion, a hidden tab and the phone tier behave as for the rest of the World.
- [ ] Tests at the existing seams (`interiorModel.test.ts`, structure data tests) are updated; delete the tests for the removed hand-over.
- [ ] Checked in a browser on `/about` for all four Biomes, Day and Night, desktop and phone, with reduced motion: opening and closing the House shows no change of texture or detail. Screenshots or a short frame sequence are attached (`.scratch/voxel-world-polish/screenshots/17-*.png`).
- [ ] ADR 0006 is amended (the Interior is no longer its own scene), a record of the decision is written to `docs/records/2026-11-12-house-interior-in-world.md`, and the spec, README, `GLOSSARY.md` and `docs/documents/` (with INDEX) are updated. The `docs/todo.md` items this settles ("how the Interior takes over", the ADR's own-camera question, `data-scene`, the room's triangle cost) are ticked with a note.
