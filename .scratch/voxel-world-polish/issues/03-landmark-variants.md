# 03: Landmark Variants for every Biome

**What to build:** Every Landmark has its own style in each Biome and 2–3 Variants within that style, and the Seed picks one.

**Blocked by:** 01 (House look approved), 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] House, Station, Mailbox and Dock each have one style per Biome and 2–3 Variants per style, as ASCII structures.
- [ ] Each Variant fills its footprint (House 3×3, Station 2×2, Mailbox 1×1, Dock 2×1 plus jetty), and doors face the path.
- [ ] Every House Variant in a Biome has a liftable roof and the same interior space.
- [ ] The generator picks a Variant per Landmark from the Seed. The same Seed gives the same Variants, and Variants always come from the World's Biome. This is tested through `generateWorld` over hundreds of Seeds.
- [ ] Data tests cover every new structure.
- [ ] The Model Gallery shows all Variants, and screenshots are attached to the report.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
