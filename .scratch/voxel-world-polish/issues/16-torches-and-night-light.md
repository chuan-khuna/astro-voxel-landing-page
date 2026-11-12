# 16: Torches and Night light

**What to build:** Torches and lanterns stand round the Landmarks and along the paths. At Night they flicker and throw warm light on the voxels round them, the way a torch lights the blocks near it in a block-building game, and every light source in the World glows softly.

**Blocked by:** 01, 02, 09, 17 (the House room now lives in the World) · builds on the Day/Night theme (`.scratch/voxel-world-landing/issues/13-day-night-theme.md`). Ticket 08's lamps use this ticket's light once both are in.

**Status:** resolved

Scale: structures are ⅛ unit (ADR 0006). Sizes: `.scratch/voxel-world-polish/README.md`.

Spec: `.scratch/voxel-world-polish/spec.md` · ADRs: `docs/adr/0004-ascii-voxel-structures.md`, `docs/adr/0005-continuous-render-for-ambient-life.md`

## Light sources

- [ ] A **Light Source** is a structure with a `flame` (or `glow`) role in its ASCII key, and declares its light: colour, reach in cells (about 3–5) and strength. Structures still hold no raw colours; the light colour is a theme token per Biome.
- [ ] Each Biome has its own torch style, drawn at ⅛ unit, with 2 Variants: for example a tiki torch (tropical), an iron lantern on a post (northern), a lantern or carved pumpkin (autumn) and a stone brazier (volcanic).
- [ ] `generateWorld` places Light Sources deterministically from the Seed: one or two at each Landmark (beside the House's door, the Mailbox, the Station group, the Garden's gate, the end of the Dock's jetty) and a few along the paths and at bridge ends. They follow the same rules as Decoration: never on a footprint, path or bridge end, never in front of a Landmark (the occlusion check), never taller than the nearest Landmark.
- [ ] The House's lit windows, the buoys' lamps and fireflies count as light: windows and lamps throw block light like a torch; fireflies only glow (no block light).

## Block light (at Night)

- [ ] Light spreads like block light: a flood fill from each source over the World's cells, one level less per cell, stopped by solid voxels. It is computed in the World Web Worker alongside meshing, never in the main thread.
- [ ] The light level reaches the mesher as a per-vertex attribute (smoothed across faces like the existing AO), so a whole Isle costs no extra draw calls and no real-time lights. Instanced structures sample the light at their cell.
- [ ] The material adds `lightLevel × lightColour × nightStrength`, where `nightStrength` is a uniform: 0 by Day, 1 at Night. Switching theme sets the uniform; it never remeshes.
- [ ] Block light lifts the moonlit side too, so a lit doorway reads clearly against the dark, but never lights the sea beyond a soft rim at the shore.

## Flicker and glow

- [ ] Flames flicker: their colour and the light they throw waver a little from the shared clock (ADR 0005), each source out of step with the others. Nothing flickers when the clock is frozen (reduced motion, the still tier, the Model Gallery, build-time stills).
- [ ] At Night flames, lit windows, buoy lamps and fireflies glow: a soft bloom on emissive parts only (for example a TSL bloom pass with a threshold that only emissive colours pass). The rest of the World does not bloom, and the Data Cards and other HTML never blur.
- [ ] Bloom is part of the tiers: full tier has bloom, reduced tier uses a cheap camera-facing halo sprite per source instead, and the still tier keeps the block light but drops both.
- [ ] Optional, decide in review: small ember particles (⅛ unit) rising from torches at the full tier.

## Day

- [ ] By Day torches stand unlit: the flame voxels show their unlit colour, no block light, no bloom, no flicker.

## Checks

- [ ] Light Sources are never hotspots or raycast targets; pointers reach Landmarks through them.
- [ ] Tests through `generateWorld` over hundreds of Seeds: placement is deterministic, every Landmark has at least one Light Source, and none overlaps a footprint, path, bridge end or the Garden, or occludes a Landmark.
- [ ] The block-light flood fill is tested as pure logic: level falls by one per cell, solid voxels stop it, overlapping sources take the brighter level.
- [ ] Structure tests cover the torch files (parse, known roles, a `flame` role, declared light).
- [ ] The Model Gallery shows every torch by Day and at Night with its glow, and screenshots are attached.
- [ ] The frame budget holds: no frame-time regression at the reduced tier on a phone-sized viewport; note the measured cost of bloom at the full tier.
- [ ] The real page is checked in a browser at desktop and phone sizes on Seeds covering all four Biomes, by Day and at Night, at the Overview and at every Landmark's close-up, with no console errors.
- [ ] Spec, `GLOSSARY.md` (Light Source), an ADR for baked block light over real-time lights, and `docs/documents/rendering-and-shading.md` and `world-generator.md` (with INDEX) are updated.

## Decisions (user, 2026-11-12)

Record: `docs/records/2026-11-12-station-group-and-night-light.md`

- [ ] **Light in the House room, from what is already there.** Each Biome's room already has a lamp, hearth fire, floor lamp or brazier (ticket 04). Make those Light Sources that throw block light in the room at Night; the room is in the World since ticket 17. Add no new lamps or candles.
- [ ] **Moonlight dims a little.** Lower the Night moonlight by about 20–30% so torches stand out, while every Landmark still reads across the Isle and Night text and UI keep their WCAG contrast. Note the exact change in the theme tokens.
- Ember particles stay optional, to decide in review.

## Comments

**Built (2026-11-12).** Torches and Night light. ADR 0007 records the main decision, and the docs are updated: `rendering-and-shading.md` ("Night light"), `world-generator.md` ("Torches"), `voxel-structures.md` ("Torches", the `light:` field, roles `flame` and `glow`), `GLOSSARY.md` (Light Source) and the spec.

- **Light Sources.** New roles `flame` (flickers) and `glow` (steady), and an optional header `light: <reach> <strength>`; the light's colour is a Night theme token (`torchLight` per Biome, `windowLight`, `buoyLight`).
  - Torches: `structures/torch/<biome>-1` is tall (12 voxels) and `-2` is short (6 voxels). The tropical pair is a tiki torch and a coconut-shell lamp, northern an iron lantern and a stone lantern, autumn a hanging lantern and a carved pumpkin, volcanic a pillar brazier and a low brazier.
  - Existing models that became Light Sources: the Decoration's lamps, the lighthouse's lantern, the Dock Variant 2's lanterns, and the House rooms' lamp or fire. Per the user's decision, no new lamps were added; the rooms' own light now replaces `roomLamp`. The House's front windows and the buoys are Light Sources too.
  - Boats' and ships' lamps (`glow`) and fireflies only glow.
- **Placement** (`world/torches.ts`, from `<seed>/torches`, after the Decoration). Each Landmark gets one or two torches, at its own place first: beside the House's door, the Mailbox's corner, the Garden's gate, or on the end of the Dock's jetty. If none fits, a torch goes in the rings round the footprint, up to 5 cells out. Up to 3 more stand along the path and one by each bridge.
  - The Decoration's rules apply. A short torch stands wherever a tall one would be taller than the nearest Landmark.
  - Two relaxations, both recorded in `docs/todo.md`: the House's yard counts as open ground in the sight-line check, and the Dock's own deck does not count as hidden for the jetty's torch.
  - Over 400 Seeds every Landmark has at least one torch, about 11 per World. Particles and animals keep off the torches.
- **Block light.** The worker flood-fills the 1-unit cells, with only the terrain solid, and turns the result into a 3D texture that every voxel material samples. This deviates from the per-vertex attribute the ticket asked for: per-vertex light would split the mesher's merged quads and could not reach instanced structures.
  - The sea is lit only on a rim along the shore. Switching the theme sets one uniform.
  - Flames flicker on the shared clock, each cell at the phase of its strongest source, so nothing flickers while the clock is frozen.
- **Glow.** At the full life tier, emissive parts bloom through an MRT pass that shares the outline's `RenderPipeline`. The reduced tier shows halos (one mesh) and the still tier neither. The tiers follow the life tier, so phones get halos. `canvas.dataset.glow` reports which is on, and an e2e test covers it.
- **Moonlight** is about a quarter dimmer: sun 1.2 → 0.9, sky 0.95 → 0.75. The UI tokens are unchanged.
- **Ember particles** were not built; the decision is left to review.
- **Performance** (`seed-1`, headless Chrome, WebGPU on Metal, uncapped):
  - Full tier: 2.24 ms per frame before, 2.39 ms by Day (block light) and 3.13 ms at Night (bloom costs about 0.75 ms).
  - Phone reduced tier: the same fps as before, Day and Night.
  - SwiftShader: the phone tier held 30 fps. The full tier on `lighthouse` ran at 5.5 fps before, 4.5 by Day and 3.1 at Night.
  - The torches add about 1,500–1,900 triangles. The bake takes about 5 ms per World.
- **Tests.**
  - `floodLight` as pure logic: the light falls by one per cell, walls stop it, and the brighter source wins.
  - The bake and the source list on real Worlds.
  - Torch placement through `generateWorld` over 200 Seeds.
  - The torch and Light Source structure files, the `light` header, the voxel counts, and which pieces of Decoration the reduced tier keeps.
  - The test seams were picked without confirming them, as in earlier polishes.
- **Browser check.** Screenshots in `.scratch/voxel-world-polish/screenshots/16-*` (not committed) cover four Seeds, one per Biome, on desktop and phone, by Day and at Night, at the Overview and every close-up, plus the Model Gallery's torches and lamps. None logged a console error.
- **Code review.** These were fixed: clouds, fish and spray bloomed, so their own light is now added after the lighting; the room's light leaked round a shut House, so its reach is now 2; some docs were stale; the flicker code was duplicated; there were import and type smells. What is left for the user is in `docs/todo.md`, under "Code review of polish 16".

