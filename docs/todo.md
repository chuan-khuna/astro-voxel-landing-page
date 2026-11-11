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

## Known issues not yet fixed

- [ ] **Landmarks can hide each other.** On Seed `lanternfish` the House partly hides the Mailbox. Placement only checks terrain and bridges. Suggested fix: add Landmark-on-Landmark occlusion to polish 02 (bigger Isles).
- [ ] **Garden trees merge into a hedge (08)** and are about 13×15px to tap on phones. Fixed by design in polish 05.
- [ ] **Phone Data Cards:** the House's "12 years" card hangs over the House base in close-up, and the Station's can cross the bottom edge by about 4px.
- [ ] **Code-built models to port.** The Station (09), Mailbox (12), boats and ships (10) and the House room (11) are still code-built and will need porting to ASCII structures in the polish feature.

## Housekeeping

- [ ] **Merge to `main`.** All work is on `feat/voxel-world`; `main` is still at the first commit.
- [ ] **`mise trust`.** Agents ran node and bun directly because `mise.toml` is not trusted.
- [ ] **Restart the dev server.** Do this if :4321 shows HTTP 500 after the `@/` alias change, so it picks up the new `tsconfig.json`. A restart is also needed for the Guide to speak in dev: the running server's content store lacks the new `guide` field.
- [ ] **`../` imports.** 88 relative imports predate the `@/` rule; they are converted as files are touched. Decide whether to do one sweep.
