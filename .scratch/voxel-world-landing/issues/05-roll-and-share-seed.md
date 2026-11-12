# 05: Roll and share a Seed

**What to build:** A visitor clicks a dice button and gets a brand-new World without the page freezing, and can share it by URL.

**Blocked by:** 03

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] A dice button rolls a new numeric Seed and regenerates the World
- [x] The URL updates with `?seed=`, and opening that URL shows the same World
- [x] Generation runs in a Web Worker, finishes within 1 second, and results are cached per Seed
- [x] With no `?seed=`, the default Seed from the site data module is used
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

## Comments

- 2026-11-11: Done. `site/src/render/world.worker.ts` generates and meshes in a Web Worker (mesh buffers transferred); `worldSource.ts` caches per Seed + counts (16 most recent). `mountWorld` now returns a view with `show(world, meshed)` that disposes the old World's geometry/materials and refreshes the static shadow map once. Dice button uses `history.pushState` (Back returns to the previous World via `popstate`). `site/src/lib/seedUrl.ts` adds `seedFromUrl`, `rollSeed` and `withSeed`; Landmark menu links (`data-seed-link`) keep a rolled Seed, e.g. `/garden?seed=1234`. Verified in headless Chrome (WebGPU and WebGL 2): different `?seed=` values give different Worlds, roll updates URL and World, the shared URL reloads to the same World, worker time 15–55 ms, max frame gap during a roll ~20 ms, no console errors. Generator unchanged.
