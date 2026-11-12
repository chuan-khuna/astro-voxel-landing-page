# 06: Explore the World by pan and zoom

**What to build:** A visitor moves around the World like a map, on desktop and on a phone.

**Blocked by:** 02

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] Drag pans; wheel or trackpad zooms; on touch, one finger pans and pinch zooms
- [x] Pan and zoom are clamped to the World's bounds
- [x] Landmarks show a hover affordance and can take keyboard focus
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes

## Comments

- 2026-11-11: Done. Hand-written pointer handling, no OrbitControls. `site/src/render/cameraMath.ts` (pure, tested: pan, zoom toward a point, clamp) and `cameraRig.ts` (mouse drag, wheel and ctrl+wheel trackpad pinch, one-finger pan and two-finger pinch on touch; `touch-action: none` on the World frame; no rotation). Pan is clamped to the union of the Isles' footprints, zoom from the Overview (1) to `max(2, radius / 3)`; both reset when a new World is rolled. The rig's `jumpTo(CameraState)` is what a flight (07) will tween; a cut under reduced motion is one `jumpTo`. Landmarks get hotspot links over the canvas (`landmarkHotspots.ts`), sized from each model's measured extent (`landmarkExtent`, no one-cell assumption), with an outline and label on hover and keyboard focus; focusing an off-screen one cuts the camera to it. Render on demand kept: frames only while the camera moves, and three's internal animation loop is stopped after each frame so an idle page schedules no `requestAnimationFrame`. Verified in headless Chrome (WebGPU and WebGL 2) with mouse drag, wheel, and CDP touch pan and pinch: camera moves, clamps at both pan bounds and both zoom limits, 0 frames and 0 rAF while idle, page never scrolls, drags never follow a link, dice still rolls, no console errors. Note: the wheel over the World always zooms, so the page can't be scrolled with the wheel while the cursor is over the World.
