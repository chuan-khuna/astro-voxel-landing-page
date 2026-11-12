# House Interior in the World

Date: 2026-11-12

## What was discussed

How the House Interior is shown. Polish ticket 04 built it as a scene of its own at 1/16 unit (ADR 0006): while the lid lifted, the World showed the room coarsened to ⅛ unit, and once the lid was up and the camera at rest, the Interior scene cut in. The user said (in Thai): stop switching scene to the Interior and render it smoothly instead, because when the House opens you see the developer's texture change.

## What was decided

- **No scene switch.** The House Interior is part of the World. The Interior scene, its hand-over (`showsInterior`) and `data-scene` go.
- **One room, one detail.** The World draws the room and the developer at the room's own 1/16 unit, from the same structures (`structures/room/`, `developer/`). The ⅛-unit coarsened copy goes. From the moment the lid starts to lift until it comes down, nothing in the room changes resolution or texture.
- **Shown only while the lid is lifted or lifting**, so a shut House costs no room triangles.
- **Kept from the Interior scene:** the developer's head and hands typing, the code screen, the developer's link to Team, the Guide beside the House on the Tour's Team stop, and at Night a warm light from the room's lamp or fire if it is cheap (otherwise an unlit glow).
- Reduced motion, a hidden tab and the phone tier behave as for the rest of the World.
- ADR 0006 is amended.

Recorded as polish ticket 17 (`.scratch/voxel-world-polish/issues/17-house-interior-in-world.md`).

## Open questions

- None from the discussion. How the warm light was built (in the room's own material, not a scene light) is logged for review in `docs/todo.md`.
