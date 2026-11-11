# 01: Structure pipeline, Model Gallery and House models

**What to build:** Landmarks are drawn from predefined ASCII voxel structures instead of code-built placeholders. The House has its first Variant in every Biome, and the user can review all models in a dev-only Model Gallery.

**Blocked by:** every ticket in `.scratch/voxel-world-landing/` is resolved

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0004-ascii-voxel-structures.md`

- [ ] The ASCII structure format is documented. It covers ¼-unit layers from bottom to top, a character-to-colour-role key, the footprint, the door face and the anchor.
- [ ] Structures are parsed at build time into typed voxel arrays. Colour roles resolve to the Biome palette or to the fixed House and brand colours.
- [ ] Placed Landmarks mesh through the existing greedy mesher and soft-voxel material.
- [ ] `InstancedMesh` support is ready for repeated structures, with one mesh per structure.
- [ ] The House has one Variant per Biome (4 in all), each 12×12, with door, windows, eaves, roof and chimney or Biome equivalent. Each has a liftable roof and a shared interior space within its Biome.
- [ ] Every House Variant fills its 3×3 footprint, and its door faces the path.
- [ ] `/dev/models` shows every structure in a Biome × Variant grid with real shading, rotation and a Day/Night toggle. It is excluded from the production build.
- [ ] Data tests: each structure parses, uses only known roles and fills its footprint.
- [ ] The real page is checked in a browser at desktop and phone sizes on several Seeds, with no console errors. Gallery screenshots are attached to the report.
- [ ] **Stop for the user's approval of the House look** before closing this ticket. Record the approval under `## Comments`.
- [ ] Spec, glossary and `docs/documents/` (with INDEX) are updated.
