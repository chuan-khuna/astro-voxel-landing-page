# 02: Bigger Isles

**What to build:** Isles are about 1.5× wider, so there is room for Landmark Variants, a full Garden and Decoration.

**Blocked by:** 01

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] Isle radii are 14–18 for one Isle, 10–14 for two or three, and 9–12 for four.
- [ ] All existing placement, footprint and never-hidden-by-terrain rules still hold over hundreds of Seeds, tested through `generateWorld` only.
- [ ] Camera bounds and the Overview framing follow the larger World.
- [ ] Generation time and retry rate are measured and reported (before vs after).
- [ ] The real page is checked in a browser at desktop and phone sizes on several Seeds, with no console errors.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
