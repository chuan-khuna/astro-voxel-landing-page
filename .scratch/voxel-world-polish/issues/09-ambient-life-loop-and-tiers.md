# 09: Ambient Life render loop, tiers and wind

**What to build:** While the World is visible it renders continuously, with one shared clock and wind that every Ambient Life motion reads. A tier controller scales the motion down on slow devices and stops it under reduced motion.

**Blocked by:** 07

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md` · Record: `docs/records/2026-11-11-voxel-world-ambient-life.md`

- [x] The render loop has two modes. It runs continuously while the tab is shown and the canvas is on screen (`visibilitychange` plus an `IntersectionObserver`). Otherwise it falls back to the existing render on demand, which schedules no `requestAnimationFrame` while idle.
- [x] Phones cap at 30 fps.
- [x] There are three tiers: full, reduced and still. Desktop starts at full and phones at reduced. Frames slower than the target for several seconds drop one tier, which never climbs back during that visit. Still goes back to render on demand.
- [x] Reduced motion means still, and the tier follows the media query if it changes while the page is open.
- [x] One time uniform and one wind uniform (a direction from the Seed, plus gusts that roll across the Isles) are shared by every Ambient Life material. Freezing the clock freezes everything. The Model Gallery and build-time stills use a frozen clock.
- [x] The water bob from ticket 07 moves onto this clock.
- [x] The tier controller is pure logic with unit tests: slow frames drop a tier, it never climbs back, and reduced motion means still. The wind direction is tested deterministic from the Seed through `generateWorld`.
- [x] Camera flights and drags stay smooth with the loop running. Measure and report the frame time on desktop and at phone size.
- [x] The real page is checked in a browser at desktop and phone sizes, with reduced motion on and off, and with the tab hidden. There are no console errors, and `data-frames` stops climbing while the World is hidden or still.
- [x] Spec, `docs/documents/rendering-and-shading.md` (the render on demand section) and INDEX are updated.
- [x] Record the frame target and the tier-drop window you chose under `## Comments`. The record left these open.

## Comments

Built by an agent while the user was away (2026-11-12).

- **Frame target and tier-drop window (the record left these open).** The watch (`site/src/lib/lifeTier.ts`) averages the time between continuous frames over windows of **3 s** (`TIER_WINDOW_MS`). A window averaging under **40 fps** at full, or under **20 fps** at reduced, drops one tier; still cannot drop. A gap over 1 s is not a frame, and one hitch (a shader compiling) does not tip a window. The reduced tier caps ambient frames at 30 fps, so its frames are about 33 ms apart and 20 fps leaves room. The tier never climbs back during the visit. `?life=full|reduced|still` pins a tier, for measuring.
- **Loop.** `site/src/render/ambientLife.ts` owns whether the World is seen (`visibilitychange`, an `IntersectionObserver` on the canvas, reduced motion) and alive (seen, at a tier that moves), the tier watch and the clock. `mountWorld` renders continuously while alive, else on demand as before. The ships, the sea's bob, the developer's work and the Guide's idling all stop together when not alive, so the still tier truly goes back to render on demand. Ambient frames run at the stricter of the render tier's and life tier's rate: 30 fps on phones and at the reduced life tier.
- **Clock and wind.** `site/src/render/ambientClock.ts`: `time` and `wind` uniforms, `windAt(clock, position)` in TSL (the direction times a strength from 0.35 to 1, gusts rolling down the wind at 2.2 units/s about 9 units apart, two bands). `World.wind.direction` comes from `generateWorld`, drawn from the Seed's own sequence (`<seed>/wind`, `world/wind.ts`), so no layout moved. The sea's bob now reads `clock.time` (`seaMaterial(clock)`), and `WorldObjects.swell` became `WorldObjects.step(seconds)`, which sails the ships: the first part of the `objects.step(dt)` split `docs/todo.md` asked for.
- **Frozen clock.** A clock never advanced stays at 0. `buildWorldObjects` makes a frozen one by default. The Model Gallery has no clock-driven material yet; tickets that add one there pass a frozen clock. The build-time stills are captured under reduced motion, so at time 0 (the build captured both stills).
- **Reduced motion bug found and fixed.** Chromium fires no `change` on a `MediaQueryList` whose `matches` was read between the change and the event, and the loop reads it every frame. So the change is heard on a list of its own. Without this, `data-life` stayed `full` after reduced motion turned on.
- **Measured** (headless Chromium, software GL, `lighthouse`; scripts in the session scratchpad):

  | Run | Life tier | Frames | Notes |
  |---|---|---|---|
  | Desktop 1440×900 | full → reduced (≈3 s) → still (≈6 s) | 4–6 fps, then none | `data-frames` stops; clock frozen at 2.73 s |
  | Desktop `?life=full` | full (pinned) | 4–7 fps | hidden, off screen, reduced motion: 0 frames, clock frozen; each resumes |
  | Phone 393×852 @3× | reduced | 27–30 fps | hidden, off screen, reduced motion: 0 frames, clock frozen; each resumes |
  | Camera drag, phone | still / reduced / full | 38.8 / 38.6 / 38.5 ms a frame (p95 ≈ 40) | the loop adds no cost to drags |
  | Camera drag, desktop | still / full | 184 / 186 ms a frame | software GL bound |

  Flights render through the same asked-frame path as drags and were not measured separately.

  No console errors besides the dev server's 404 for `/stills/*.webp` (the stills exist only in a build; seen in earlier tickets too). A real phone and a real desktop GPU were not measured.
- Screenshots: `screenshots/09-desktop.png` (after dropping to still), `09-desktop-lifefull.png`, `09-desktop-lifestill.png`, `09-phone.png`, `09-phone-lifestill.png`, `09-desktop-stats-dropped-to-still.png` (the stats card's new `life` row reading `still`, FPS `idle`).
- **For tickets 10–14.** Read `clock.time` and `windAt(clock, positionWorld)` in materials; put CPU motion in `WorldObjects.step(seconds)`; scale counts by `LIFE_TIERS[tier].share`. Counts are not yet rebuilt when the tier drops during a visit (nothing uses `share` yet); the first ticket that does decides whether to thin instances on a drop or keep the count fixed for the visit.
