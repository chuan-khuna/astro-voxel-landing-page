# Documents

One bullet per document in `docs/documents/`: `- Title — one-line summary`.

- [Site project](site-project.md) — the Astro site in `site/`: stack, commands, file layout, pages and routes over the persisted World (side panel and bottom sheet, camera flights, Back and Forward), exploring the World, Seed in the URL and the dice button.
- [World generator](world-generator.md) — `generateWorld(seed, contentCounts)`: interface, World data shape, terrain, Isles, bridges, paths, Landmark footprints (levelling, occlusion, the Garden's trees), Biomes, retry and tests.
- [Rendering and shading](rendering-and-shading.md) — World to pixels: voxel grids, the mesher (culling, AO, greedy merge, chunks), the soft-voxel TSL material, Landmark models that fill their footprints, sea, the World Web Worker and cache, scene runtime (swapping Worlds, render on demand), camera pan and zoom with bounds, Landmark focus and camera flights, Landmark hotspots and the triangle budget.
