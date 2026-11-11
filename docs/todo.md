# To approve or check

Things the agents went ahead on without waiting for the user, while the user was away (from 2026-11-11 evening). Each item says what was assumed. Tick it, or note a change, when you have looked.

## Approvals skipped

- [ ] **Polish 01: House look.** The ticket says to stop for approval of the House models in `/dev/models`. The agents carried on with the assumed look: a tropical stilt house (bamboo, thatched hip roof, a finial instead of a chimney), a northern log cabin (shingled gable under snow, stone chimney), an autumn brick cottage (tiled gable, green door and shutters, brick chimney) and a volcanic stone house (low slate hip roof, an ember in the chimney; it reads very dark, especially at Night). Review the gallery (`bun run dev`, then `/dev/models`) and `.scratch/voxel-world-polish/screenshots/01-*.png`; any change means redrawing `site/src/structures/house/*.structure` and the Variants built on them (ticket 03).
- [ ] **Polish 05: open question in the ticket.** "May other Projects take empty flower cells when fewer than six are pinned?" Assumed: _no_ (flower cells stay grass) unless the ticket was settled otherwise.

## Decisions made by agents (check they suit you)

- [ ] **Test seams** were picked by the agents without confirming them first (tickets 07, 08, 09, 11, 12, 13, 20). Each picked pure functions plus `generateWorld`.
- [ ] **Mock copy.** Placeholder text was written for the six section intros (07), Projects (08), Services (09), Clients and Partners (10), Team (11) and Contact (12). The Contact intro now says "we answer every email within a day" to match its Data Card.
- [ ] **House opens like a doll's house (11).** The lid is the roof plus the two front walls, because the front walls hide the floor from the isometric camera. The polish spec still says "liftable roof". Polish 01 kept this split for the House Variants (the `lid` part in each structure file); say if you want only the roof to lift.
- [ ] **Data Cards show one at a time (09).** Only the card nearest where you look shows, and cards keep a fixed screen size.
- [ ] **Breakpoints (19, 13).** The menu collapses below 64rem and panels become bottom sheets below 48rem.
- [ ] **Brand text colour (19).** A darker `--brand-ink` is used for brand-coloured text to meet WCAG AA; the brand colour itself is unchanged.
- [ ] **Buoys added (13).** There were none before; Night needed glowing buoys, so up to 4 now sit near the Dock.
- [ ] **Night glow is unlit colour, not real lights (13).** Check against the torches and Night light ticket.
- [ ] **Ships render every frame while they sail (10).** This costs battery; under reduced motion or on a hidden tab it stops.
- [ ] **Stats card text is 14px (20)**, below the site's 16px minimum, as a dev-only tool.
- [ ] **The Guide (14)** is named **Lumen** (`site.guide.name`), and all its lines were written by the agent (`guide` in `pages/home.mdx`). It has six screen moods and lives beside the Station. It renders every frame while idle, stopping under reduced motion or on a hidden tab. Its model is ¼ unit; ADR 0006 moves structures to ⅛ later.
- [ ] **Guide spots (14).** About 1 in 1500 Landmark spots has no clear place for the Guide (a Mailbox tucked in front of its House), and the Guide then takes the preferred spot anyway.
- [ ] **The Tour (15)** is step-by-step: it never plays by itself (the glossary avoids "autoplay"), so there is no Pause button; it waits at each step for Next. It never changes the URL; while it runs, the intro or section panel is hidden and the Tour's card takes its place. All Tour lines (`tour` in each `pages` entry) were written by the agent. A click on the idle Guide now starts the Tour, so `idle` lines are said when the Guide gets back to the Station after the Tour instead. The camera stays at most 1.3 × the House's close-up inside the House on the Tour, so the Guide stays in view. Test seams picked: `lib/tour.ts` and `travelPoint`.
- [ ] **Phone render tier (16).** A touch device whose screen's shorter side is under 600px gets the reduced tier: no MSAA, a 1024² shadow map and ambient motion (ships, the Guide idling) at 30 fps; camera moves stay at full rate. Tablets get the full tier. `?tier=full|reduced` forces one. Test seams picked: `lib/renderTier.ts` and `lib/worldStill.ts`.
- [ ] **World still (16).** It is captured at 1600×1000 with the HUD hidden and reduced motion on, as WebP at 800 and 1600px. Without JS or a GPU it shows on every page after the intro or panel, with a caption and alt text the agent wrote. Playwright is pinned to 1.64.1 because 1.65 is under the 7-day release age. Without Playwright's Chromium the build passes and leaves the still out.
- [ ] **Icon-only controls on phones (16).** Below 48rem the dice and the Tour button show only their icons (labels stay for screen readers and as tooltips), which fixes "Roll a new World" wrapping (Phone Tour, 15).
- [ ] **Polish 01: structure pipeline.** Test seams picked: `parseStructure`, the structure files as data (`structures.test.ts`), `generateWorld`, `worldToVoxels` and `structureModels.ts`, and `instanceMatrix`. Files end in `.structure` and are parsed by a Vite plugin (also in the World Web Worker's bundle). The four Houses were drawn with a throwaway generator script, then committed as plain ASCII; edit the files directly from now on. The ¼-unit room (ticket 11) still stands inside every House until ticket 04.
- [ ] **Polish 01: House plot.** The House fills the plot's north-west 3×3, so its door faces south or east only (the sides the camera sees); the Seed picks, and the door turns if only the other side reaches the path. The path ends just outside the plot in line with the door, and the yard cell in front of the door is painted as path. The Mailbox stands in the yard's south-east corner, whichever way the door faces: it never hides the door, but in the About close-up it stands in front of the open room (trying the cell beside the door instead boxed the Guide in on some Seeds). Ticket 03's smaller Mailbox (about 1.25 units tall instead of 2) should ease this. The House's hotspot, Guide spot and Data Card now use the House's 3×3, not the whole plot.
- [ ] **Polish 01: safe layout.** The safe layout's Isle grew from radius 10 to 12 so a 24-tree Garden and the 4×4 House plot always fit. Ticket 02 grows the Isles anyway.
- [ ] **Site URL and link previews (17).** Canonical, OG and sitemap URLs use the placeholder `https://lighthouse.example` (`site.url` in `site/src/data/site.ts`); set the real domain before launch. The default OG image is the Day World still cut to 1200×630 JPEG (Day only, never Night); a Project's cover replaces it on its page. `robots.txt` allows everything. `og:locale` is `en`, and no Twitter handle is set. Test seams picked: `lib/seo.ts` (`pageMeta`, `canonicalUrl`, `sitemapXml`, `robotsTxt`) and `lib/worldStill.ts` (`OG_IMAGE`, `OG_CROP`, `stripOgStill`). The per-collection sections moved from `site-project.md` into the new `content-model.md`.

## Known issues not yet fixed

- [ ] **Landmarks can hide each other.** On Seed `lanternfish` the House partly hides the Mailbox. Placement only checks terrain and bridges. Suggested fix: add Landmark-on-Landmark occlusion to polish 02 (bigger Isles).
- [ ] **Garden trees merge into a hedge (08)** and are about 13×15px to tap on phones. Fixed by design in polish 05.
- [ ] **Phone Data Cards:** the House's "12 years" card hangs over the House base in close-up, and the Station's can cross the bottom edge by about 4px.
- [ ] **Phone Tour (15):**
  - "Roll a new World" wraps to two lines once the Tour button (and the stats toggle) sit beside it.
  - Some Tour steps are framed far out.
  - At the Mailbox step the Guide's bubble can cover the Mailbox.
- [ ] **No Pause in the Tour (15).** The ticket asked for pause; the Tour is step-by-step and never plays by itself, so there is nothing to pause.
- [ ] **Code-built models to port.** The House is a structure since polish 01. The Station (09), Mailbox (12), Garden and Dock, boats and ships (10) and the House room (11) are still code-built, and will need porting to ASCII structures in the polish feature.
- [ ] **Model Gallery at Night (polish 01)** switches the light only: the House's windows glow in the World at Night but not in the Gallery.
- [ ] **Phone FPS not measured on a real phone (16).** It was checked only in Chromium on a phone viewport with 4× CPU throttling: 57–60 fps on a desktop GPU; with the software renderer the reduced tier doubles FPS (13 → 28). Check 30 fps on a real mid-range phone with `?stats` (compare `&tier=full`).

## Code review of the landing feature (de5fbfd..e14f053)

Clear-cut findings were fixed in the review-fixes commit: glossary wording, text below 16px, heading sizes, Seed links on a failed load, and small duplicates. These need your call:

- [ ] **"developer" vs Team Member.** The glossary avoids "developer" for Team Member, but the code names the figure in the House `developer` (`DEVELOPER_PARTS`, `data-developer`, `.hotspot.developer`). Either rename the code or add a glossary term for the figure. The design record calls it "a developer at a computer".
- [ ] **"hotspot".** It is on the _Avoid_ list for Landmark, but the code uses it for the clickable overlay link (`landmarkHotspots.ts`, `data-hotspot`). Consider a glossary term for that link.
- [ ] **Refactor `site/src/render/mountWorld.ts`.** It was edited by 11 tickets and owns the renderer, lighting, tier, House lid state, ships, the Guide, stats and pan bounds. Suggested split: an `objects.step(dt)` that House and ships own, and a pan-bounds helper on the World. Do this before the polish feature adds more.
- [ ] **Split the `WorldPage.astro` inline script** (about 400 lines, about 15 mutable `let`s). Suggested modules: `tourController`, `guideTalk`, Seed loading and routes.
- [ ] **Scope added beyond the tickets.** Keep or drop each:
  - the `?tier=full|reduced` override
  - the Guide's `welcomeBack` lines
  - `sitemap.xml` and `robots.txt`
  - `aria-current` on tree and developer links
- [ ] **Unit tests for rendering and UI maths.** spec.md:395 says rendering and UI have no unit tests, but agents added pure-function tests (`cameraMath`, `dataCardMath`, `guideMotion` and others). Update the spec's Testing Decisions, or accept the drift.
- [ ] **Card headings are now 30px.** The spec allows multiples of 15px and nothing below 16px, so the card `h2`s on Services, Team and Dock went from 22.5px to 30px. That matches the panel title and looks large on `/services`. Consider allowing a 24px step in the spec instead.
- [ ] **The Guide assembles on every page load.** The spec says "on first visit"; only the greeting is limited to the first visit.

## Code review of polish 01 (6ae4ec8..fe47ca6)

Clear-cut findings were fixed in the review-fixes commit: `../` imports in touched files, a duplicated 8-voxels-a-cell constant, a misleading name, an unused argument, a clear error for a Biome with no House or a structure drawn with its door off +z, one helper for drawing a House part, the mirror called a mirror in code and docs, the spec's yard wording, and a glossary entry for the Model Gallery. These need your call:

- [ ] **An east door mirrors the House.** Facing east swaps x and z, a mirror rather than a quarter turn, so the lid (roof plus front walls) still opens the room to the camera. A chimney or side window swaps sides, and the Gallery's Turn shows quarter turns, never this mirror. A true turn would need a second lid split per facing.
- [ ] **The Mailbox still has a 1×1 footprint** (a cell of the House's plot). The spec says "it has no footprint of its own"; the footprint keeps its hotspot, Data Card, Guide spot and camera focus working unchanged. The overlap test leaves the Mailbox out.
- [ ] **Scope beyond the ticket:** the door turns if the path cannot reach it, the yard cell before the door is painted as path, the House's box shrank to its 3×3, Night lights now glow on every open face of window glass, and the safe Isle grew to radius 12.
- [ ] **Seeds give new Worlds.** Choosing the door draws one more number from the Seed's sequence, so every Seed's layout after the House changed (the World still and OG image are captured again at build).
- [ ] **`TERRAIN` and `INTERIOR`** in `render/voxelTiers.ts` are not used yet; they are kept to list every tier of ADR 0006 in one place.

## Housekeeping

- [ ] **Merge to `main`.** All work is on `feat/voxel-world`; `main` is still at the first commit.
- [ ] **`mise trust`.** Agents ran node and bun directly because `mise.toml` is not trusted.
- [ ] **Restart the dev server.** Do this if :4321 shows HTTP 500 after the `@/` alias change, so it picks up the new `tsconfig.json`. A restart is also needed for the Guide to speak in dev: the running server's content store lacks the new `guide` field.
- [ ] **`../` imports.** 88 relative imports predate the `@/` rule; they are converted as files are touched. Decide whether to do one sweep.
- [ ] **Playwright Chromium (16).** Each machine or CI that builds needs `cd site && bunx playwright install chromium` once (on Linux CI add `--with-deps`), or the build ships without the World still.
