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
| `src/content.config.ts` | Content collections. Only `pages` for now (MDX): `title`, an optional `landmark` id and an optional meta `description`. |
| `src/content/pages/` | `home.mdx` (the home hook) and one intro per section, found by its `landmark`: `services.mdx` (station), `about.mdx` (house), `team.mdx` (house-interior), `garden.mdx`, `dock.mdx`, `contact.mdx` (mailbox). |
| `src/world/` | The World generator. See `world-generator.md`. |
| `src/render/` | The soft-voxel renderer: mesher, TSL material, scene runtime (`mountWorld`), camera rig (pan, zoom and flights), Landmark focus and hotspots. See `rendering-and-shading.md`. |
| `src/lib/seedUrl.ts` | The Seed in the URL: `seedFromUrl`, `rollSeed` (numeric) and `withSeed` (keep the Seed on a route link). Tested in `seedUrl.test.ts`. |
| `src/lib/landmarkRoutes.ts` | `landmarkForPath(pathname)`: the Landmark a route belongs to, from the Landmark list. A trailing slash and `index.html` are ignored, `/garden/<slug>` belongs to the Garden, and any other route gives `null`. Tested in `landmarkRoutes.test.ts`. |
| `src/components/LandmarkMenu.astro` | The HTML Landmark menu, built from the Landmark list in Story Order. Its links carry `data-seed-link`, so they keep a rolled Seed; the current section's link has `aria-current="page"`. |
| `src/components/SectionPanel.astro` | A section's panel over the World: heading, close link and the intro copy. |
| `src/layouts/Base.astro` | The HTML shell: title and description (site data by default), and Astro's `<ClientRouter />`. |
| `src/layouts/WorldPage.astro` | Every page: hero, the World frame with Landmark hotspots, dice button, Landmark menu, an optional `panel` slot over the World, and the client script that runs the World across routes. |
| `src/pages/index.astro` | The home page: the World and the home hook. |
| `src/pages/[...section].astro` | One static page per section, from the Landmark list (every Landmark but the Overview): `/services`, `/about`, `/about/team`, `/garden`, `/dock`, `/contact`. The build fails if a section has no `pages` entry. |

Company identity, the default Seed and the Landmark list live only in
`src/data/site.ts`. Landmark ids are typed against the generator's id lists.

## Pages and routes

Every page is the World plus, on a section page, that section's panel. The
counts are all 0 until the Project, Client and Partner collections exist.

- **Home (`/`):** the company name (the page's `h1`) and tagline, the World,
  the dice button with the current Seed, the Landmark menu and the home hook.
- **Section pages:** the same, with the section's panel over the World. The
  panel's heading is the page's `h1` (the company name becomes a link home),
  the title is `<section> · <company>`, and the description comes from the
  `pages` entry. The Contact panel also lists the email, phone, address and
  socials from site data.
- **Panel:** a side panel over the right of the World on screens 48rem and
  wider (`min(24rem, 42%)` wide), and a bottom sheet (up to 55dvh) on
  narrower ones; the page gets bottom padding so the sheet never hides its
  end. It slides in, with no animation under reduced motion. Its close link
  goes to `/` and keeps the Seed; Escape does the same.
- **Without JS** every page is complete static HTML: the panel's copy is
  there, and the close link and menu are plain links.

### Routes over the World (ADR 0003)

Astro's client router (`<ClientRouter />`) handles same-origin links. The
World frame (`transition:persist="world"`) and its controls
(`transition:persist="world-controls"`) are persisted. The router moves the
same canvas, WebGPU renderer, meshes, camera and hotspots into each new
page; only the panel, the menu and the rest of the page are swapped. Page
cross-fades are off (`transition:animate="none"` on `<html>`), so the World
never flickers.

This was proved first, on Astro 7.4 in Chrome with the WebGPU backend.
Across hotspot and menu clicks, Back, Forward and Seed rolls, the canvas is
the same element, it keeps rendering, and nothing logs an error. The
spec's fallback (the panel fetching page content itself) was not needed.

The client script in `WorldPage.astro` runs once per visit and follows the
route on every `astro:after-swap`:

- **Clicking a Landmark** (a hotspot or a menu link) navigates to its route.
  Once the page is swapped in, the camera flies to the Landmark
  (`view.focus`, 900 ms, a cut under reduced motion) and focus moves to the
  panel. The Landmark lands in the middle of the part of the frame the
  panel leaves free.
- **Closing** (the close link, Escape, Back, or the Overview in the menu)
  navigates to `/`, and the camera flies back to where it was before the
  first section opened. If the visit started on a section page, it flies to
  the Overview.
- **Moving between sections** flies from one Landmark to the next. The
  World view to return to is still the one from before the first section.
- **Opening a route directly** mounts the World and cuts the camera to the
  route's Landmark, with the page's panel already open.
- **Back and Forward** are ordinary router navigations, so they move between
  sections and the World in the same way.

### Exploring the World

- The canvas sits in `#world-frame` (`.world`), which takes the input:
  drag to pan, wheel or trackpad pinch to zoom toward the cursor; on touch,
  one finger pans and two fingers pinch-zoom. Pan stops at the World's
  bounds and zoom runs from the Overview in to a close-up. The frame has
  `touch-action: none`, so gestures on the World never scroll or zoom the
  page (the page still scrolls from outside the World), and the wheel over
  the World zooms instead of scrolling. Pan or zoom input stops a flight.
- Each page renders one hotspot link per placed Landmark inside the frame
  (`a.hotspot[data-hotspot]`, with `data-seed-link`), hidden until the World
  is shown. The World keeps each over its Landmark's model. Hover or keyboard
  focus shows an outline and the Landmark's label; they come first in the
  Tab order, before the dice button and the Landmark menu. A drag that starts
  on a hotspot pans and does not follow the link. The open panel covers any
  hotspot under it.
- The script passes the frame and hotspots to `mountWorld(canvas, world,
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
  request is shown, so fast rolls never show a stale World. A new World
  starts at its Overview, then cuts to the open section's Landmark, if any.
- **Dice button** ("Roll a new World", a real `<button>` with a visible
  label and focus ring): rolls a numeric Seed different from the current
  one (`rollSeed`) and navigates to the same route with `?seed=` set
  (`navigate` from `astro:transitions/client`). Each roll is a history
  entry, and an open panel stays open. Back returns to the previous World:
  after each page swap the script compares the URL's Seed with the one on
  show and loads it if they differ (a cache hit). The Seed is announced in a
  polite live region next to the button, and the World frame gets
  `aria-busy` while a World is loading.
- **Seed across routes:** after each World is shown and after each page
  swap, every `a[data-seed-link]` is rewritten with `withSeed`, e.g.
  `/garden?seed=1234`. The default Seed is left out of links.

## Rendering

`mountWorld(canvas, world, meshed?, ui?)` renders the World as soft voxels
and returns a view whose `show` swaps in another World, whose `camera` is
the pan, zoom and flight rig, and whose `focus` flies to a Landmark. It
has a mesher with culling, baked AO and greedy merging, a TSL material for
seams, bevel and colour jitter, a static sun shadow map, and frames only on
demand (only while the camera moves). See `rendering-and-shading.md`.
