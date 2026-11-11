# 03: Terrain, Isles and Biomes

**What to build:** Different Seeds give visibly different Worlds: one to four Isles with stepped heights, bridges, paths and stairs, in one of four muted Biomes, with Landmarks placed by rule.

**Blocked by:** 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] Terrain comes from seeded noise with an island falloff; heights are quantised to 1-voxel steps
- [ ] A World has 1–4 Isles, all connected by bridges
- [ ] Placement rules hold: House and Garden share an Isle, the Dock is on the shoreline, the Station is on its Isle's high ground
- [ ] Local rules add a path from Dock to House, stairs at single-step height changes and layered cliff cross-sections
- [ ] A layout that breaks the rules retries from a deterministically derived Seed, and retry always terminates
- [ ] The Seed picks one of four Biomes (tropical, northern, autumn, volcanic); every Biome colour has OKLCH chroma ≤ 0.10
- [ ] A Seed is a short string; empty or longer than 32 characters falls back to the default Seed
- [ ] Vitest covers all of the above over hundreds of sampled Seeds, through the generator's public function only
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
