# Site project

The corporate landing site is an Astro project in `site/`, separate from the
docs and skills at the repo root.

## Stack

| Package | Version |
|---|---|
| astro | 7.4.5 |
| @astrojs/mdx | 8.1.2 |
| three | 0.187.0 (`three/webgpu`) |
| vitest | 5.1.0 |
| @astrojs/check | 0.9.12 |
| typescript | 6.0.x (`@astrojs/check` does not support TypeScript 7) |

- bun is the package manager. `bunfig.toml` and `.npmrc` set a 7-day minimum
  release age, so newer releases are skipped on install.
- TypeScript extends `astro/tsconfigs/strict`.
- Output is static (`output: 'static'`), with no adapter or host.

## Commands

```sh
cd site
bun install
bun run dev      # dev server
bun run check    # astro check
bun run test     # vitest run
bun run build    # static build into site/dist
bun run preview  # serve the build (Astro 7 runs it in the background; stop with `bunx astro preview stop`)
```

## Layout

| Path | What it holds |
|---|---|
| `src/data/site.ts` | The site data module: company identity, brand colour and font, SEO defaults, default Seed, brand Biome (the Biome the default Seed always gets), and the Landmark list (id, route, label, Story Order). `landmarksInStoryOrder` is the sorted list. |
| `src/content.config.ts` | Content collections. Only `pages` for now (MDX): `title` and an optional `landmark` id. |
| `src/content/pages/home.mdx` | The home hook copy. |
| `src/world/` | The World generator. See `world-generator.md`. |
| `src/render/` | The soft-voxel renderer: mesher, TSL material, scene runtime (`mountWorld`). See `rendering-and-shading.md`. |
| `src/components/LandmarkMenu.astro` | The HTML Landmark menu, built from the Landmark list in Story Order. |
| `src/layouts/Base.astro` | The HTML shell: title and description from site data. |
| `src/pages/index.astro` | The home page. |

Company identity, the default Seed and the Landmark list live only in
`src/data/site.ts`. Landmark ids are typed against the generator's id lists.

## Home page

The home page shows the company name and tagline, the World canvas, the
Landmark menu and the home hook. A client script reads the Seed and content
counts from the canvas's `data-` attributes, calls `generateWorld`, and
passes the World to `mountWorld`. The counts are all 0 until the Project,
Client and Partner collections exist.

The menu links to every Landmark route, but only `/` exists yet; the other
routes arrive in ticket 07.

## Rendering

`mountWorld(canvas, world)` renders the World as soft voxels: a mesher with
culling, baked AO and greedy merging, a TSL material for seams, bevel and
colour jitter, a static sun shadow map, and frames only on demand. See
`rendering-and-shading.md`.
