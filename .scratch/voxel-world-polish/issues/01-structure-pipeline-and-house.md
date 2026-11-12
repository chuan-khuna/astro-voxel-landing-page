# 01: Structure pipeline, Model Gallery and House models

**What to build:** Landmarks are drawn from predefined ASCII voxel structures instead of code-built placeholders. The House has its first Variant in every Biome, and the user can review all models in a dev-only Model Gallery.

**Blocked by:** every ticket in `.scratch/voxel-world-landing/` is resolved

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0004-ascii-voxel-structures.md`

- [x] Voxel sizes are split into the tiers of ADR 0006 (terrain 1, ground detail ¼, structure ⅛). The mesher and soft-voxel material handle each size.
- [x] The ASCII structure format is documented. It covers ⅛-unit layers from bottom to top, a character-to-colour-role key, the footprint, the door face and the anchor.
- [x] Structures are parsed at build time into typed voxel arrays. Colour roles resolve to the Biome palette or to the fixed House and brand colours.
- [x] Placed Landmarks mesh through the existing greedy mesher and soft-voxel material.
- [x] `InstancedMesh` support is ready for repeated structures, with one mesh per structure.
- [x] The House has one Variant per Biome (4 in all), each 24×24 at ⅛ unit, with door, windows, eaves, roof and chimney or Biome equivalent. Each has a liftable roof and a shared interior space within its Biome.
- [x] The House stands on a 4×4 plot: the House fills 3×3, and its front yard (the other seven cells, on the door side) holds the Mailbox. The door faces the path. The Mailbox keeps its own hotspot.
- [x] `/dev/models` shows every structure in a Biome × Variant grid with real shading, rotation and a Day/Night toggle. It is excluded from the production build.
- [x] Data tests: each structure parses, uses only known roles and fills its footprint.
- [x] The real page is checked in a browser at desktop and phone sizes on several Seeds, with no console errors. Gallery screenshots are attached to the report.
- [x] **Stop for the user's approval of the House look** before closing this ticket. Record the approval under `## Comments`.
- [x] Spec, glossary and `docs/documents/` (with INDEX) are updated.

## Comments

**2026-11-11, agent (user away).** Built and checked; the House-look approval was skipped and is logged in `docs/todo.md` ("Polish 01: House look"). Not yet approved: any change means redrawing the House files in `site/src/structures/house/`.

- Pipeline: `site/src/structures/` (format in `parse.ts`, roles, registry, Vite plugin for pages, the World Web Worker and Vitest). Tiers in `site/src/render/voxelTiers.ts`; the World now meshes a third, ⅛-unit structure grid. `structureMeshes.ts` holds the `InstancedMesh` support (used by the Gallery; the World's first use is ticket 05).
- House: four Variants (`house/<biome>-1.structure`): a tropical stilt house, a northern log cabin, an autumn brick cottage and a volcanic stone house. Lid = roof plus the two front walls (the ticket 11 doll's-house split, kept). The ¼-unit room still stands inside, unchanged, until ticket 04.
- House plot: 4×4, the House in its north-west 3×3; the door faces south or east (the two sides the camera sees), the Seed's choice unless only the other reaches the path. The path ends just outside the plot in line with the door, and the yard cell in front of the door is painted as path. The Mailbox stands in the yard's south-east corner (it never hides the door). The House's box (hotspot, Guide spot, Data Card) is now the House's 3×3, not the yard.
- The safe layout's Isle grew from radius 10 to 12, so a 24-tree Garden and the 4×4 plot always fit.
- Browser: Seeds `lighthouse`, `harbour`, `lanternfish`, `7`, `42` at 1440×900 and 390×844 (touch), on `/` and `/about`: no console errors (only the World stills 404 in dev, which exist after a build). `bun run build` passes, captures the stills, and leaves `/dev/models` out.
- Screenshots: `.scratch/voxel-world-polish/screenshots/01-*.png` (Gallery Day, lids lifted, turned, Night; the World on desktop and phone).

**2026-11-11, user.** Approved the House look for all four Variants (tropical, northern, autumn, volcanic).
