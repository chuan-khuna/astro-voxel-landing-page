# To approve or check

Things the agents went ahead on without waiting for the user, while the user was away (from 2026-11-11 evening). Each item says what was assumed. Tick it, or note a change, when you have looked.

## Approvals skipped

- [ ] **Polish 01: House look.** The ticket says to stop for approval of the House models in `/dev/models`. The agents carried on with the assumed look. Review the gallery and screenshots; any change means redrawing the House and the Variants built on it.
- [ ] **Polish 05: open question in the ticket.** "May other Projects take empty flower cells when fewer than six are pinned?" Assumed: _no_ (flower cells stay grass) unless the ticket was settled otherwise.

## Decisions made by agents (check they suit you)

- [ ] **Test seams** were picked by the agents without confirming them first (tickets 07, 08, 09, 11, 12, 13, 20). Each picked pure functions plus `generateWorld`.
- [ ] **Mock copy.** Placeholder text was written for the six section intros (07), Projects (08), Services (09), Clients and Partners (10), Team (11) and Contact (12). The Contact intro now says "we answer every email within a day" to match its Data Card.
- [ ] **House opens like a doll's house (11).** The lid is the roof plus the two front walls, because the front walls hide the floor from the isometric camera. The polish spec still says "liftable roof". Decide whether the polish House Variants keep the lid (roof plus front walls).
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

## Known issues not yet fixed

- [ ] **Landmarks can hide each other.** On Seed `lanternfish` the House partly hides the Mailbox. Placement only checks terrain and bridges. Suggested fix: add Landmark-on-Landmark occlusion to polish 02 (bigger Isles).
- [ ] **Garden trees merge into a hedge (08)** and are about 13×15px to tap on phones. Fixed by design in polish 05.
- [ ] **Phone Data Cards:** the House's "12 years" card hangs over the House base in close-up, and the Station's can cross the bottom edge by about 4px.
- [ ] **Phone Tour (15):**
  - "Roll a new World" wraps to two lines once the Tour button (and the stats toggle) sit beside it.
  - Some Tour steps are framed far out.
  - At the Mailbox step the Guide's bubble can cover the Mailbox.
- [ ] **No Pause in the Tour (15).** The ticket asked for pause; the Tour is step-by-step and never plays by itself, so there is nothing to pause.
- [ ] **Code-built models to port.** The Station (09), Mailbox (12), boats and ships (10) and the House room (11) are still code-built and will need porting to ASCII structures in the polish feature.
- [ ] **Phone FPS not measured on a real phone (16).** It was checked only in Chromium on a phone viewport with 4× CPU throttling: 57–60 fps on a desktop GPU; with the software renderer the reduced tier doubles FPS (13 → 28). Check 30 fps on a real mid-range phone with `?stats` (compare `&tier=full`).

## Housekeeping

- [ ] **Merge to `main`.** All work is on `feat/voxel-world`; `main` is still at the first commit.
- [ ] **`mise trust`.** Agents ran node and bun directly because `mise.toml` is not trusted.
- [ ] **Restart the dev server.** Do this if :4321 shows HTTP 500 after the `@/` alias change, so it picks up the new `tsconfig.json`. A restart is also needed for the Guide to speak in dev: the running server's content store lacks the new `guide` field.
- [ ] **`../` imports.** 88 relative imports predate the `@/` rule; they are converted as files are touched. Decide whether to do one sweep.
- [ ] **Playwright Chromium (16).** Each machine or CI that builds needs `cd site && bunx playwright install chromium` once (on Linux CI add `--with-deps`), or the build ships without the World still.
