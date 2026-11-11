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
| `src/data/site.ts` | The site data module: company identity, brand colour and fonts (`brand.fonts.body` Jersey 20, `brand.fonts.heading` Jersey 15, each with a fallback stack), SEO defaults, default Seed, brand Biome (the Biome the default Seed always gets), the Landmark list (id, route, label, Story Order) and the Data Card metrics (`dataCards`, keyed to a placed Landmark id). `landmarksInStoryOrder` is the sorted list. |
| `src/data/theme.ts` | The Day and Night theme tokens (`THEME_TOKENS`): one set of OKLCH values for the page (`ui`: ink, paper, surface, brand ink and its hover, text on brand, shadow) and for the World (`world`: sky, sun or moon light, sky and ground light, water darkening, the House's window light and the buoys' lamp light, and `lightsOn`). `themeCss()` writes the `ui` tokens as CSS custom properties; `seaColour` is a Biome's water in a theme; `contrastRatio` is the WCAG ratio. Tested in `theme.test.ts` (every text pair AA in both themes). |
| `src/content.config.ts` | Content collections (glob loaders): `pages` (MDX: `title`, an optional `landmark` id and an optional meta `description`) `projects` (MDX, schema `projectSchema`), `services` (MDX, schema `serviceSchema`), `clients` (YAML, schema `clientSchema`), `partners` (YAML, schema `partnerSchema`) and `team` (MDX, schema `teamMemberSchema`). |
| `src/lib/contentSchemas.ts` | Collection schemas kept apart from `content.config.ts` so Vitest can load them: `projectSchema`, `serviceSchema`, `clientSchema`, `partnerSchema` and `teamMemberSchema` (see "Projects", "Services", "Clients and Partners" and "Team" below). Tested in `contentSchemas.test.ts`. |
| `src/content/projects/` | One MDX file per Project; the file name is its id and URL slug, the body its case study. Six mock Projects. |
| `src/content/services/` | One MDX file per Service; the body says more about it. Four mock Services. |
| `src/content/clients/` | One YAML file per Client; the file name is its id. Six mock Clients, the organisations the mock Projects were for. |
| `src/content/partners/` | One YAML file per Partner; the file name is its id. Three fictional Partners. |
| `src/content/team/` | One MDX file per Team Member; the body is a short bio. Four mock Team Members. |
| `src/content/pages/` | `home.mdx` (the home hook) and one intro per section, found by its `landmark`: `services.mdx` (station), `about.mdx` (house), `team.mdx` (house-interior), `garden.mdx`, `dock.mdx`, `contact.mdx` (mailbox). |
| `src/world/` | The World generator. See `world-generator.md`. |
| `src/render/` | The soft-voxel renderer: mesher, TSL material, scene runtime (`mountWorld`), camera rig (pan, zoom and flights), Landmark focus and hotspots. See `rendering-and-shading.md`. |
| `src/lib/theme.ts` | Which theme shows: `ThemeChoice` (`auto`, `day`, `night`), `parseThemeChoice` (a stored value; Auto for anything else), `resolveTheme(choice, prefersDark)`, `nextThemeChoice` (Auto → Day → Night → Auto) and `themeBootScript`, the inline `<head>` script. Tested in `theme.test.ts` (the boot script runs against a fake page). |
| `src/lib/renderStats.ts` | The render stats overlay's rules: `statsAvailable(dev, url)` (in `astro dev`, or with `?stats`), `parseStatsOn` (the stored on or off) and `withStats` (keep `?stats` on a route link). Tested in `renderStats.test.ts`. See "Render stats". |
| `src/lib/seedUrl.ts` | The Seed in the URL: `seedFromUrl`, `rollSeed` (numeric) and `withSeed` (keep the Seed on a route link). Tested in `seedUrl.test.ts`. |
| `src/lib/gardenTrees.ts` | `treeOrder(projects)`: Projects sorted by id (tree order). `gardenTrees(world, projectIds)`: the World's tree cells, each paired with its Project (tree `k` is the `k`-th Project by id; none beyond the cap). Tested in `gardenTrees.test.ts`. |
| `src/lib/contactDetails.ts` | `contactDetails(company)`: the Contact panel's details, from `site.company`: email, phone, address, then each social, each with a label, the text shown and a link (none for the address). Tested in `contactDetails.test.ts`. |
| `src/lib/landmarkRoutes.ts` | `landmarkForPath(pathname)`: the Landmark a route belongs to, from the Landmark list. A trailing slash and `index.html` are ignored, `/garden/<slug>` belongs to the Garden, and any other route gives `null`. `routeView(id)`: what the World shows for it: the Landmark the camera goes to, and whether the House is open (About and Team both open it and go to the House Interior). Tested in `landmarkRoutes.test.ts`. |
| `src/components/LandmarkMenu.astro` | The HTML Landmark menu, built from the Landmark list in Story Order: a floating rounded bar, collapsing below 64rem into a menu button that opens the list as a popover (the Popover API, so it needs no JS). Its links carry `data-seed-link`, so they keep a rolled Seed; the current section's link has `aria-current="page"`. |
| `src/components/ThemeToggle.astro` | The theme toggle: one icon button (a monitor, a sun or a moon, for the choice in force) that cycles Auto, Day and Night, and the script that keeps the choice (see "Day and Night"). |
| `src/components/Logo.astro` | The logo mark beside the company name: one isometric voxel in three shades of the brand colour. |
| `src/components/SectionPanel.astro` | A section's panel over the World, as a floating card: heading, close link and the intro copy. |
| `src/components/ServiceList.astro` | The Station's list of every Service in `order`: icon, title, summary and body. |
| `src/components/ProjectList.astro` | The Garden's list of every Project in tree order: title (a link to its page), Client, year and summary. |
| `src/components/DockList.astro` | The Dock's two lists: Clients (by id) and Partners (closest tier first), each with its logo or initials. |
| `src/components/TeamList.astro` | Team's list of every Team Member in `order`: avatar or initials, name, role and bio. |
| `src/components/ContactList.astro` | Contact's details (`contactDetails`) as a definition list in an `<address>`. |
| `src/layouts/Base.astro` | The HTML shell: title and description (site data by default), Astro's `<ClientRouter />`, the self-hosted Jersey fonts, the theme's boot script and colour tokens (`themeBootScript`, `themeCss()`, both inline in `<head>`), the card and font tokens, and the inline script that turns on the full-screen layout (`data-world="live"`). |
| `src/layouts/WorldPage.astro` | Every page: the full-screen World frame with Landmark hotspots, the developer's link inside the House, the Garden's tree links and the Data Cards, and the HUD floating over it (company name, theme toggle, Landmark menu, the section's panel in the `panel` slot or the Overview's intro, dice button), and the client script that runs the World across routes. |
| `src/pages/index.astro` | The home page: the World and the home hook. |
| `src/pages/[...section].astro` | One static page per section, from the Landmark list (every Landmark but the Overview): `/services`, `/about`, `/about/team`, `/garden`, `/dock`, `/contact`. The build fails if a section has no `pages` entry. The Station's page also lists every Service, the Garden's every Project, the Dock's every Client and Partner, Team's every Team Member, and Contact the company's contact details; About links on to Team. |
| `src/pages/garden/[slug].astro` | One static page per Project, `/garden/<id>`: its case study in the panel. |

Company identity, the fonts, the default Seed, the Landmark list and the
Data Card metrics live only in `src/data/site.ts`. Landmark ids are typed against the generator's id lists.

## Pages and routes

Every page is the World plus, on a section page, that section's panel. The
World gets its content counts from the collections: Projects, Clients and
Partners. Team Members do not change the World.

- **Home (`/`):** the company name (the page's `h1`), the World, the dice
  button with the current Seed, the Landmark menu, and the intro card: the
  tagline and the home hook.
- **Section pages:** the same, with the section's panel over the World. The
  panel's heading is the page's `h1` (the company name becomes a link home),
  the title is `<section> · <company>`, and the description comes from the
  `pages` entry.
- **Services (`/services`):** the intro copy, then every Service in `order`
  (then by id): an icon, the title, the summary and the body.
- **Garden (`/garden`):** the intro copy, then every Project in tree order
  (by id), each linking to its page. Projects beyond the Garden's 24 trees
  are listed too.
- **Dock (`/dock`):** the intro copy, then two groups, each with its own
  heading: **Clients** (moored at the Dock, one boat each), in order by id,
  each with its logo or initials, name and industry; and **Partners**
  (sailing between the Isles, one ship each), closest tier first, each with
  its logo or initials, name and tier. Clients beyond the Dock's 12 boats
  are listed too.
- **About (`/about`):** the intro copy, then a "Meet the Team →" link to
  `/about/team`. The House opens beside the panel (see "Routes over the
  World").
- **Team (`/about/team`):** the intro copy, then every Team Member in
  `order` (then by id): their avatar (or initials), name, role and bio.
  The House stays open, and the developer's link in it is marked current.
- **Contact (`/contact`):** the intro copy, then the company's contact
  details from site data (`contactDetails`), in an `<address>`: email
  (a `mailto:` link), phone (a `tel:` link, digits and a leading `+` only),
  address (plain text) and each social (a link shown without its scheme,
  `rel="me noopener"`). Information only: there is no form and nothing is
  submitted. The camera goes to the Mailbox.
- **Project pages (`/garden/<id>`):** the panel's heading is the Project's
  title, then a link back to all Projects, the Client and year, the tags, the
  cover image if any, the summary (also the meta description) and the case
  study. The camera goes to the Garden (`/garden/<id>` belongs to it), and
  the Project's tree link is marked current.
- **Panel:** a floating card; see "Full-screen layout" below. It slides
  in, with no animation under reduced motion. Its close link goes to `/`
  and keeps the Seed; Escape does the same (an open menu popover takes
  Escape first).
- **Without JS** every page is complete static HTML: the panel's copy is
  there, and the close link and menu are plain links.

## Full-screen layout

The World fills the viewport, edge to edge (`100dvh`, no frame), and the
page does not scroll. Every UI element floats over it as a card (6px
radius, the `--card` paper at 95%, a soft shadow), haru-ni style:

| Where | What |
|---|---|
| Top left | The logo mark and company name (the `h1` on the Overview, a link home on a section page). |
| Top right | The theme toggle (one icon button), then the Landmark menu: a rounded bar; below 64rem a menu button that opens it as a popover (the bar, the toggle and the name need about 1,018px). The current section is marked (`aria-current`). |
| Bottom left | The dice button and the current Seed. |
| Right, below the menu (48rem and wider) | A section's panel: `min(27rem, 42vw)` wide, as tall as its content and no taller than the screen; long content scrolls inside it. |
| Left, below the name (48rem and wider) | The Overview's intro card: the tagline and the home hook. |
| Bottom (narrower than 48rem) | The panel or the intro as a bottom sheet (up to 55dvh; the intro 40dvh), with the dice row just above it. |

- **HUD.** `.hud` is a fixed, full-screen column with
  `pointer-events: none`: `.hud-bar` (name, and `.hud-tools`: the theme toggle and the menu), then `.hud-main`, a
  grid for the panel or intro and the controls. Only the cards take the
  pointer, so the World can be dragged anywhere else. The World frame is
  fixed behind it all. The DOM order (name, menu, panel or intro, the
  World's hotspots, dice) is the Tab order.
- **Only with a World.** The full-screen layout is on only while
  `<html data-world="live">`. An inline script in `Base.astro` sets it
  before first paint when the browser has WebGPU or WebGL 2. The World's
  script carries it across route swaps (`astro:before-swap`), does not
  mount without it, and removes it if the World fails to mount. Without it
  (no JS, or no GPU) the page is a normal page that scrolls: the same cards
  stacked in a 64rem column, with the World and the dice hidden. It is
  never a locked, empty screen.
- **Camera framing.** Every card that covers the World carries
  `data-covers-world` (the top bar, the panel, the intro, the controls).
  `freeCentre(frame, covers)` (`src/render/freeArea.ts`, tested) finds the
  middle of the part they leave free. A band across the frame takes a strip
  off the top or bottom, a column a strip off one side, each on its far
  side from the larger free part, larger cards first; small corner cards
  are ignored. The camera flies each Landmark there (`view.focus` with
  `at`), and `view.setViewCentre` makes the pan bounds hold the ground
  seen there, so a Landmark at the edge of the World still lands beside the
  panel or above the sheet. It is measured again on each route and on
  resize.
- **Fonts.** Jersey 20 for body text (20px, line height 1.3, never below
  16px) and Jersey 15 for headings (`h1`–`h3`, `dt`, card titles and the
  company name, at multiples of 15px), from `@fontsource/jersey-20` and
  `@fontsource/jersey-15` (self-hosted, `font-display: swap`). Each has
  one weight, so `font-synthesis: none` and nothing is set bold. The font
  stacks live in site data and reach CSS as `--font-body` and
  `--font-heading`.
- **Contrast (WCAG AA).** `--brand-ink` (a theme token: the brand colour
  darkened by Day, lightened by Night) is used for brand-coloured text and
  for backgrounds under `--on-brand` text: links, the tagline, Data Card
  figures, the dice, hovered menu links and hotspot labels. Every text pair
  meets AA in both themes (`theme.test.ts`); see "Day and Night".

### Day and Night

The page and the World follow the visitor's light or dark preference, and
the theme toggle overrides it.

- **Tokens.** One set of OKLCH tokens, `THEME_TOKENS` in
  `src/data/theme.ts`, drives both the CSS and the three.js World.
  `Base.astro` inlines `themeCss()`: the Day tokens on `:root`, the Night
  tokens on `:root[data-theme="night"]` and, before any script (or without
  JS), on `:root:not([data-theme])` when the system prefers dark. Each sets
  `color-scheme` too. The cards, panels, menu, toggle, Data Cards and
  hotspot labels use only these variables (`--ink`, `--paper`,
  `--surface`, `--brand-ink`, `--brand-ink-hover`, `--on-brand`,
  `--shadow`); the brand colour itself (`--brand`, site data) is the same
  in both themes.
- **Contrast.** By Day: body text 13.4:1 on the cards, brand ink 7.0:1, text
  on the brand ink 7.2:1 (10.6:1 hovered). By Night: body text 13.1:1, brand
  ink 8.4:1, text on the brand ink 9.4:1 (11.8:1 hovered). `theme.test.ts` checks every pair at 4.5:1 or more.
- **The toggle** (`ThemeToggle.astro`), at the top right before the menu:
  one icon button that cycles Auto (a monitor), Day (a sun) and Night (a
  moon); its `aria-label` and tooltip name the choice in force and the
  next (`Theme: Auto (follows your system). Switch to Day`). Day and Night
  are kept in `localStorage` (`theme`); Auto clears it. Storage is
  wrapped in try/catch, so a blocked store keeps the choice for the visit.
  The toggle needs JS, so it is hidden without it.
- **No flash.** `themeBootScript`, inline in `<head>`, sets
  `<html data-theme>` (`day` or `night`) and `data-theme-choice` before
  first paint, from the stored choice and `prefers-color-scheme`. The
  toggle's script carries both across route swaps (`astro:before-swap`),
  re-labels the new page's toggle (`astro:after-swap`), and in Auto follows
  a change of the system preference live.
- **The World** follows `data-theme`: the page script watches it and calls
  `view.setTheme`, and the first mount takes the theme in force. At Night
  the sky darkens, the sun becomes a dim cool moon from the same direction,
  the water darkens, the House's windows light up and the buoys' lamps
  glow (see `rendering-and-shading.md`, "Day and Night"). Only colours,
  light and glow change: never the layout, the camera, the hotspots or the
  Data Cards.

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
  panel. The Landmark lands in the middle of the part of the screen the
  cards leave free (see "Full-screen layout").
- **Closing** (the close link, Escape, Back, or the Overview in the menu)
  navigates to `/`, and the camera flies back to where it was before the
  first section opened. If the visit started on a section page, it flies to
  the Overview.
- **About and Team open the House** (`routeView`): its lid (the roof and
  front walls) lifts off over 800 ms as the camera dives into the House
  Interior, a close-up of the room: a developer typing at a computer whose
  screen scrolls code. About or Team opens beside it. While the House is
  open the developer has a link ("Meet the Team") that opens Team. Leaving
  for any other route (closing, Escape, Back, the menu) lowers the lid as
  the camera flies out. Under reduced motion the lid and camera cut and
  the developer and screen keep still. A direct load of `/about` or
  `/about/team` opens the House at once.
- **Moving between sections** flies from one Landmark to the next. The
  World view to return to is still the one from before the first section.
- **Opening a route directly** mounts the World and cuts the camera to the
  route's Landmark, with the page's panel already open. On the Overview it
  frames the whole World in the free part (above the intro sheet on phones).
- **Back and Forward** are ordinary router navigations, so they move between
  sections and the World in the same way.

### Exploring the World

- The canvas sits in `#world-frame` (`.world`), which takes the input:
  drag to pan, wheel or trackpad pinch to zoom toward the cursor; on touch,
  one finger pans and two fingers pinch-zoom. Pan stops at the World's
  bounds and zoom runs from the Overview in to a close-up. The frame has
  `touch-action: none`, so gestures on the World never scroll or zoom the
  page, and the wheel over the World zooms instead of scrolling. Pan or
  zoom input stops a flight.
- Each page renders one hotspot link per placed Landmark inside the frame
  (`a.hotspot[data-hotspot]`, with `data-seed-link`), hidden until the World
  is shown. The World keeps each over its Landmark's model. Hover or keyboard
  focus shows an outline and the Landmark's label. In the Tab order they
  come after the name, the menu and the panel, and before the dice button. A drag that starts
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
  `/garden?seed=1234`. The default Seed is left out of links. With
  `?stats` in the URL, `withStats` keeps it on them too.

### Render stats

A developer's overlay (ticket 20), available only in `astro dev` or with
`?stats` in the URL (`statsAvailable`). Otherwise the page script never
imports it, so production pages carry no toggle, no card and no stats
styles (its CSS is imported `?inline` and added by the module itself; a
plain CSS import would be hoisted onto every page).

- **Toggle:** an icon button (bars) right after the dice, inside the
  persisted bottom-left card, with `aria-label="Render stats"` and
  `aria-pressed`. Its state is kept in `localStorage` (`render-stats`:
  `on` or `off`, wrapped in try/catch), so it survives route changes,
  reloads and Seed rolls. With nothing stored it starts on with `?stats`
  and off in dev.
- **Card:** inside the persisted World frame, so it lies under the HUD: a
  panel or sheet is never covered by it. It sits below the Landmark menu bar
  (`.hud-tools`), at the right; left of a side panel on desktop; on phones
  below the menu button. Its height stops above any floating card below it
  (the dice card, a sheet), leaving out rows that do not fit whole. It has
  `pointer-events: none`. Same card tokens as the HUD, so it follows Day
  and Night; monospace, tabular figures.
- **What it shows:** FPS and frame time (`frameMeter.ts`; `idle` when no
  frame has rendered for 0.5 s or only a lone on-demand frame did),
  triangles and draw calls of the last frame (the renderer's info), the
  backend (WebGPU or WebGL 2), the Seed and Biome, the generate time (from
  the worker; `cached` on a cache hit) and retries (`attempts - 1`), and
  voxels in total and by kind (`countVoxels`, once per World shown, only
  while the card is on).
- **Cost:** it never requests a frame. `view.onFrame` reports frames that
  render anyway; the text is rewritten every 250 ms while the card is on.

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

## Clients and Partners

A Client is one YAML file in `src/content/clients/`, a Partner one in
`src/content/partners/`; adding a file adds it to `/dock` and a boat or a
ship to the World. Mock data only: fictional names, no real brands or
logos. The schemas (`clientSchema`, `partnerSchema`):

| Collection | Field | Type |
|---|---|---|
| `clients` | `name` | non-empty string |
| `clients` | `industry` | non-empty string |
| `clients` | `logo` | optional `{ src, alt }`: an image under `public/` (initials stand in without one) |
| `partners` | `name` | non-empty string |
| `partners` | `tier` | `strategic`, `technology` or `community` (closest first) |
| `partners` | `logo` | optional `{ src, alt }`, as for Clients |

**Boats and ships.** The World generator gets only the counts. It moors one
boat per Client at the Dock, up to 12 (`MAX_BOATS`), and sails one ship per
Partner (no cap). Clients are taken in order by id, so boat `k` is the
`k`-th Client by id; Clients beyond the cap have no boat but stay on
`/dock`. Every Client's boat is the same kind for now, as is every
Partner's ship. See `world-generator.md` ("Boats", "Ships") and
`rendering-and-shading.md` ("Boats and ships").

## Team

A Team Member is one MDX file in `src/content/team/`; adding a file adds
them to Team (`/about/team`). The body is a short bio. The schema
(`teamMemberSchema`):

| Field | Type |
|---|---|
| `name` | non-empty string |
| `role` | non-empty string |
| `order` | whole number from 1: the place in the list (ties go by id) |
| `avatar` | optional `{ src, alt }`: a portrait under `public/` (initials stand in without one; the mock Team Members have none) |

Team Members do not change the World: the House always has the one
developer.

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
the pan, zoom and flight rig, whose `focus` flies to a Landmark, and whose
`setTheme` shows it by Day or by Night. It
has a mesher with culling, baked AO and greedy merging, a TSL material for
seams, bevel and colour jitter, a static sun shadow map, and frames only on
demand: while the camera moves, while the Partners' ships sail and while
the House is open (the developer at work) or its lid moves (never under
reduced motion). `onFrame` reports each frame (time, triangles, draw calls)
to the render stats overlay without asking for any. See `rendering-and-shading.md`.
