# Spec: Voxel World corporate landing site

Status: ready-for-agent

Sources:
- Discussion record: `docs/records/2026-11-11-corporate-landing-world-design.md`
- Glossary: `GLOSSARY.md`
- ADRs: `docs/adr/0001-seed-generated-world.md`, `docs/adr/0002-webgpu-renderer-with-tsl.md`, `docs/adr/0003-html-routes-over-the-world.md`

## Problem Statement

A data/AI software company needs a corporate landing site that people remember. Corporate sites usually stack interchangeable sections: hero, services, about, portfolio, contact. They don't convey what a data/AI company actually does, which is turn raw data into something valuable, reproducibly.

The company wants the site to *tell a story* and to feel like a place you explore. It must still behave like a proper corporate site:
- content can be indexed and shared
- it is accessible and fast on phones
- all company information and content can be edited without touching code

## Solution

The home page is a small generated **World**: a muted, soft-voxel isometric archipelago of one to four **Isles**, rendered live with three.js.

**Seed**
- A **Seed** deterministically generates the World, so the same Seed always gives the same World.
- The site ships with a default Seed. Visitors can roll a new one with a dice button and share it with `?seed=`.
- The Seed also picks a **Biome**.

**Landmarks.** Every World always contains the seven **Landmarks**. Each stands for one section of the site:

| Landmark | Section |
|---|---|
| Overview | Hero |
| Station | Services |
| House | About |
| House Interior | Team |
| Garden | Projects |
| Dock | Clients and Partners |
| Mailbox | Contact |

Content counts shape the World: every **Project** is a tree in the Garden, every **Client** a boat moored at the Dock, and every **Partner** a larger ship sailing between Isles.

**Exploring**
- Visitors pan and zoom the World freely, like a map.
- Clicking a Landmark flies the camera there and opens that section as a real page with its own URL, layered over the World. Closing it returns to the World.
- Clicking the House lifts its roof and dives into the House Interior: a developer at a computer. About and Team open beside it.

**Guide and Tour**
- A **Guide** leads an optional **Tour** through the Landmarks in **Story Order**, telling the story data → insight → value.
- The Guide is a floating voxel cube with a screen face and a dry, talkative personality.

**Data Cards.** These float beside Landmarks, tilted to the isometric plane, and show company metrics.

**Look and data**
- The site has Day and Night themes and a muted OKLCH palette.
- It is English only.
- All data is mock data, editable in one site data module and in content collections.

## User Stories

### Discovering the World

1. As a first-time visitor, I want to see a beautiful isometric World as soon as the page loads, so that I immediately feel this company is different.
2. As a first-time visitor, I want to see the company name and tagline over the World, so that I know whose site I'm on.
3. As a first-time visitor, I want the Guide to assemble itself from flying voxels and greet me, so that I understand the World is generated and alive.
4. As a visitor, I want to drag to pan the World, so that I can look around.
5. As a visitor, I want to zoom with the mouse wheel or trackpad, so that I can inspect details.
6. As a mobile visitor, I want to pan with one finger and zoom with a pinch, so that exploring feels native on my phone.
7. As a visitor, I want panning and zooming to be clamped to the World's bounds, so that I never get lost in empty sea.
8. As a visitor, I want Landmarks to show a hover or focus affordance, so that I know they are clickable.
9. As a visitor, I want ambient life such as gentle water, swaying trees and sailing Partner ships, so that the World feels alive without being distracting.

### Seed and World generation

10. As a visitor, I want to click a dice button to generate a brand-new World, so that I can play with the generative idea.
11. As a visitor, I want the URL to update with `?seed=` when I roll, so that I can share the exact World I'm seeing.
12. As a visitor opening a shared `?seed=` link, I want to see exactly the same World the sender saw, so that sharing is meaningful.
13. As a visitor, I want every generated World to contain all seven Landmarks, so that I never miss a section.
14. As a visitor, I want Worlds to differ meaningfully: one to four Isles, different shapes, heights, bridges, Biomes and Landmark variants, so that rolling feels rewarding.
15. As a visitor, I want the Guide to dissolve and re-form when a new World is generated, so that the transition feels intentional.
16. As a visitor, I want generating a new World not to freeze the page, so that the experience stays smooth.
17. As a visitor, I want the House and Garden always on the same Isle, the Dock at the water's edge, and all Isles linked by bridges, so that every World makes sense.
18. As a site owner, I want the default Seed to come from the site data module, so that the first impression is a World we chose.
19. As a site owner, I want the default Seed's Biome to be our main brand Biome, so that the first impression is on-brand.

### Landmarks and sections

20. As a visitor, I want to click the Station and see the company's Services, so that I learn what they offer.
21. As a visitor, I want to click the House and see About, so that I learn who the company is.
22. As a visitor, I want the House roof to lift and the camera to dive inside when I open About, so that "going into the company" feels literal.
23. As a visitor, I want to click the developer inside the House to see the Team, so that I can meet the people.
24. As a visitor, I want to click the Garden and see all Projects, so that I can browse past work.
25. As a visitor, I want each tree in the Garden to be one Project, so that the portfolio is tangible.
26. As a visitor, I want to click a single tree and open that Project's full case-study page, so that I can read details.
27. As a visitor, I want to click the Dock and see Clients and Partners, so that I can judge the company's credibility.
28. As a visitor, I want Clients shown as moored boats and Partners as larger ships sailing between Isles, so that the two are visually distinct.
29. As a visitor, I want to click the Mailbox and see the company's contact information, so that I can reach them.
30. As a visitor, I want each section to open as a page over the World and close back to the World where I left it, so that I never lose my place.
31. As a visitor, I want each section page to have its own URL, so that I can bookmark and share it.
32. As a visitor opening a section URL directly, I want the World to load with the camera already at that Landmark and the page open, so that deep links work.
33. As a visitor, I want the browser back and forward buttons to move between sections and the World, so that navigation behaves normally.
34. As a visitor, I want the World to keep its state (Seed, meshes, camera) when moving between sections, so that transitions are instant.

### Guide and Tour

35. As a visitor, I want a Tour button that moves the camera through every Landmark in Story Order, so that I can be shown around.
36. As a visitor on the Tour, I want the Guide to fly ahead and speak in speech bubbles, so that the story has a narrator.
37. As a visitor on the Tour, I want the narration to tell how data becomes insight becomes value, so that I understand the company's purpose.
38. As a visitor on the Tour, I want next, previous and exit controls, so that I control the pace.
39. As a visitor, I want to click the idle Guide to start the Tour, so that the Guide is an obvious entry point.
40. As a visitor, I want the Guide's screen face to show different pixel-eye moods, so that it has personality.
41. As a site owner, I want the Guide's name in the site data module and its lines in content collections, so that I can edit its voice without code.

### Data Cards

42. As a visitor, I want floating Data Cards with key metrics beside the relevant Landmark, so that I get quick proof points.
43. As a visitor, I want Data Cards tilted to the isometric plane but crisp at any zoom, so that they look integrated and stay readable.
44. As a visitor, I want Data Cards to appear only when the camera is near their Landmark, so that the overview isn't cluttered.
45. As a screen-reader user, I want Data Card text to be real text, so that I can hear the metrics.
46. As a site owner, I want Data Card metrics in the site data module, so that I can update numbers without code.

### Theme and look

47. As a visitor, I want the World and pages to follow my system's light or dark preference, so that the site is comfortable.
48. As a visitor, I want a theme toggle (Auto, Day, Night), so that I can override it.
49. As a visitor at Night, I want the House lights on, glowing buoys and darker water, so that Night feels designed rather than just inverted.
50. As a visitor, I want muted, non-glaring colours, so that the World is easy on the eyes.
51. As a visitor, I want the theme never to change the World's layout, so that a Seed always gives the same World.
52. As a visitor, I want voxels to show soft bevels, visible seams, slight per-voxel colour variation and soft ambient occlusion, so that the World feels like a premium miniature.

### Content management

53. As a site owner, I want the company name, tagline, logo, address, email, phone, socials, SEO and OG settings in one site data module, so that nothing about identity is hardcoded.
54. As a site owner, I want the Landmark list (id, route, label, Story Order) in the site data module, so that section wiring is data.
55. As a site owner, I want to add a Project by adding one MDX file, so that the portfolio and the Garden update together.
56. As a site owner, I want to add a Service, Team Member, Client or Partner by adding one file, so that content and World stay in sync.
57. As a site owner, I want each Landmark's intro text in MDX, so that I can write rich section copy.
58. As a site owner, I want content to be schema-validated at build time, so that mistakes fail the build instead of breaking the page.
59. As a developer, I want the whole site seeded with coherent mock data (a fictional company, Projects, Services, Team Members, Clients, fictional Partners, metrics), so that the World is complete before real content exists.

### Accessibility, SEO and resilience

60. As a search engine, I want every section and Project page to be static HTML with full content, so that the site is indexable.
61. As a keyboard user, I want to Tab through Landmarks and an HTML Landmark menu, so that I can navigate without a mouse.
62. As a screen-reader user, I want an HTML Landmark menu and proper page headings, so that the canvas doesn't hide the structure.
63. As a visitor without WebGL/WebGPU or JS, I want a still image of the default World plus the Landmark menu, so that the site still works.
64. As a visitor who prefers reduced motion, I want camera flights and the Tour to use cuts and looping animation to stop, so that I'm not made uncomfortable.
65. As a mobile visitor, I want section pages to open as a bottom sheet, so that content fits my screen.
66. As a visitor sharing a page, I want correct titles, descriptions and OG images, so that links preview well.

### Performance

67. As a mobile visitor, I want the World to run smoothly on a mid-range phone, so that the experience isn't janky.
68. As a mobile visitor, I want my battery spared while I read, so that the page isn't rendering when nothing moves.
69. As a mobile visitor, I want lower-cost decoration on small devices, but never missing Landmarks, so that performance doesn't cost content.

## Implementation Decisions

### Stack

- Astro 7.4 with `@astrojs/mdx` 8.1 and three.js r187, on Node ≥ 22, using bun (see `CLAUDE.md` Tools).
- TypeScript is strict, with Zod 4 via `astro/zod`.
- Output is static and not tied to a host.
- The site lives in its own subfolder of this repo, separate from the docs and skills at the root.
- Camera tweens use small hand-written easing; there is no animation library.

### Renderer (ADR 0002)

- Rendering uses `WebGPURenderer` from `three/webgpu`, with automatic WebGL 2 fallback.
- All custom shading is TSL node materials.
- WebGPU-only features must not be load-bearing.

### Routing (ADR 0003)

- Each Landmark is a real static route layered over a persistent World canvas: home, `/services`, `/about`, `/about/team`, `/garden`, `/garden/[slug]`, `/dock`, `/contact`.
- The World and its state survive route changes, using Astro's client router with a persisted canvas element.
- Loading a route directly places the camera at its Landmark.
- **Risk and fallback.** Persisting a WebGPU canvas across routes is unproven on Astro 7, so the routing work starts by proving it. If it fails, the panel fetches the page's content itself; URLs and static pages stay the same.
- **Proved (ticket 07).** On Astro 7.4 the World frame and its controls carry `transition:persist`; the same canvas, WebGPU renderer, meshes and camera survive clicks, Back, Forward and Seed rolls, so the fallback was not needed. The section routes are one `[...section].astro` page driven by the Landmark list, each with its intro copy from the `pages` collection. Closing a section flies the camera back to where it was before the first section opened (the Overview if the visit began on a section page).

### Modules

**World generator.** A pure, deterministic function from Seed plus content counts to a World data structure, with no three.js and no DOM. This is the single test seam.
- The World data contains:
  - Isles: height grid and footprint
  - the chosen Biome
  - bridges
  - paths
  - Landmark placements and variants, including the House Interior room layout
  - one tree per Project, as a cell of the Garden's footprint
  - one moored boat per Client
  - one sailing route per Partner
  - decoration scatter
  - Data Card anchors
- **Terrain** uses noise (simplex/FBM) with an island falloff.
- **Heights** are quantised to 1-voxel steps.
- **Local rules** add:
  - a path from Dock to House
  - stairs at single-step height changes
  - layered cliff cross-sections at the edges
- **Placement rules**:
  - House and Garden share an Isle
  - the Dock is on the shoreline
  - the Station is on high ground
  - all Isles are connected by bridges
  - each placed Landmark stands on a flat, dry footprint of whole cells (House 3×3, Station 2×2, Mailbox 1×1, Dock 2×1 plus a 2–3 cell jetty into the sea, Garden at least 3×3 with one cell per tree plus paths) that overlaps no other footprint, bridge, bridge end or the Dock-to-House path; the generator levels the terrain under a footprint whose cells differ by up to 2 voxels (ticket 18)
  - no Landmark is hidden by terrain or a bridge from the fixed isometric camera direction: the generator marches the height grid towards the camera from every ground point of a candidate footprint and rejects occluded ones (ticket 18)
  - the Landmark models (¼ unit) fill their footprints, each Garden tree fills its cell, and each Landmark's hotspot covers its whole footprint
- **Placed vs derived Landmarks.** There are seven Landmarks in Story Order, but the generator places only five: Station, House, Garden, Dock and Mailbox. The other two are camera views derived from the layout: Overview from the World's bounds, and House Interior from the House's position.
- **Landmark variants.** Each Landmark starts with one variant. The World data carries a variant field so more can be added later without restructuring.
- **Seed format.** A Seed is a short string, hashed to drive the PRNG. The dice button rolls a numeric one. An empty Seed or one longer than 32 characters falls back to the default Seed. A rolled Seed follows the visitor across routes (e.g. `/garden?seed=1234`).
- **Determinism scope.** The same Seed gives the same World only for the same content counts. Adding a Project may change the World of an existing Seed.
- **Caps.** The Garden shows at most 24 trees and the Dock at most 12 moored boats. Entries beyond the cap are not shown in the World but stay on their section pages. With a single Isle, Partner ships sail a loop around it.
- **Retry.** If the rules fail, generation retries from a deterministically derived Seed, so the same input always gives the same output.
- **Seeded PRNG.** A seeded PRNG is threaded through every step, with no `Math.random`.
- **Web Worker.** It runs in a Web Worker in the browser, and results are cached per Seed.

**Biomes and palette**
- Biomes are a small fixed set: tropical, northern, autumn and volcanic.
- Each Biome holds terrain, foliage, water-depth and accent colours as OKLCH.
- Biomes come from the referenced Lospec palettes (late night bath, Cryptic Ocean, Punolite Plus Remake, Aquaverse), with chroma clamped to ≤ 0.10 and L and h kept.
- Brand and UI colours and the House colours are fixed and independent of the Biome.
- Day and Night are a separate theme dimension. They drive lighting and emissive accents, never the layout.
- **Done (ticket 13).** One set of OKLCH tokens, `THEME_TOKENS` in `site/src/data/theme.ts`, drives the CSS custom properties (inlined in `<head>` by `themeCss()`) and the three.js World (sky, sun or moon, hemisphere light, water shade, glow). A toggle at the top right, before the Landmark menu, cycles Auto, Day and Night (one icon button: monitor, sun, moon); Auto follows `prefers-color-scheme` live, Day and Night are kept in `localStorage`, and an inline `<head>` script sets `<html data-theme>` before first paint, so there is no flash. At Night the House's windows glow (`HOUSE_WINDOWS`), the buoys' lamps glow and the water darkens. The buoys (up to 4, sea marks nearest the Dock) are part of the World data (`world.buoys`), placed from the layout alone, so both themes show the same World. Every UI text pair meets WCAG AA in both themes (`theme.test.ts`). The Landmark menu now collapses below 64rem (was 60rem) to make room for the toggle.

**Mesher**
- The mesher converts the World into chunked buffer geometry:
  - hidden faces are culled
  - same-colour coplanar faces are greedy-merged
  - vertex AO is baked into vertex colours
- **Voxel scales.** Terrain voxels are 1 unit. Landmarks and decoration are ¼ unit.
- **Shader detail.** Per-voxel seams, bevel shading and colour jitter are computed in TSL from world position, so merged faces still read as individual voxels.

**Scene runtime**
- Camera: orthographic isometric.
- Lighting: one directional light whose shadow map renders only when the World changes.
- Frames render on demand, only while something moves.
- DPR is capped at 1.5 on mobile and 2 on desktop.
- A reduced-decoration tier applies on small devices.

**Performance budget**
- Mid-range phone: at least 30 fps while the camera moves. Desktop: 60 fps.
- The whole World is at most 300k triangles.
- Generation finishes within 1 second.
- No frames render while nothing moves.

**Camera and interaction**
- Pan and zoom with bounds work by drag, wheel and pinch.
- Picking makes Landmarks and individual trees clickable and focusable.
- The camera flies to Landmarks, and becomes a cut under reduced motion.

**House Interior**
- On entering the House, its roof lifts and the camera dives into a ¼-unit voxel room with a desk, a computer and an animated developer whose screen shows code or data.
- Clicking the developer opens Team.
- **Done (ticket 11).** The House (3×3) is a code-built model in three parts (`site/src/render/houseModel.ts`): a static base (plinth, floor with a rug, the two back walls) and the room, drawn into the detail grid; and a lid (roof, dome, the two front walls with the door and windows), its own mesh with the soft-voxel material in local space. The room fills a defined interior space (`HOUSE_INTERIOR`, 8×8×8 ¼ voxels): a desk, a computer whose screen scrolls lines of code (a TSL shader plane), a chair, a plant and a seated developer whose head and hands are their own small meshes (typing bursts, then a pause to read). `/about` and `/about/team` both open the House (`routeView`): the lid lifts 6 units (800 ms) as the camera flies to the House Interior view, the developer's link (to Team) appears, and About or Team opens beside it; any other route lowers the lid. Under reduced motion the lid and camera cut and nothing animates. `team` is an MDX collection (`teamMemberSchema`: name, role, order, optional avatar) with 4 mock Team Members, listed on `/about/team`. House Variants and one furnished room per Biome (ASCII structures, ADR 0004) come in the polish feature; they keep the liftable lid and the interior space.

**Guide**
- The Guide is a floating ¼-unit voxel cube with a screen face of pixel-eye moods.
- It assembles from voxels on first visit, and dissolves and re-forms on a new Seed.
- It idles near the Station and starts the Tour when clicked.
- It speaks in speech bubbles.
- Its design is original. Only its *tone* is inspired by Portal 2; nothing is copied from Valve characters.

**Tour.** The Tour follows Story Order from the Landmark list, with next, previous and exit controls. Its narration comes from the content collections.

**Data Cards**
- Data Cards are HTML elements positioned with a CSS `matrix3d` derived from the camera, so they tilt to the isometric plane.
- They show only near their Landmark.
- They are real text, and their metrics come from site data.
- **Done (ticket 09).** Metrics are `site.dataCards` in `site/src/data/site.ts`, keyed to a placed Landmark id. Each card keeps its CSS size on screen (crisp text at any zoom); only its tilt (upright, text along the World's −z axis) and position follow the camera. One card shows at a time: the Landmark the camera is near (zoom above the Overview and at least 0.7 × the Landmark's close-up, Landmark within the middle of the frame round where the visitor looks, beside a panel if one is open). It stands over its Landmark, or hangs under it when the top of the frame would cut it off. The `services` collection (`title`, `summary`, `icon` from `pipeline`/`model`/`chart`/`platform`, `order`) is listed on `/services`; the Station has its real voxel model.

**Layout: a full-screen World with floating UI** (like haru-ni.net; added on 2026-11-11, ticket 19)
- **The World fills the viewport**, edge to edge (`100dvh`), with no frame or border. The page does not scroll while the World is shown.
- **Every UI element floats over the World as a card**: rounded (about 6px), near-opaque paper, a soft shadow. Only the cards take the pointer; the World can be dragged anywhere else.
  - Top left: the logo mark and company name.
  - Top right: the Landmark menu as a rounded bar, the current section marked (`aria-current`). On narrow screens it collapses into a menu button that opens it as a popover.
  - Bottom left: the dice button and the current Seed.
  - Section panels: on desktop a card at the right, below the menu, as tall as its content and no taller than the screen; on phones a bottom sheet, with the dice row above it. Long content scrolls inside the card.
  - The Overview's intro (tagline and home hook) is the same kind of card: at the left on desktop, a bottom sheet on phones.
- **Camera framing.** The camera puts each focused Landmark in the middle of the part of the screen the cards leave free, and the pan bounds apply there, so a Landmark at the edge of the World still clears a panel or sheet.
- **Without JS, or without WebGPU/WebGL,** the page is a normal readable HTML page that scrolls (the same cards in a column; the World and dice hidden), never a viewport-locked empty screen.
- **Fonts.** Jersey 20 for body text and Jersey 15 for headings (h1–h3, card titles, the company name), self-hosted from Fontsource with `font-display: swap` and a system fallback stack. The stacks live in the site data module. Body text is 20px (Jersey 20's pixel grid) and never below 16px; headings use multiples of 15px. All text meets WCAG AA.
- **Done (ticket 19).** The layout switch is `<html data-world="live">`, set before first paint when the browser has WebGPU or WebGL 2 and dropped if the World fails to mount. The free part is `freeCentre` in `site/src/render/freeArea.ts`; the pan bounds hold the ground at `CameraLimits.at`. Brand-coloured text uses `--brand-ink` (the brand colour darkened) for AA.

**Overlay UI**
- **Section pages** open as a floating card on desktop and a bottom sheet on mobile (see Layout above).
- **Landmark menu.** An HTML Landmark menu is always present and keyboard-reachable.
- **Controls**
  - dice button: roll a new Seed
  - theme toggle: Auto, Day, Night
  - Tour button
- **Fallback.** A still image of the default Seed's World is shown when WebGL/WebGPU or JS is unavailable.
  - The still is captured automatically at build time: a headless browser (Playwright) loads the World for the default Seed and screenshots it, in Day and Night.
  - The same capture serves as the default OG image.
  - Everything in the image is drawn by the three.js World itself. Nothing comes from the claude-drawing skill.

### Data contracts

**Site data module (`site/src/data/site.ts`, a user requirement).** It holds:
- company identity: name, tagline, logo, address, email, phone, socials
- SEO and OG defaults
- the default Seed
- the Guide's name
- the Landmark list: id, route, label, Story Order
- Data Card metrics, each keyed to a Landmark id
- **Done (ticket 12).** `/contact` (the Mailbox's section) lists the email (`mailto:`), phone (`tel:`), address and each social from `site.company`, in an `<address>`; the list is `contactDetails` in `site/src/lib/contactDetails.ts`. Information only: there is no form and nothing is submitted. The Mailbox (1×1) has its real voxel model: a blue box on a wooden post, a letter at its door and a red flag raised on the side the camera sees.

**Content collections.** They are defined with Astro's content layer, using glob loaders and Zod schemas:

| Collection | Format | Fields | Notes |
|---|---|---|---|
| `projects` | MDX | title, summary, client, year, tags, tree variant hint, cover | Body is the case study. One tree each. |
| `services` | MDX | title, summary, icon, order | |
| `team` | MDX | name, role, avatar, order | |
| `clients` | YAML data | name, logo, industry | One moored boat each. |
| `partners` | YAML data | name, logo, tier | Fictional names in mock data. One sailing ship each. |
| `pages` | MDX | Landmark intro copy, Guide Tour lines per Landmark, the home hook | |

**Content counts and generation**
- The World generator receives only counts and stable ids from content, never the copy.
- Projects are placed in a stable order by id, so adding a Project adds a tree without reshuffling unrelated ones where possible.
- **Done (ticket 08).** The generator still gets only the Project count. The site pairs tree `k` with the `k`-th Project by id (`site/src/lib/gardenTrees.ts`). Each tree is its own link to `/garden/<id>`, over the middle of the tree so neighbouring trees never share a click target. It stops taking the pointer when the tree is too small on screen, so a click on a far-out Garden opens `/garden`. The `projects` schema lives in `site/src/lib/contentSchemas.ts`; `cover` is an optional `{ src, alt }`, and the tree variant hint is `tree` (`round`, `tall`, `bushy`), not drawn yet.
- **Done (ticket 10).** The generator gets the Client and Partner counts. It moors `min(clients, 12)` boats in sea cells within 2 cells of the Dock's jetty, nearest first and in plain view, bow out along the jetty (a Dock is only chosen if it has a berth per boat); boat `k` is the `k`-th Client by id. Each Partner sails a closed loop of open sea (at least 2 cells clear of land, bridges, the jetty and boats): through the straits on both sides of a bridge where there is room (so between two Isles), round the Isle when there is one. Ships beyond the bridges take a wider loop the other way, then share loops spread out by phase. Boats are static voxels in the detail grid; ships are animated meshes with the soft-voxel material in local space, sailing only while motion is allowed. One code-built boat and ship kind for now (kinds from ASCII structures come later, ADR 0004). `clients` and `partners` are YAML collections (`clientSchema`: name, industry, optional logo; `partnerSchema`: name, tier `strategic`/`technology`/`community`, optional logo); `/dock` lists them as two groups.

### Mock data

- The company is fictional.
- Content: about 6 Projects, 4 Services, 4 Team Members, 5 Clients and 3 fictional Partners, plus Data Card metrics and contact details.
- No real brands or logos are used.
- The implementer picks the fictional company name and brand colour and puts them in the site data module; the user may change them later. The fonts are the user's choice (Jersey 20 and Jersey 15, see Layout).
- The Guide's voice is talkative with dry humour.

## Testing Decisions

### What a good test is

- **Black-box through the single seam.** Tests call the World generator with a Seed and content counts and assert on the World it returns. They never reach into internal steps such as noise, retry and placement.
- **Behaviour, not snapshots.** Tests assert rules and properties. Large snapshots of voxel grids are not used.

### World generator: test suite

This uses Vitest.

**Determinism**
- The same Seed and counts give a deep-equal World.
- Different Seeds give different Worlds, sampled.

**Landmarks are complete**
- For hundreds of sampled Seeds, each of the five placed Landmarks is present exactly once, and the two derived views (Overview, House Interior) are defined.

**Placement rules hold**
- House and Garden share an Isle.
- The Dock is on the shoreline.
- The Station is on its Isle's high ground.
- All Isles are reachable via bridges.
- Landmark footprints are flat, on land, and never overlap.
- No Landmark is occluded by terrain from the isometric view direction.

**Content counts**
- Trees equal Projects.
- Moored boats equal Clients.
- Sailing ships equal Partners.
- Counts of 0 and large counts are both handled.

**Ranges**
- The Isle count is 1–4.
- The Biome is one of the defined set.

**Palette constraint**
- Every Biome colour has OKLCH chroma ≤ 0.10.

**Termination**
- Retry always terminates and stays deterministic, including on Seeds that fail on their first attempt.

### Build check

These are not unit tests:
- `astro check` and `astro build` succeed.
- Every route emits HTML.
- Content schemas reject invalid fixtures.

### Rendering, interaction and UI

These have no unit tests. They are verified by running the site in a browser on desktop and mobile viewports.

### Prior art

None: the repo has no code yet. This suite sets the pattern.

## Out of Scope

- Languages other than English, and i18n routing.
- A contact form or any message submission. Contact is information only.
- Server-side rendering, server endpoints, or any backend.
- Choosing or configuring a hosting provider.
- Real company content, brands and logos. Everything is mock data.
- Wave Function Collapse terrain generation.
- Seed-driven or clock-driven time of day, weather or mood.
- Free hue rotation per Seed. Only the fixed Biome set varies.
- A CMS. Content is files in the repo.
- Analytics, cookies and consent banners.
- A blog, careers or news section.
- Any design copied from Portal or other Valve characters.

## Further Notes

**Look prototype first.** The biggest risk is whether code-built voxel models look close to the reference house. Before the rest of the work, build a throwaway single-page three.js prototype: one House, a tree and a terrain patch, with the seam, bevel, colour-jitter and AO shading. The user reviews and tunes it, and the approved look sets the target for the real renderer.

**References.** Visual and interaction references, with links, are in the discussion record:
- haru-ni.net, for the explorable map with routes over the canvas
- Pudgy World, for the story-hook landing
- Islanders, Bad North and Townscaper, for procedural islands
- voxel diorama references and the user's Cycladic voxel house
- the Lospec palettes

**Project documents.** As the code is written, add the implementation documents under `docs/documents/` and keep `docs/documents/INDEX.md` updated, as `CLAUDE.md` requires. At minimum:
- the World generator
- rendering and shading
- the content model

**Vocabulary.** Use `GLOSSARY.md` terms throughout code and docs:
- World, Isle, Seed, Biome, Landmark, Story Order, Tour, Guide, Data Card, Project, Client, Partner, Service, Team Member
- never "island" for an Isle, because it clashes with Astro Islands
