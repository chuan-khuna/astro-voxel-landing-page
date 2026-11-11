# 20: Render stats overlay

**What to build:** A small stats card at the top right of the page shows FPS and counts of voxels and other render stats. Developers turn it on and off with a toggle beside the Seed dice. Ordinary visitors never see it.

**Blocked by:** 13 (the theme toggle may also sit over the World), 19

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

Requested by the user on 2026-11-11: "show fps at the top right of the page, count number of voxels/stat". Visibility: only in dev or with `?stats` in the URL. The toggle sits by the random Seed button ("ปรับได้ตรงปุ่ม random seed").

## Visibility

- [x] The stats toggle exists only in `astro dev`, or in any build when the URL has `?stats`. Without either, no toggle, no card and no stats code path runs, and production pages are unchanged.
- [x] The toggle is an icon button inside the bottom-left dice and Seed card, next to the dice. It has an `aria-label` and `aria-pressed` and is reachable by keyboard.
- [x] The toggle's on/off state is remembered per browser (`localStorage`, wrapped in try/catch), so it survives route changes, reloads and Seed rolls.
- [x] `?stats` survives client-side route changes and Seed rolls, like `?seed=`.

## The card

- [x] Floating card at the top right, below the Landmark menu bar. On phones it sits below the menu button. It matches the floating-card style of ticket 19 and both themes of ticket 13.
- [x] It never covers a section panel's content and never takes pointer input meant for the World (`pointer-events: none` except on itself, if anything there is interactive).
- [x] It shows:
  - FPS and frame time in ms. FPS is only measured while frames render. When the page renders nothing (on-demand rendering), it shows "idle" instead of a stale or zero FPS.
  - Voxel counts: total, and split by kind (terrain, Landmarks, boats, ships, trees, the House room, plus any other kinds present).
  - Triangles and draw calls, from the renderer's info.
  - Backend: WebGPU or WebGL 2.
  - World generation time in ms and retry count for the current Seed.
  - The current Seed and Biome.
- [x] Voxel counts come from the World data and meshes, counted once per World build, not every frame. They update when a new Seed is rolled.
- [x] Updating the card does not itself cause extra frames to render. It reads stats from frames that render anyway, and updates text at most about 4 times a second.

## Checks

- [x] Tests (tdd): voxel counting by kind for a generated World, FPS/idle smoothing maths, and the visibility rule (dev or `?stats`).
- [x] `astro check`, the full test suite and `astro build` pass.
- [x] The real page is checked in a browser at desktop and phone sizes:
  - without `?stats`: no toggle and no card
  - with `?stats`: the toggle works, the card updates, "idle" shows when nothing moves, and live FPS shows while ships sail or the House opens
  - in both themes
  - there are no console errors
  
  Screenshots are attached to the report.
- [x] `docs/documents/` (with INDEX) and the spec are updated.
