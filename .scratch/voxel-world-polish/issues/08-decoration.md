# 08: Decoration per Biome

**What to build:** Each Biome dresses its Isles with its own Decoration (small trees, grass, flower clumps and minor buildings) that never hides or crowds a Landmark.

**Blocked by:** 01, 02, 05

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] Each Biome has a Decoration set as ASCII structures: small trees (a different, smaller species from Project trees), grass, flower clumps, and minor buildings such as sheds, fences, lamps, rock piles and windmills.
- [ ] The generator scatters Decoration deterministically from the Seed.
- [ ] Decoration never sits on a footprint, path, bridge end or inside the Garden.
- [ ] Decoration is never taller than the nearest Landmark.
- [ ] Decoration never stands between the camera and any Landmark, using the same occlusion check as Landmark placement.
- [ ] Decoration is drawn with `InstancedMesh`, with a reduced tier on small devices. Landmarks are never reduced.
- [ ] Tests through `generateWorld` over hundreds of Seeds cover determinism, no overlaps and no occlusion.
- [ ] The Model Gallery shows every Decoration piece, and screenshots are attached.
- [ ] The real page is checked in a browser at desktop and phone sizes on Seeds covering all four Biomes, with no console errors.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
