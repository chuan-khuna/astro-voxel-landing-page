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
| `src/render/` | The soft-voxel renderer: mesher, TSL material, scene runtime (`mountWorld`), camera rig (pan and zoom) and Landmark hotspots. See `rendering-and-shading.md`. |
| `src/lib/seedUrl.ts` | The Seed in the URL: `seedFromUrl`, `rollSeed` (numeric) and `withSeed` (keep the Seed on a route link). Tested in `seedUrl.test.ts`. |
| `src/components/LandmarkMenu.astro` | The HTML Landmark menu, built from the Landmark list in Story Order. Its links carry `data-seed-link`, so they keep a rolled Seed. |
| `src/layouts/Base.astro` | The HTML shell: title and description from site data. |
| `src/pages/index.astro` | The home page: hero, World frame with Landmark hotspots, dice button, Landmark menu, hook. |

Company identity, the default Seed and the Landmark list live only in
`src/data/site.ts`. Landmark ids are typed against the generator's id lists.

## Home page

The home page shows the company name and tagline, the World canvas, the
dice button with the current Seed, the Landmark menu and the home hook.
The counts are all 0 until the Project, Client and Partner collections exist.

### Exploring the World

- The canvas sits in `#world-frame` (`.world`), which takes the input:
  drag to pan, wheel or trackpad pinch to zoom toward the cursor; on touch,
  one finger pans and two fingers pinch-zoom. Pan stops at the World's
  bounds and zoom runs from the Overview in to a close-up. The frame has
  `touch-action: none`, so gestures on the World never scroll or zoom the
  page (the page still scrolls from outside the World), and the wheel over
  the World zooms instead of scrolling.
- The page renders one hotspot link per placed Landmark inside the frame
  (`a.hotspot[data-hotspot]`, with `data-seed-link`), hidden until the World
  is shown. The World keeps each over its Landmark's model. Hover or keyboard
  focus shows an outline and the Landmark's label; they come first in the
  Tab order, before the dice button and the Landmark menu. A drag that starts
  on a hotspot pans and does not follow the link.
- The page passes the frame and hotspots to `mountWorld(canvas, world,
  meshed, { frame, hotspots })`. See "Camera and interaction" in
  `rendering-and-shading.md`.

### Seed in the URL

- **On load:** the Seed comes from `?seed=`; with none (or an empty one) it
  is the default Seed from the site data module (`data-default-seed` on the
  canvas). An over-long Seed falls back to the default inside the generator,
  and the page shows the Seed actually used.
- **Generation:** the client script asks `createWorldSource()` for the World;
  it is generated and meshed in a Web Worker and cached per Seed (see
  `rendering-and-shading.md`). The first World mounts the scene with
  `mountWorld`; later Worlds are swapped in with `view.show`. Only the latest
  request is shown, so fast rolls never show a stale World.
- **Dice button** ("Roll a new World", a real `<button>` with a visible
  label and focus ring): rolls a numeric Seed different from the current
  one (`rollSeed`), sets `?seed=` with `history.pushState`, and shows the new
  World. pushState was chosen so each roll is a history entry: Back returns
  to the previous World (`popstate` reloads the Seed from the URL, a cache
  hit). The Seed is announced in a polite live region next to the button,
  and the World container gets `aria-busy` while a World is loading.
- **Seed across routes:** after each World is shown, every `a[data-seed-link]`
  is rewritten with `withSeed`, e.g. `/garden?seed=1234`. The default Seed is
  left out of links. Later pages should read the Seed the same way.

The menu links to every Landmark route, but only `/` exists yet; the other
routes arrive in ticket 07.

## Rendering

`mountWorld(canvas, world, meshed?, ui?)` renders the World as soft voxels
and returns a view whose `show` swaps in another World and whose `camera`
is the pan-and-zoom rig: a mesher with culling, baked AO and greedy
merging, a TSL material for seams, bevel and colour jitter, a static sun
shadow map, and frames only on demand (only while the camera moves). See
`rendering-and-shading.md`.
