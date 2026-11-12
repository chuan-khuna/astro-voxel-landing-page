# 11: Butterflies, fireflies and Biome particles

**What to build:** Each Biome has its own flying particles, and Day or Night decides which are out: butterflies by Day, fireflies at Night, snow in the north and ash on volcanic Isles.

**Blocked by:** 09

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [x] Particles are single-colour ⅛-unit cubes in one `InstancedMesh` per kind, moved in the shader from the shared clock and wind.
- [x] The sets follow the spec's Biome × Day/Night table. Butterflies flutter in loose paths near flower clumps. Fireflies blink as emissive points low over the grass at Night. Snow and ash drift with the wind.
- [x] Spawn areas are deterministic from the Seed, through `generateWorld`, and stay off Landmark footprints and out of the camera's view of a Landmark.
- [x] Particles are never raycast or hotspot targets, and clicks reach Landmarks and Garden plants through them.
- [x] Counts follow the tier, and nothing moves when the clock is frozen.
- [x] If the Day/Night theme is not built yet, the Night sets are skipped. Say so in the report and leave them for the theme ticket.
- [x] Tests through `generateWorld`: the sets come from the World's Biome, and spawn areas are deterministic and never on a footprint.
- [x] The real page is checked in a browser on Seeds covering all four Biomes, in Day and Night, at desktop and phone sizes, with no console errors. Short recordings are attached.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

Built in polish 11 (agent, 2026-11-12).

- **Day/Night theme exists** (the base feature's `setTheme`), so the Night sets are built: fireflies. Bats and seabirds (and deer, squirrels) are creatures, left for ticket 14.
- **Sets** (`PARTICLE_SETS`, `world/particles.ts`): tropical butterflies by Day, fireflies at Night; northern snow by Day, fireflies and snow at Night; autumn fireflies at Night (by Day ticket 10's leaves); volcanic ash Day and Night. Deviation: snow and ash keep falling at Night (they are weather; it also gives volcanic a Night particle until bats come). The spec's table is updated.
- **Spawn areas** come from `generateWorld` (`World.particles`, from `<seed>/particles`, after Decoration): boxes of air over land no higher than their ground, off every footprint, the jetty and bridges, over no Decoration taller than their floor, and under every Landmark's sight line (`sightClearance`, now shared with Decoration in `world/sightline.ts`). Butterflies centre on a flower clump or a cell beside it; fireflies over grass, 0.55–1.1 units up.
- **Rendering** (`render/swarms.ts`, pure; `render/particles.ts`): one `InstancedMesh` of ⅛-unit cubes per kind, all motion in the vertex shader on the shared clock and wind. Butterflies loop and flap (the cube folds), fireflies wander and blink (unlit), snow and ash fall down the wind, swaying and pushed by gusts, fading in and out. `setTheme` shows the kinds out (no rebuild on a theme switch), `setLife` the tier's share (ordered round the areas so half still reaches every area). Never raycast, no shadow; hotspots are HTML, so clicks reach Landmarks and plants.
- **Tests:** `generateWorld.test.ts` ("Particles": sets from the Biome, the table, determinism, every box cell's rules, an independent sight-line ray march, butterflies by clumps and fireflies over grass); `render/swarms.test.ts` (each particle stays inside its box with the shader's wobble, snow and ash drift down the wind, the theme's kinds, tier counts). `e2e/ambient-life.spec.ts` now runs all four Biomes by Day and at Night.
- **Checked** in headless Chromium on `harbour` (tropical), `seed-1` (autumn), `seed-2` (northern), `seed-3` (volcanic), desktop (`life=full`) and phone (`life=reduced`), Day and Night: no console errors besides the dev server's known 404s for `/stills/*.webp`. Recordings: `screenshots/11-<desktop|phone>-<day|night>-<biome>.webm` (phone ones recorded on the built site after the review fix, with no console errors at all); frames: `11-desktop-<theme>-<biome>-f0..f1.png`, `11-phone-<theme>-<biome>-f0.png`.
- Judgement calls for the user are in `docs/todo.md` ("Polish 11: butterflies, fireflies, snow and ash").
- **Code review fixes** (second commit): fireflies' whole box must be grass, not only its centre (test tightened first); the e2e spec takes `THEME_STORAGE_KEY`; `SWARM_WOBBLE`'s comment matched to the code (the cube's whole edge, so a turning cube stays in); a shadowed loop variable in `sightClearance`; an unused `PARTICLE_AREA` export; a bounds guard on bridge cells. Deferred as judgement calls: `swarmShown` duplicates `leavesShown`, and the per-kind branches in `swarms.ts`/`particles.ts` could become one per-kind record.
