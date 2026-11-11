# 05: Garden with Pinned Project flowers and Biome trees

**What to build:** Pinned Projects bloom as large flowers at the front of the Garden, other Projects grow as the Biome's trees with gaps between them, and the Garden holds no decorative flowers.

**Blocked by:** 01, 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] The `projects` schema gains an optional `pinned` flag, and a few mock Projects are pinned.
- [ ] The Garden is a fixed 3×3 bed inside a one-cell fence (5×5 in all) with a gate on the path side.
- [ ] The first six Pinned Projects by id bloom as flowers in the front two rows (3×2 as the camera sees it). Other Projects, and Pinned Projects beyond six, grow as trees in the back row (3×1).
- [ ] One plant per cell: at most 9 Projects in the Garden, and Pinned Projects take places first.
- [ ] Settle with the user first: may other Projects take empty flower cells when fewer than six are pinned?
- [ ] Trees and flowers are ASCII structures per Biome. At ⅛ unit, each canopy is 6×6 in an 8×8 cell, so each plant reads separately. The fence is an ASCII structure too.
- [ ] Trees and flowers are drawn with `InstancedMesh`.
- [ ] There is no Decoration inside the Garden. An empty Garden is a grass patch.
- [ ] Clicking a flower or tree opens its Project. Click targets do not overlap, and the tap size on phones is checked.
- [ ] `/garden` lists Pinned Projects first, and every Project, including those beyond the cap, is listed.
- [ ] Tests:
  - flower count is min(pinned, 6)
  - trees are at most 3, and flowers plus trees at most min(Projects, 9)
  - 0 Projects is handled
  - all Projects pinned is handled
- [ ] The real page is checked in a browser at desktop and phone sizes on several Seeds and Biomes, with no console errors. Gallery screenshots are attached.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
