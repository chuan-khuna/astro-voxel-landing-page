# 07: Voxel water

**What to build:** The sea becomes a translucent voxel layer that shades from shallow to deep and bobs gently.

**Blocked by:** 02

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md`

- [x] The sea is a 1-unit voxel layer with the soft-voxel seam and bevel look, and it still fills the frame at any aspect ratio.
- [x] It is slightly translucent over shallow ground. Colour runs from the Biome's shallow to deep water by distance from the coast.
- [x] A gentle per-voxel bob is computed in the shader. It stops under reduced motion, and the idle page still schedules no needless frames beyond the bob.
- [x] The Dock jetty, moored boats and sailing ships still sit correctly on the water.
- [x] Night darkens the water as the base spec says, if the Day/Night theme exists.
- [x] The real page is checked in a browser at desktop and phone sizes, with frame rate noted on the phone size and no console errors.
- [x] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.

## Comments

**2026-11-12, agent (user away).** Built and checked. The look was not reviewed by the user and is logged in `docs/todo.md` ("Polish 07: water look"), with the decisions ("Polish 07: how the sea is built", "Polish 07: triangles and frames") and the code review ("Code review of polish 07").

- Model: `site/src/render/seaModel.ts` (pure): one water voxel for every sea cell of the grid and of an 8-cell ring round it, its top at the sea level (0.15). Only tops and short skirts on the +x and +z sides are built. Flat still water beyond the ring reaches 6× the grid. `coastDistance` (a chamfer distance to land) and `seaShade` set each voxel's deep, opacity and swell. A seabed tile (darker sand) on the sea floor sits under every translucent voxel.
- Material: `site/src/render/seaMaterial.ts`: the soft-voxel look at 1 unit (`softVoxelLook`, pulled out of `voxelMaterial.ts`), shallow to deep colour, opacity 0.7 to 1, and the bob in the vertex shader (0.04 units every 4.5 s, a hash of the cell plus a slow swell across the sea).
- Runtime: `objects.swell(seconds)` is advanced in `mountWorld.ts` while the World (not the House Interior) is on show, motion is allowed and the page is visible. It stops under reduced motion (0 frames over 2 s idle). Night darkens the water and the seabed.
- Tests: `seaModel.test.ts` (10 cases). 342 tests pass, `bun run check` 0 errors, `bun run build` passes (the World stills were captured with the new sea).
- Browser (Chromium, SwiftShader, the shared :4321 dev server): `lighthouse` (tropical; Overview and `/dock`, Day and Night), `42` (volcanic), `seed-1` (autumn, Night), `seed-2` (northern) at 1440×900; `lighthouse` and `/dock` on `seed-2` (Night) at 390×844 touch. The phone tier held 30 fps (it was 30 before). Desktop software GL ran at 18 fps (20.5 before). The only console errors are the 404s for the build-time stills, which dev never has (they were there before). `data-triangles` now counts the sea: `lighthouse` 18,100 → 51,948.
- Screenshots: `.scratch/voxel-world-polish/screenshots/07-*.png`.
- Not done: boats and ships do not bob with the water (ticket 10).
