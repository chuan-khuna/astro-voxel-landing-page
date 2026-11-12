# 18: Phone layout with a scroll-led camera

**What to build:** On a phone the site reads top to bottom. The sections stack as one scrolling page over the World, and as each section scrolls into view the camera glides slowly to that section's Landmark. The phone never zooms out to the whole Isle. The rest of the site is checked and fixed so it works at every width.

**Blocked by:** 17

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · Record: `docs/records/2026-11-12-phone-scroll-camera.md`

## The user's decision (2026-11-12)

"Make the site responsive. On mobile the camera takes you to focus on each place, the camera moves slowly, and mobile does not zoom out to the whole Isle." Asked how the camera should move, the user chose: **it follows the scroll.** Not on its own (no autoplay), and not only on menu taps.

## Phone layout (below 48rem, the existing phone breakpoint)

- [ ] The World canvas stays fixed full-screen behind the page. Over it, the intro and every section (the routes in `pages/home.mdx` order: Services, Garden, About/Team, Dock, Contact, and so on) stack as one vertical scrolling page of cards or sheets, replacing today's one-panel-at-a-time bottom sheet on phones.
- [ ] Each section is bound to its Landmark (the same pairing the menu and routes use today). Leave enough World visible between or beside the cards that the Landmark in focus can be seen; choose the card size and spacing for that, and log the choice.
- [ ] The intro frames a Landmark close up (the Station, or the first section's Landmark), never the whole Isle.
- [ ] Desktop and tablet (48rem and up) keep today's layout and camera, including the Overview.

## Scroll-led camera (phone)

- [ ] As the page scrolls, the camera moves from one Landmark's close-up to the next, driven by scroll position: between two sections it is part-way between their framings, so it follows the finger rather than jumping when a threshold is crossed. Ease it, and smooth or damp it so the motion feels slow and calm even on a fast flick. Keep the camera within the existing pan bounds and close-up zoom; it never pulls out to the Overview.
- [ ] Opening the House (About/Team) and its lid follow the same scroll position, so the lid lifts as you scroll into that section and comes down as you leave it (ticket 17 keeps the room in the World).
- [ ] The URL follows the section in view (`history.replaceState`, no new history entries while scrolling), and opening a section's URL directly on a phone scrolls to it with the camera already there. Menu links, the Landmark hotspots and the browser's back and forward buttons scroll to their section.
- [ ] While the page scrolls, dragging the World does not fight the scroll: decide how touch on the canvas behaves (for example, vertical swipes scroll the page and the World cannot be panned on phones), and log it.
- [ ] Reduced motion: no glide; the camera cuts to each section's framing as its section takes over.
- [ ] The Tour on a phone either follows the same scroll (each Tour step scrolls to its section) or is hidden on phones. Choose the simpler, log it, and keep the Guide's bubble clear of the cards.
- [ ] Data Cards on a phone show for the Landmark in focus only, and stay clear of the section cards. Fix the open "Phone Data Cards" known issue in `docs/todo.md` if this touches it.
- [ ] The camera follows the life and render tiers (`lib/lifeTier.ts`, `lib/renderTier.ts`): scroll-driven camera moves render at full rate, as camera moves do today.
- [ ] Test seams: a pure function from scroll progress to camera framing (which two sections, how far between, the eased framing), tested without a browser, plus the existing `cameraMath`.

## Responsive pass (all widths)

- [ ] Check every route at 320, 375, 390, 768, 1024 and 1440 px wide, portrait and landscape, Day and Night: no horizontal scroll, nothing cut off or overlapping, text at least 16px, tap targets at least 44×44 px.
- [ ] Fix what fails, including the open phone items in `docs/todo.md` this ticket touches (for example the Garden's small plant links on phones from ticket 05, the Tour's phone issues from the landing feature). Tick the ones fixed; log the rest.
- [ ] Without JS or a GPU, the page still reads as a normal scrolling page with the World still (today's fallback).

## Done when

- [ ] Checked in a real browser at phone size (390×844 touch) on Seeds covering all four Biomes: scrolling top to bottom glides through every Landmark without ever showing the whole Isle; deep links, menu, back and forward work; no console errors. A short frame sequence or screen recording frames are attached (`.scratch/voxel-world-polish/screenshots/18-*.png`).
- [ ] Desktop is unchanged (screenshots before and after).
- [ ] Spec, `GLOSSARY.md` (if a new term is needed), `docs/documents/` (with INDEX) and the record are updated.
