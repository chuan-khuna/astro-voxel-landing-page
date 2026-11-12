# 01: Look prototype for soft voxels

**What to build:** A throwaway single-page three.js prototype that shows the target look, so the user can approve it before the real work. It shows one House, a tree and a terrain patch under an isometric orthographic camera, using `WebGPURenderer` and TSL, with seams, bevel shading, per-voxel colour jitter and baked AO, in a muted OKLCH palette. The reference is the user's whitewashed voxel house described in the discussion record.

**Blocked by:** None (can start immediately)

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] The prototype runs in a browser and shows the House, a tree and a terrain patch in two voxel sizes (1 unit and ¼ unit)
- [x] Seams, bevel, colour jitter and AO are visible and can be tuned from a few constants
- [x] Every colour has OKLCH chroma ≤ 0.10
- [x] It works on the WebGL 2 fallback as well as WebGPU
- [x] The user has reviewed it and approved the look, and the approved settings are written down for ticket 04

## Comments

**2026-11-11 — prototype built; awaiting the user's look review.** The last box stays open until the user approves the look.

Lives in `prototypes/look/`. It is a Vite page using three.js r187 (`three/webgpu`, `three/tsl`). It is separate from the future `site/`.

Run it:

```sh
cd prototypes/look
bun install
bun run dev        # then open the printed URL; add ?webgl to force the WebGL 2 fallback
```

What it shows:
- A 1-unit terrain patch: sand rim, grass plateau, a small hill, and a translucent water plane.
- A ¼-unit whitewashed Cycladic House: plinth, parapet roof, upper block with a blue dome, blue door and shutters, outside stair with a blue rail, chimney and bougainvillea.
- A ¼-unit olive tree.
- An orthographic isometric camera. OrbitControls stay on for inspection.

How it works:
- Seams, bevel (a tilted normal near voxel edges) and per-voxel colour jitter are computed in TSL from world position.
- AO is baked per vertex by the mesher.
- All tunables sit in the `LOOK` object at the top of `main.js` and in a lil-gui panel. **Copy settings** puts the current values on the clipboard as JSON (and logs them), so the approved values can be written down for ticket 04.
- Palette colours are OKLCH in `PALETTE`. Startup throws if any chroma is > 0.10.

Checked:
- `bun run build` passes.
- Headless Chrome loads the page with no console errors or warnings on both backends. The HUD reports `WebGPU` by default and `WebGL 2` with `?webgl`, and the two renders look the same.

Prototype shortcuts (not decisions for the real renderer):
- No greedy merge.
- AO is kept in its own `ao` vertex attribute, not multiplied into `color`, so its strength stays tunable.
- Frames render every frame instead of on demand.
- The shadow map is not static.

**2026-11-11 — look approved by the user as shipped (default settings).** Ticket 04 should match this look. Approved settings, from `LOOK` and `PALETTE` at the top of `prototypes/look/main.js` (commit `9580bec`):

```js
const LOOK = {
  seamWidth: 0.035, seamDarkness: 0.22,
  bevelWidth: 0.16, bevelStrength: 0.55,
  jitter: 0.035, tintJitter: 0.015,
  aoStrength: 0.55, roughness: 0.9,
  sunIntensity: 2.4, sunAzimuth: 35, sunElevation: 52,
  skyIntensity: 1.1, exposure: 1.0,
};
```

The House colours in `PALETTE` (whitewash, roof white, plinth, blue trim and door, glass, bougainvillea) are the approved fixed House colours.
