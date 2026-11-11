# 16: Torches and Night light

**What to build:** Torches and lanterns stand round the Landmarks and along the paths. At Night they flicker and throw warm light on the voxels round them, the way a torch lights the blocks near it in a block-building game, and every light source in the World glows softly.

**Blocked by:** 01, 02, 09 · builds on the Day/Night theme (`.scratch/voxel-world-landing/issues/13-day-night-theme.md`). Ticket 08's lamps use this ticket's light once both are in.

**Status:** needs-triage

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

## Open questions

- Should Light Sources also stand in the House Interior (a desk lamp, a candle), lighting the room at Night?
- Should the moonlight dim further at Night now that torches carry the scene, or stay as the theme ticket set it?
