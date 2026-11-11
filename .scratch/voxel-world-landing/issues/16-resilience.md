# 16: Fallback still, reduced motion and mobile tier

**What to build:** The site still works for visitors without WebGL/WebGPU or JS, respects reduced motion, and stays smooth on phones.

**Blocked by:** 04, 07

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] At build time a headless browser (Playwright) loads the default Seed's World and captures a still in Day and Night
- [ ] Without WebGL/WebGPU or JS, that still and the HTML Landmark menu are shown in place of the World
- [ ] Under `prefers-reduced-motion`, camera flights and the Tour become cuts and looping animation stops
- [ ] Small devices get a reduced-decoration tier that never removes a Landmark
- [ ] A mid-range phone holds at least 30 fps while the camera moves; desktop holds 60 fps
- [ ] Every Landmark and control is reachable and operable by keyboard
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
