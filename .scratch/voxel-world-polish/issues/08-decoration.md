# 08: Decoration per Biome

**What to build:** Each Biome dresses its Isles with its own Decoration (small trees, grass, flower clumps and minor buildings) that never hides or crowds a Landmark.

**Blocked by:** 01, 02, 05

**Status:** resolved

Scale: structures are ⅛ unit (ADR 0006). Sizes: `.scratch/voxel-world-polish/README.md`.

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] Each Biome has a Decoration set as ASCII structures: small trees (a different, smaller species from Project trees), grass, flower clumps, and minor buildings such as sheds, fences, lamps, rock piles and windmills.
- [x] The generator scatters Decoration deterministically from the Seed.
- [x] Decoration never sits on a footprint, path, bridge end or inside the Garden.
- [x] Decoration is never taller than the nearest Landmark.
- [x] Decoration never stands between the camera and any Landmark, using the same occlusion check as Landmark placement.
- [x] Decoration is drawn with `InstancedMesh`, with a reduced tier on small devices. Landmarks are never reduced.
- [x] Tests through `generateWorld` over hundreds of Seeds cover determinism, no overlaps and no occlusion.
- [x] The Model Gallery shows every Decoration piece, and screenshots are attached.
- [x] The real page is checked in a browser at desktop and phone sizes on Seeds covering all four Biomes, with no console errors.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked. The look was not reviewed by the user and is logged in `docs/todo.md` ("Polish 08: Decoration look"), with the decisions ("Polish 08: how Decoration is placed", "Polish 08: triangles and the reduced tier") and the code review ("Code review of polish 08").

- Generator: `site/src/world/decoration.ts` (`placeDecoration`, run last in `generateWorld` from a sequence of its own, `<seed>/decoration`, so no layout moved) and `World.decoration` (kind, cell, facing). The occlusion check is the Landmarks' own sight line, pulled out of `landmarks.ts` into `world/sightline.ts` (`forEachRayColumn`; placement is unchanged, every existing test passes). "The nearest Landmark" is measured cell centre to nearest covered cell; its height is `LANDMARK_MIN_HEIGHT` (each Landmark's lowest Variant; the Garden's fence). Scattering takes under 1 ms (at most about 3); a World is 25 ms on average as before.
- Structures: nine kinds, one per Biome, 36 files in `site/src/structures/<kind>/`, drawn with a throwaway script and committed as ASCII. New roles `rock`, `rockDark`, `turf`, `turfLight`.
- Render: `render/decorationModels.ts` (pure: structure, placement, the pieces a tier shows) and `render/decoration.ts` (one `InstancedMesh` per structure, casting into the static shadow map). The reduced tier draws every other piece; Landmarks are never reduced. The stats card counts Decoration voxels.
- Tests: Decoration rules over 200 Seeds in `generateWorld.test.ts` (5 cases), data tests in `structures.test.ts` (6), `decorationModels.test.ts` (4), `voxelCounts.test.ts` (1). 358 tests pass; `bun run check` 0 errors; `bun run build` passes. The mesher's budget test got a 20 s timeout: it timed out once at 5.6 s with every file running in parallel (it passes alone in under 2 s).
- Browser (Chromium, SwiftShader, the shared :4321 dev server, restarted with `--force` for the new roles): `lighthouse`, `harbour` (tropical), `seed-2` (northern), `lanternfish`, `seed-1` (autumn), `42`, `seed-3` (volcanic), Overview and close-ups, Day and Night, at 1440×900 and 390×844 touch; the Model Gallery for every kind (Day, Night, phone). The only console errors are the 404s for the build-time stills, which dev never has.
- Screenshots: `.scratch/voxel-world-polish/screenshots/08-*.png`.
- Not done: lamps glow only once ticket 16 lands (their glass and flames are plain colours now); Decoration does not sway (ticket 10). Decoration may stand where the Guide floats past (the Guide is not an obstacle to placement).
