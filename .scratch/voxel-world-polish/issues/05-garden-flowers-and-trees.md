# 05: Garden with Pinned Project flowers and Biome trees

**What to build:** Pinned Projects bloom as large flowers at the front of the Garden, other Projects grow as the Biome's trees with gaps between them, and the Garden holds no decorative flowers.

**Blocked by:** 01, 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] The `projects` schema gains an optional `pinned` flag, and a few mock Projects are pinned.
- [ ] The first six Pinned Projects by id bloom as flowers, and further Pinned Projects grow as trees.
- [ ] Flowers plus trees are capped at 24, and Pinned Projects take places first.
- [ ] Flowers sit in the Garden's front row as the camera sees it.
- [ ] Trees and flowers are ASCII structures per Biome. Each canopy is 3×3 in a 4×4 cell, so each plant reads separately.
- [ ] Trees and flowers are drawn with `InstancedMesh`.
- [ ] There is no Decoration inside the Garden. An empty Garden is a grass patch.
- [ ] Clicking a flower or tree opens its Project. Click targets do not overlap, and the tap size on phones is checked.
- [ ] `/garden` lists Pinned Projects first, and every Project, including those beyond the cap, is listed.
- [ ] Tests:
  - flower count is min(pinned, 6)
  - flowers plus trees are min(Projects, 24)
  - 0 Projects is handled
  - all Projects pinned is handled
- [ ] The real page is checked in a browser at desktop and phone sizes on several Seeds and Biomes, with no console errors. Gallery screenshots are attached.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
