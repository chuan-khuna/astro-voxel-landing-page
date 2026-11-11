# 02: Tracer bullet: Astro site, World generator and a basic render

**What to build:** A visitor opens the home page and sees a minimal generated World with an HTML Landmark menu beneath it. This lays the thinnest path through every layer: the Astro 7 project in its own subfolder, the site data module with mock company identity, the `pages` collection, a pure `generateWorld(seed, contentCounts)` returning World data, and a three.js render of it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] The Astro project exists in its own subfolder with pnpm, strict TypeScript and static output
- [ ] The site data module holds the mock company name, tagline, default Seed and the Landmark list (id, route, label, Story Order); nothing of these is hardcoded elsewhere
- [ ] The World generator is pure (no three.js, no DOM, no `Math.random`) and returns one flat Isle with the five placed Landmarks and the two derived views (Overview, House Interior)
- [ ] The home page renders that World with `WebGPURenderer` and an isometric orthographic camera; Landmarks are simple placeholder blocks
- [ ] An HTML Landmark menu generated from the Landmark list is on the page
- [ ] Vitest tests pass: the same Seed gives a deep-equal World, and every placed Landmark is present exactly once
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
