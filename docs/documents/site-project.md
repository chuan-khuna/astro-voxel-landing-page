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
| `src/data/site.ts` | The site data module: company identity, brand colour and font, SEO defaults, default Seed, brand Biome (the Biome the default Seed always gets), the Landmark list (id, route, label, Story Order) and the Data Card metrics (`dataCards`, keyed to a placed Landmark id). `landmarksInStoryOrder` is the sorted list. |
| `src/content.config.ts` | Content collections (glob loaders): `pages` (MDX: `title`, an optional `landmark` id and an optional meta `description`) `projects` (MDX, schema `projectSchema`) and `services` (MDX, schema `serviceSchema`). |
| `src/lib/contentSchemas.ts` | Collection schemas kept apart from `content.config.ts` so Vitest can load them: `projectSchema` and `serviceSchema` (see "Projects" and "Services" below). Tested in `contentSchemas.test.ts`. |
| `src/content/projects/` | One MDX file per Project; the file name is its id and URL slug, the body its case study. Six mock Projects. |
| `src/content/services/` | One MDX file per Service; the body says more about it. Four mock Services. |
| `src/content/pages/` | `home.mdx` (the home hook) and one intro per section, found by its `landmark`: `services.mdx` (station), `about.mdx` (house), `team.mdx` (house-interior), `garden.mdx`, `dock.mdx`, `contact.mdx` (mailbox). |
| `src/world/` | The World generator. See `world-generator.md`. |
| `src/render/` | The soft-voxel renderer: mesher, TSL material, scene runtime (`mountWorld`), camera rig (pan, zoom and flights), Landmark focus and hotspots. See `rendering-and-shading.md`. |
| `src/lib/seedUrl.ts` | The Seed in the URL: `seedFromUrl`, `rollSeed` (numeric) and `withSeed` (keep the Seed on a route link). Tested in `seedUrl.test.ts`. |
| `src/lib/gardenTrees.ts` | `treeOrder(projects)`: Projects sorted by id (tree order). `gardenTrees(world, projectIds)`: the World's tree cells, each paired with its Project (tree `k` is the `k`-th Project by id; none beyond the cap). Tested in `gardenTrees.test.ts`. |
| `src/lib/landmarkRoutes.ts` | `landmarkForPath(pathname)`: the Landmark a route belongs to, from the Landmark list. A trailing slash and `index.html` are ignored, `/garden/<slug>` belongs to the Garden, and any other route gives `null`. Tested in `landmarkRoutes.test.ts`. |
| `src/components/LandmarkMenu.astro` | The HTML Landmark menu, built from the Landmark list in Story Order. Its links carry `data-seed-link`, so they keep a rolled Seed; the current section's link has `aria-current="page"`. |
| `src/components/SectionPanel.astro` | A section's panel over the World: heading, close link and the intro copy. |
| `src/components/ServiceList.astro` | The Station's list of every Service in `order`: icon, title, summary and body. |
| `src/components/ProjectList.astro` | The Garden's list of every Project in tree order: title (a link to its page), Client, year and summary. |
| `src/layouts/Base.astro` | The HTML shell: title and description (site data by default), and Astro's `<ClientRouter />`. |
| `src/layouts/WorldPage.astro` | Every page: hero, the World frame with Landmark hotspots, the Garden's tree links and the Data Cards, dice button, Landmark menu, an optional `panel` slot over the World, and the client script that runs the World across routes. |
| `src/pages/index.astro` | The home page: the World and the home hook. |
| `src/pages/[...section].astro` | One static page per section, from the Landmark list (every Landmark but the Overview): `/services`, `/about`, `/about/team`, `/garden`, `/dock`, `/contact`. The build fails if a section has no `pages` entry. The Station's page also lists every Service, the Garden's every Project. |
| `src/pages/garden/[slug].astro` | One static page per Project, `/garden/<id>`: its case study in the panel. |

Company identity, the default Seed, the Landmark list and the Data Card
metrics live only in `src/data/site.ts`. Landmark ids are typed against the generator's id lists.

## Pages and routes

Every page is the World plus, on a section page, that section's panel. The
World gets the Project count from the `projects` collection; the Client and
Partner counts are 0 until those collections exist.

- **Home (`/`):** the company name (the page's `h1`) and tagline, the World,
  the dice button with the current Seed, the Landmark menu and the home hook.
- **Section pages:** the same, with the section's panel over the World. The
  panel's heading is the page's `h1` (the company name becomes a link home),
  the title is `<section> · <company>`, and the description comes from the
  `pages` entry. The Contact panel also lists the email, phone, address and
  socials from site data.
- **Services (`/services`):** the intro copy, then every Service in `order`
  (then by id): an icon, the title, the summary and the body.
- **Garden (`/garden`):** the intro copy, then every Project in tree order
  (by id), each linking to its page. Projects beyond the Garden's 24 trees
  are listed too.
- **Project pages (`/garden/<id>`):** the panel's heading is the Project's
  title, then a link back to all Projects, the Client and year, the tags, the
  cover image if any, the summary (also the meta description) and the case
  study. The camera goes to the Garden (`/garden/<id>` belongs to it), and
  the Project's tree link is marked current.
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
- **Trees:** each Garden tree has its own link (`a.hotspot.tree[data-project]`)
  to its Project's page, labelled with the Project's title, over the middle
  of the tree. Hover or focus shows its outline and title; clicking it
  opens the Project's page and the camera goes to the Garden. When the
  camera is far out a tree is too small to aim at, and a click there opens
  the Garden instead. Tree links come right after the Garden's hotspot in
  the Tab order. See "Tree links" in `rendering-and-shading.md`.
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

## Projects

A Project is one MDX file in `src/content/projects/`. Adding a file adds
the Project to the Garden's list, gives it a page and grows a tree (up to
24). The schema (`projectSchema`, validated at build time, so a mistake
fails the build):

| Field | Type |
|---|---|
| `title` | non-empty string |
| `summary` | non-empty string: the list entry and the page's meta description |
| `client` | non-empty string: the Client's name |
| `year` | whole number, 1900–2100 |
| `tags` | list of strings, default none |
| `tree` | optional tree shape hint: `round`, `tall` or `bushy` (not drawn yet; every tree has one shape) |
| `cover` | optional `{ src, alt }`: an image under `public/` (the mock Projects have none) |

**Trees.** The World generator gets only the Project count. It lays out
one tree cell per Project, in order, up to 24. The site takes Projects in
a stable order by id (`treeOrder`), so tree `k` is the `k`-th Project by
id, and a new Project whose id sorts last adds a tree without moving the
others' Projects (it may still change the World's layout; see
`world-generator.md`).

## Services

A Service is one MDX file in `src/content/services/`; adding a file adds it
to the Station's list on `/services`. The schema (`serviceSchema`):

| Field | Type |
|---|---|
| `title` | non-empty string |
| `summary` | non-empty string: one sentence under the title |
| `icon` | `pipeline`, `model`, `chart` or `platform`: a line icon drawn by `ServiceList.astro` |
| `order` | whole number from 1: the place in the list (ties go by id) |

Services do not change the World and have no pages of their own.

## Data Cards

A Data Card floats beside a Landmark in the World and shows one company
metric. The metrics live in `site.dataCards` in `src/data/site.ts`, keyed to
a placed Landmark id (`station`, `house`, `garden`, `dock`, `mailbox`), each
a `value` (`140+`) and a `label` (`pipelines running in production`). A
Landmark with no entry has no card. Mock figures for now.

`WorldPage.astro` renders them as real text, a list (`ul.data-cards`,
labelled `<company> in figures`) of `li.data-card[data-card]` inside the
World's frame, in Story Order. They stay `hidden` until a World is shown, so
they are absent without JS. Once shown, the list is in the accessibility
tree whether or not a card is on screen; visually only one card shows at a
time, the one of the Landmark the camera is near (see
`rendering-and-shading.md`, "Data Cards"). Cards never take the pointer, so
panning and hotspots work through them. They fade in and out (200 ms; no
fade under reduced motion), and are smaller on screens under 48rem.

## Rendering

`mountWorld(canvas, world, meshed?, ui?)` renders the World as soft voxels
and returns a view whose `show` swaps in another World, whose `camera` is
the pan, zoom and flight rig, and whose `focus` flies to a Landmark. It
has a mesher with culling, baked AO and greedy merging, a TSL material for
seams, bevel and colour jitter, a static sun shadow map, and frames only on
demand (only while the camera moves). See `rendering-and-shading.md`.
