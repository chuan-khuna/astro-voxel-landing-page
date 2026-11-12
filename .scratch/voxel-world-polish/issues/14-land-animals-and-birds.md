# 14: Land animals and birds

**What to build:** Each Biome's animals walk short routes on the Isles, rest and graze, and birds circle high above, without ever hiding a Landmark.

**Blocked by:** 08, 09

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [x] Animals and birds are ⅛-unit ASCII structures per Biome, drawn with `InstancedMesh`. Examples: deer in the north, squirrels in autumn, seabirds in the tropics, bats at Night. Simple poses (walk, rest, graze, head turn, wing beat) are separate frames or a few shader-driven parts.
- [x] `generateWorld` gives each land animal a rest point and a short route from the Seed. Routes never cross a footprint, a bridge or the Garden, and never stand between the camera and a Landmark, using the Decoration occlusion check.
- [x] Each Isle has at most 2–3 animals. The count follows the tier.
- [x] At runtime an animal walks its route, then rests, grazes or turns its head, on the shared clock.
- [x] Birds circle above the Isles, higher than every Landmark, and their paths avoid the camera's view of each Landmark.
- [x] Animals and birds are never click targets, and nothing moves when the clock is frozen.
- [x] Tests through `generateWorld` over hundreds of Seeds: determinism, routes clear of footprints, bridges and the Garden, no occlusion, at most 3 animals per Isle, and sets from the World's Biome.
- [x] Data tests cover every new structure. The Model Gallery shows them, and screenshots are attached.
- [x] The real page is checked in a browser on Seeds covering all four Biomes, in Day and Night if the theme exists, at desktop and phone sizes, with no console errors.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

Built (polish 14):

- **World.** `generateWorld` adds `World.animals` (`world/animals.ts`, `<seed>/animals`): 2 or 3 animals an Isle where there is room (never over 3), each a rest point and a 2–5-step route on level land, off footprints and the jetty (and a cell clear of them, so out of the Garden), paths, bridges and their ends, with only grass or clumps underfoot, safe neighbours for the body, and out of every Landmark's sight line (`sightClearance`) over the route and its neighbours; listed round-robin by Isle. And `World.birds` (`world/birds.ts`, `<seed>/birds`): up to 5 circles (2 an Isle) over land, 1.5–3 units round, between 0.6 over the tallest Landmark and 0.7 under the clouds, never on any Landmark's sight line all the way round (interval arithmetic on the Landmarks' rectangles). Tested through `generateWorld` over 200 Seeds.
- **Structures.** `animal/<biome>-1` (junglefowl, deer, squirrel, goat; a `head` part), `bird/tropical-1` (tropicbird), `bird/northern-1` (gull), `bat/autumn-1`, `bat/volcanic-1` (`wingLeft`, `wingRight` parts, new in `STRUCTURE_PARTS`); new fixed colours and roles. Data tests in `structures.test.ts`; in the Model Gallery (birds and bats hang a unit over their grass); `screenshots/14-gallery-*`.
- **Motion.** `render/creatures.ts` (pure, tested): an animal's round (rest lying down, look round, walk out turning at corners, graze, walk back, turn), a bird's circle (banked, wing-beat bursts and glides) and a bat's (beating, fluttering), the tier share. `render/creatureMeshes.ts`: `InstancedMesh`es by part, placed on the CPU in `step(seconds)` from the shared clock; never raycast, no shadow. `canvas.dataset.animals` and `.birds`; the e2e spec checks theme and tier.

Decisions and deviations:

- Every Biome gets a land animal by Day (a junglefowl in the tropics and a mountain goat on volcanic Isles added to the spec's deer and squirrels), and the north gets gulls by Day; bats fly at Night in autumn and volcanic only, tropical and northern have no flyer at Night. Land animals are out by Day only (at Night they rest out of sight), as the spec's table lists them.
- Poses are set on the CPU from `step(seconds)` (like the ships and the developer), not in the shader: a handful of instances, and the head and wings turn about their own pivots. A frozen clock still freezes them.
- Animals never walk on paths (as Decoration never stands on them), and squirrels stay on the ground (no trees). The squirrel is 2×7×5 (the README's 2×4×4 has no room for its tail).
- `BIRD_BELOW` is 0.5 and `BIRD_ABOVE` 0.6: the room the World keeps for a bird's wingtips; birds fly lower than the clouds' lowest possible underside (2 over the tallest Landmark).
- Test seams picked without confirming: `generateWorld`, the structure data tests and the pure `render/creatures.ts`.
- Checked in the browser on `harbour`, `seed-1`, `seed-2`, `seed-3` (all four Biomes), Day and Night, desktop and phone, no console errors; one recording of squirrels walking (`14-desktop-day-autumn-garden.webm`).
- Code review fixes: no per-frame allocations in `step`; `ANIMAL_HEIGHT` includes each walk's bob or hop; only grass and clumps beside a route, and level cells along the axes for the deer, whose body overhangs its cell (`ANIMAL_REACH`), so northern Worlds now have about 2 deer. Deferred items (the House's lifted lid against the birds' band, duplicated helpers) are in `docs/todo.md`.
