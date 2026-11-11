# 09: Ambient Life render loop, tiers and wind

**What to build:** While the World is visible it renders continuously, with one shared clock and wind that every Ambient Life motion reads. A tier controller scales the motion down on slow devices and stops it under reduced motion.

**Blocked by:** 07

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md` · Record: `docs/records/2026-11-11-voxel-world-ambient-life.md`

- [ ] The render loop has two modes. It runs continuously while the tab is shown and the canvas is on screen (`visibilitychange` plus an `IntersectionObserver`). Otherwise it falls back to the existing render on demand, which schedules no `requestAnimationFrame` while idle.
- [ ] Phones cap at 30 fps.
- [ ] There are three tiers: full, reduced and still. Desktop starts at full and phones at reduced. Frames slower than the target for several seconds drop one tier, which never climbs back during that visit. Still goes back to render on demand.
- [ ] Reduced motion means still, and the tier follows the media query if it changes while the page is open.
- [ ] One time uniform and one wind uniform (a direction from the Seed, plus gusts that roll across the Isles) are shared by every Ambient Life material. Freezing the clock freezes everything. The Model Gallery and build-time stills use a frozen clock.
- [ ] The water bob from ticket 07 moves onto this clock.
- [ ] The tier controller is pure logic with unit tests: slow frames drop a tier, it never climbs back, and reduced motion means still. The wind direction is tested deterministic from the Seed through `generateWorld`.
- [ ] Camera flights and drags stay smooth with the loop running. Measure and report the frame time on desktop and at phone size.
- [ ] The real page is checked in a browser at desktop and phone sizes, with reduced motion on and off, and with the tab hidden. There are no console errors, and `data-frames` stops climbing while the World is hidden or still.
- [ ] Spec, `docs/documents/rendering-and-shading.md` (the render on demand section) and INDEX are updated.
- [ ] Record the frame target and the tier-drop window you chose under `## Comments`. The record left these open.
