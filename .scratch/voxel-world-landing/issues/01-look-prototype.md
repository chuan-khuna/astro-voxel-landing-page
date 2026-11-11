# 01: Look prototype for soft voxels

**What to build:** A throwaway single-page three.js prototype that shows the target look, so the user can approve it before the real work. It shows one House, a tree and a terrain patch under an isometric orthographic camera, using `WebGPURenderer` and TSL, with seams, bevel shading, per-voxel colour jitter and baked AO, in a muted OKLCH palette. The reference is the user's whitewashed voxel house described in the discussion record.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] The prototype runs in a browser and shows the House, a tree and a terrain patch in two voxel sizes (1 unit and ¼ unit)
- [ ] Seams, bevel, colour jitter and AO are visible and can be tuned from a few constants
- [ ] Every colour has OKLCH chroma ≤ 0.10
- [ ] It works on the WebGL 2 fallback as well as WebGPU
- [ ] The user has reviewed it and approved the look, and the approved settings are written down for ticket 04
