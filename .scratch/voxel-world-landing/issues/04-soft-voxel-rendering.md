# 04: Soft voxel rendering

**What to build:** The World looks like the approved prototype: soft voxels with seams, bevels, colour jitter, AO and soft shadows, and it stays light enough for phones.

**Blocked by:** 01, 02

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] The mesher builds chunked geometry with hidden faces culled and same-colour coplanar faces greedy-merged
- [x] AO is baked into vertex colours
- [x] Terrain uses 1-unit voxels; Landmarks and decoration use ¼-unit voxels
- [x] Seams, bevel and colour jitter are computed in TSL from world position, so merged faces still read as single voxels, matching the settings approved in ticket 01
- [x] The shadow map renders only when the World changes, and frames render only while something moves
- [x] DPR is capped at 1.5 on mobile and 2 on desktop
- [x] The default World is at most 300k triangles
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

## Comments

**2026-11-11 — built.** Code in `site/src/render/` (`palette.ts`, `mesher.ts`, `worldVoxels.ts`, `landmarkModels.ts`, `voxelMaterial.ts`, `worldMeshes.ts`, `mountWorld.ts`); documented in `docs/documents/rendering-and-shading.md`.

- Mesher is pure TS (no three.js): chunked (16-unit cubes), hidden-face culling, vertex AO baked into colours, greedy merge of faces with the same colour and the same four AO levels. Terrain is 1-unit voxels; bridges, stairs and Landmark models are ¼-unit voxels in a detail grid that culls and takes AO against the terrain.
- TSL material ported from the prototype with the approved `LOOK` values (as shader constants); House colours are the approved fixed colours.
- Sun shadow map: `autoUpdate = false`, `needsUpdate` set once per World. Frames render only on mount/resize. DPR cap 1.5 on coarse pointer, 2 otherwise.
- Triangles (voxel meshes): default Seed 1,940; Seeds 0–299 max 4,662; 4-Isle Seed `13` 3,470. `mesher.test.ts` checks the 300k budget on 40 Seeds incl. 4-Isle ones, plus culling and merging.
- Checked in headless Chrome on WebGPU and forced WebGL 2 (no `navigator.gpu`): same image, no console errors (WebGL 2 shows three's own "WebGPU is not available" fallback warning).
- Landmark models are simple placeholders; real ones replace entries in `landmarkModels.ts`.
- Deviation: water is opaque (the prototype's was 0.88 translucent over nothing), so Biome water colours show as chosen.
