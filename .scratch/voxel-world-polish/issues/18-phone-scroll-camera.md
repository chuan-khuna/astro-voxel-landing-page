# 18: Phone layout with a scroll-led camera

**What to build:** On a phone the site reads top to bottom. The sections stack as one scrolling page over the World, and as each section scrolls into view the camera glides slowly to that section's Landmark. The phone never zooms out to the whole Isle. The rest of the site is checked and fixed so it works at every width.

**Blocked by:** 17

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · Record: `docs/records/2026-11-12-phone-scroll-camera.md`

## The user's decision (2026-11-12)

"Make the site responsive. On mobile the camera takes you to focus on each place, the camera moves slowly, and mobile does not zoom out to the whole Isle." Asked how the camera should move, the user chose: **it follows the scroll.** Not on its own (no autoplay), and not only on menu taps.

## Phone layout (below 48rem, the existing phone breakpoint)

- [x] The World canvas stays fixed full-screen behind the page. Over it, the intro and every section (the routes in `pages/home.mdx` order: Services, Garden, About/Team, Dock, Contact, and so on) stack as one vertical scrolling page of cards or sheets, replacing today's one-panel-at-a-time bottom sheet on phones.
- [x] Each section is bound to its Landmark (the same pairing the menu and routes use today). Leave enough World visible between or beside the cards that the Landmark in focus can be seen; choose the card size and spacing for that, and log the choice.
- [x] The intro frames a Landmark close up (the Station, or the first section's Landmark), never the whole Isle.
- [x] Desktop and tablet (48rem and up) keep today's layout and camera, including the Overview.

## Scroll-led camera (phone)

- [x] As the page scrolls, the camera moves from one Landmark's close-up to the next, driven by scroll position: between two sections it is part-way between their framings, so it follows the finger rather than jumping when a threshold is crossed. Ease it, and smooth or damp it so the motion feels slow and calm even on a fast flick. Keep the camera within the existing pan bounds and close-up zoom; it never pulls out to the Overview.
- [x] Opening the House (About/Team) and its lid follow the same scroll position, so the lid lifts as you scroll into that section and comes down as you leave it (ticket 17 keeps the room in the World).
- [x] The URL follows the section in view (`history.replaceState`, no new history entries while scrolling), and opening a section's URL directly on a phone scrolls to it with the camera already there. Menu links, the Landmark hotspots and the browser's back and forward buttons scroll to their section.
- [x] While the page scrolls, dragging the World does not fight the scroll: decide how touch on the canvas behaves (for example, vertical swipes scroll the page and the World cannot be panned on phones), and log it.
- [x] Reduced motion: no glide; the camera cuts to each section's framing as its section takes over.
- [x] The Tour on a phone either follows the same scroll (each Tour step scrolls to its section) or is hidden on phones. Choose the simpler, log it, and keep the Guide's bubble clear of the cards.
- [x] Data Cards on a phone show for the Landmark in focus only, and stay clear of the section cards. Fix the open "Phone Data Cards" known issue in `docs/todo.md` if this touches it.
- [x] The camera follows the life and render tiers (`lib/lifeTier.ts`, `lib/renderTier.ts`): scroll-driven camera moves render at full rate, as camera moves do today.
- [x] Test seams: a pure function from scroll progress to camera framing (which two sections, how far between, the eased framing), tested without a browser, plus the existing `cameraMath`.

## Responsive pass (all widths)

- [x] Check every route at 320, 375, 390, 768, 1024 and 1440 px wide, portrait and landscape, Day and Night: no horizontal scroll, nothing cut off or overlapping, text at least 16px, tap targets at least 44×44 px.
- [x] Fix what fails, including the open phone items in `docs/todo.md` this ticket touches (for example the Garden's small plant links on phones from ticket 05, the Tour's phone issues from the landing feature). Tick the ones fixed; log the rest.
- [x] Without JS or a GPU, the page still reads as a normal scrolling page with the World still (today's fallback).

## Done when

- [x] Checked in a real browser at phone size (390×844 touch) on Seeds covering all four Biomes: scrolling top to bottom glides through every Landmark without ever showing the whole Isle; deep links, menu, back and forward work; no console errors. A short frame sequence or screen recording frames are attached (`.scratch/voxel-world-polish/screenshots/18-*.png`).
- [x] Desktop is unchanged (screenshots before and after).
- [x] Spec, `GLOSSARY.md` (if a new term is needed), `docs/documents/` (with INDEX) and the record are updated.

## Comments

Built in polish 18 (`feat(site): ... (polish 18)`). Choices logged in `docs/todo.md` ("Polish 18: ..."):

- **Layout:** each section is a 58svh window of World and then its card at full width; the top bar stays at the top and the dice row at the bottom left. Every page renders every section (`WorldPage.astro`, `SectionContent.astro`); the page's own panel takes its section's place.
- **Camera:** holds while a card is read, glides while the next window scrolls in, eased, with 320 ms damping (`render/storyMath.ts`, `dampState`, `client/storyScroll.ts`). The intro frames the Station at 0.8 of its close-up; the Garden at the camera's closest zoom. Lowest zoom seen on the four Biome walks: 2.47 (the Overview is 1).
- **Touch:** the World takes no pan or zoom on phones; every swipe scrolls the page.
- **Tour:** hidden on phones (the simpler choice); the Guide's bubble and the Data Cards wait while a card covers them.
- **Responsive pass:** every route at 320, 375, 390, 768, 1024, 1366 and 1440 wide, portrait and landscape, Day and Night: no horizontal scroll, no text under 16px; tap targets fixed to 44px (theme toggle, menu button, popover links, dice, company name on phones; menu bar links, close link, dice and Tour button on touch screens). Not fixed: the dev-only stats toggle (35px), the desktop menu bar and close link with a mouse, and Garden flowers (about 32×37px at the closest zoom the World allows; the Project list is the tap-sized way in).
- **Checked** at 390×844 touch on `harbour`, `seed-2`, `lanternfish` and `42` (all four Biomes), swiping on the World top to bottom: every route in order, no console errors (`screenshots/18-walk-<seed>-sheet.png` has every frame of each walk, and every eighth frame is kept full size; Night: `18-walk-lanternfish-night-*`; reduced motion: `18-walk-harbour-reduced-*`; Data Cards: `18-card-*`). Desktop before and after: `18-desktop-before-*`, `18-desktop-after-*` (only the theme toggle is 4px bigger).
- **Browser tests** (extra scope, approved): `site/e2e/smoke.spec.ts` and `site/e2e/phone-scroll.spec.ts`, `bun run e2e`.
- **Not done:** a check on a real phone (only Chromium's phone emulation with SwiftShader).
