# 03: Terrain, Isles and Biomes

**What to build:** Different Seeds give visibly different Worlds: one to four Isles with stepped heights, bridges, paths and stairs, in one of four muted Biomes, with Landmarks placed by rule.

**Blocked by:** 02

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] Terrain comes from seeded noise with an island falloff; heights are quantised to 1-voxel steps
- [x] A World has 1–4 Isles, all connected by bridges
- [x] Placement rules hold: House and Garden share an Isle, the Dock is on the shoreline, the Station is on its Isle's high ground
- [x] Local rules add a path from Dock to House, stairs at single-step height changes and layered cliff cross-sections
- [x] A layout that breaks the rules retries from a deterministically derived Seed, and retry always terminates
- [x] The Seed picks one of four Biomes (tropical, northern, autumn, volcanic); every Biome colour has OKLCH chroma ≤ 0.10
- [x] A Seed is a short string; empty or longer than 32 characters falls back to the default Seed
- [x] Vitest covers all of the above over hundreds of sampled Seeds, through the generator's public function only
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

## Comments

- Implemented in `site/src/world/` (`terrain.ts`, `noise.ts`, `bridges.ts`, `paths.ts`, `biomes.ts`); World data gains `attempts`, `biome`, `terrain.surface`, `strata`, `bridges`, `paths`, `stairs`. 28 Vitest tests over 200 sampled Seeds, all through `generateWorld`.
- Default Seed → brand Biome: a rule, not a lucky Seed. `site.brandBiome` (tropical) is in the site data module; the generator gives it to the default Seed whatever the Seed string is, so changing `defaultSeed` keeps the brand Biome.
- Retry ends in a safe layout (one round, noise-free, terraced Isle) after 8 noise layouts. ~3 in 10 Seeds retry; the safe layout is hit ~1 in 20k Seeds, so it is not reachable from the sampled Seeds; it was checked by forcing it and running the rule suite (all rules held).
- Stairs are placed only along the Dock-to-House path, not at every single-step change in the terrain.
- Render: per-voxel instanced boxes coloured from the Biome (surface, path, strata), bridge decks, stairs, shallow/deep water. No meshing/TSL (ticket 04).
