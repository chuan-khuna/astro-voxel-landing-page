# 02: Tracer bullet: Astro site, World generator and a basic render

**What to build:** A visitor opens the home page and sees a minimal generated World with an HTML Landmark menu beneath it. This lays the thinnest path through every layer: the Astro 7 project in its own subfolder, the site data module with mock company identity, the `pages` collection, a pure `generateWorld(seed, contentCounts)` returning World data, and a three.js render of it.

**Blocked by:** None (can start immediately)

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] The Astro project exists in its own subfolder with bun (7-day minimum release age), strict TypeScript and static output
- [x] The site data module holds the mock company name, tagline, default Seed and the Landmark list (id, route, label, Story Order); nothing of these is hardcoded elsewhere
- [x] The World generator is pure (no three.js, no DOM, no `Math.random`) and returns one flat Isle with the five placed Landmarks and the two derived views (Overview, House Interior)
- [x] The home page renders that World with `WebGPURenderer` and an isometric orthographic camera; Landmarks are simple placeholder blocks
- [x] An HTML Landmark menu generated from the Landmark list is on the page
- [x] Vitest tests pass: the same Seed gives a deep-equal World, and every placed Landmark is present exactly once
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

## Comments

**2026-11-11 — implemented; awaiting commit.** Every box is met. The triage vocabulary has no "done" label, so Status uses `resolved`, the done state in `docs/agents/issue-tracker.md`.

What's built (in `site/`):
- Astro 7.4.5, @astrojs/mdx 8.1.2, three 0.187.0, vitest 5.1.0, @astrojs/check 0.9.12 and TypeScript 6.0.3, installed with bun under a 7-day minimum release age (`bunfig.toml` and `.npmrc`). Astro 7.4.10 and mdx 8.1.4 exist but are less than 7 days old. TypeScript 7 does not meet `@astrojs/check`'s peer range, so TypeScript is 6.
- `src/data/site.ts`: the mock company "Lanternfish Data", the tagline, the brand colour and font, SEO defaults, the default Seed `lanternfish`, and the Landmark list.
- The `pages` collection (`src/content.config.ts`) holds the home hook in `src/content/pages/home.mdx`.
- `src/world/`: the pure `generateWorld(seed, contentCounts)`. It makes one flat Isle with the five placed Landmarks (the Dock on the shore) and derives the Overview and House Interior views.
- `src/render/mountWorld.ts`: `WebGPURenderer`, a true-isometric orthographic camera, instanced terrain columns, a sea plane and placeholder Landmark blocks. It renders on demand.
- `LandmarkMenu.astro`: the menu, in Story Order.

Checked: `bun run test` gives 10 passing, `astro check` gives 0 errors, 0 warnings and 0 hints, and `astro build` emits `/index.html`. Headless Chrome shows no console errors on WebGPU. With WebGPU removed, the only message is three's expected "running under WebGL2 backend" warning.

Notes for later tickets:
- Only `/` exists, so the menu's other links 404 until ticket 07.
- Content counts are passed as 0 until the content collections exist.
- `astro build` warns that the three.js chunk is over 500 kB.
- Docs: `docs/documents/world-generator.md`, `docs/documents/site-project.md`.
