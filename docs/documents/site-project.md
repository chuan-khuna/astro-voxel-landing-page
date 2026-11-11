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
| `src/data/site.ts` | The site data module: company identity, brand colour and font, SEO defaults, default Seed, and the Landmark list (id, route, label, Story Order). `landmarksInStoryOrder` is the sorted list. |
| `src/content.config.ts` | Content collections. Only `pages` for now (MDX): `title` and an optional `landmark` id. |
| `src/content/pages/home.mdx` | The home hook copy. |
| `src/world/` | The World generator. See `world-generator.md`. |
| `src/render/mountWorld.ts` | The basic three.js render of a World. |
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

## Basic render

`mountWorld(canvas, world)` is a placeholder until the soft-voxel renderer (ticket 04):

- `WebGPURenderer` from `three/webgpu`; it falls back to WebGL 2 by itself.
- An orthographic camera on the true isometric axis (1, 1, 1), framed on the
  Overview view so the whole Isle fits at any aspect ratio.
- Terrain is one instanced box per land cell, over a flat sea plane.
- Each placed Landmark is a plain coloured placeholder block. Its colour and
  height are set in the render module.
- Node materials only (`MeshLambertNodeMaterial`), lit by a hemisphere light and one directional light.
- Frames render on demand: once on mount, then again only when the canvas resizes.
- Colours are fixed placeholders until Biomes (ticket 03) arrive.
