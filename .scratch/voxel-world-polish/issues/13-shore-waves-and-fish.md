# 13: Shore waves, fish and glowing surf

**What to build:** Foam runs in and breaks along every coast. Schools of fish swim in the shallows and sometimes leap. At Night the surf glows faintly.

**Blocked by:** 07, 09

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [ ] Shore foam is white ⅛-unit voxels that run in towards the coast, break along the Isle's edge and draw back. It is computed in the shader from the water's distance-from-coast data, with no per-frame CPU work.
- [ ] Waves never break over the Dock's jetty or under moored boats in a way that looks wrong.
- [ ] Fish are ¼-unit ASCII structures, one species per Biome, drawn with `InstancedMesh`. Schools of 3–5 swim in the shallows and are seen through the translucent water. Now and then one leaps and splashes with ⅛-unit spray.
- [ ] School areas are deterministic from the Seed through `generateWorld`, in shallow water only. The number of schools follows the tier.
- [ ] At Night the foam dims and a faint bioluminescent glow shows where waves break. If Day/Night is not built yet, note this.
- [ ] Nothing moves when the clock is frozen, and fish and foam are never click targets.
- [ ] Data tests cover the fish structures. Tests through `generateWorld` cover school areas: deterministic, shallow water only.
- [ ] The Model Gallery shows the fish, and screenshots are attached. The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [ ] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.
