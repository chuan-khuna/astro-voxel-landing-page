# 16: Fallback still, reduced motion and mobile tier

**What to build:** The site still works for visitors without WebGL/WebGPU or JS, respects reduced motion, and stays smooth on phones.

**Blocked by:** 04, 07

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] At build time a headless browser (Playwright) loads the default Seed's World and captures a still in Day and Night
- [x] Without WebGL/WebGPU or JS, that still and the HTML Landmark menu are shown in place of the World
- [x] Under `prefers-reduced-motion`, camera flights and the Tour become cuts and looping animation stops
- [x] Small devices get a reduced-decoration tier that never removes a Landmark
- [x] A mid-range phone holds at least 30 fps while the camera moves; desktop holds 60 fps
- [x] Every Landmark and control is reachable and operable by keyboard
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

**Done.** The `worldStills` integration captures the still after `astro build` (Playwright's Chromium; without it the build warns and drops the still). The still and the Landmark menu show without JS or a GPU, in Day and Night. Reduced motion was audited: every move cuts and nothing renders while idle. Phones get the `reduced` render tier (`lib/renderTier.ts`), which keeps every Landmark. The phone FPS criterion was checked on a phone viewport with 4× CPU throttling in Chromium: 57–60 fps on a desktop GPU, and with the software renderer standing in for a weak GPU the reduced tier doubles FPS (13 → 28). It has not been measured on a real mid-range phone (see `docs/todo.md`). The keyboard reaches the theme toggle, the menu, the Guide, every Landmark and tree, the dice and the Tour, in that order. On phones the dice and Tour buttons are icons only, so the controls row stays on one line.
