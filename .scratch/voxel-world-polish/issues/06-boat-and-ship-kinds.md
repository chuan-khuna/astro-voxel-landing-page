# 06: Kinds of Client boats and Partner ships

**What to build:** Client boats and Partner ships come in several kinds styled per Biome, and each Client and Partner keeps its kind in every World.

**Blocked by:** 01

**Status:** resolved

Scale: structures are ⅛ unit (ADR 0006). Sizes: `.scratch/voxel-world-polish/README.md`.

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] There are several Client boat kinds and 2–3 Partner ship kinds, with Biome-styled Variants as ASCII structures. Partner ships are always clearly larger than Client boats.
- [x] The kind comes from a stable hash of the Client's or Partner's id, not the Seed.
- [x] Boats and ships are drawn with `InstancedMesh`.
- [x] Tests: the same id gives the same kind across Seeds and Biomes, and counts still match content and caps.
- [x] The Model Gallery shows all boats and ships, and screenshots are attached.
- [x] The real page is checked in a browser on several Seeds and Biomes, with no console errors.
- [x] Spec and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked; the look of the new models was not reviewed by the user and is logged in `docs/todo.md` ("Polish 06: boat and ship look"), with the decisions ("Polish 06: kinds and ids", "Polish 06: placing vessels", "Polish 06: test seams and triangles").

- Kinds: 3 boat kinds (rowing boat, sailing dinghy, fishing boat; 1×1, 7–8 long, 4–6 across, 4–8 tall) and 3 ship kinds (schooner, steamer, cargo trader; 1×3, 23–24 long, 8 across, 20–29 tall), each per Biome: 24 files in `site/src/structures/boat/` and `ship/`, drawn with a throwaway generator script and committed as plain ASCII. New roles `hullRed`, `hullRedDark`, `hullNavy`, `hullNavyDark`.
- World: `ContentCounts` gains optional `clientIds` and `partnerIds` (the page passes them in id order); `Boat` and `ShipRoute` gain `kind`, from `vesselKind(id, kinds)` (`world/vessels.ts`, a salted FNV-1a hash), added after the layout so no layout moved.
- Rendering: `render/vesselModels.ts` (pure: kind to structure, boat and ship placements), `render/boats.ts` and `render/ships.ts` (one `InstancedMesh` per structure); `instanceMatrix` takes fractional quarter turns for a ship's heading. Boats left the ¼-unit detail grid; `countVoxels` counts each vessel's structure.
- Gallery: boats and ships float on a patch of their Biome's sea (darker at Night); boats are packed closer.
- Tests: `generateWorld.test.ts` (same kinds over 60 Seeds and all Biomes, a Client keeps its kind when others leave, every kind used, counts only), `structures.test.ts` (files per Biome, sizes, ships larger than boats, bows to +z), `vesselModels.test.ts`, `voxelCounts.test.ts`. 332 tests pass, `bun run check` 0 errors, `bun run build` passes.
- Browser (Chromium, SwiftShader, own dev server on :4399): `/dock` on `harbour` (tropical), `seed-2` (northern), `lanternfish` (autumn), `42` (volcanic, Night) and `/` on `lighthouse` at 1440×900, and `/dock` on `harbour` and `42` (Night) at 390×844 (touch); the Gallery's boats and ships, Day and Night and on a phone. No console errors. `data-triangles` rose about 3,100–3,300 a World.
- Screenshots: `.scratch/voxel-world-polish/screenshots/06-*.png`.
- Not done: boats and ships do not rock on the swell yet (ticket 10). :4321 needs a restart for the new roles.
