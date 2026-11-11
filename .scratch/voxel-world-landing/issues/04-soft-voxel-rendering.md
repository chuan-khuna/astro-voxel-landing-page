# 04: Soft voxel rendering

**What to build:** The World looks like the approved prototype: soft voxels with seams, bevels, colour jitter, AO and soft shadows, and it stays light enough for phones.

**Blocked by:** 01, 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] The mesher builds chunked geometry with hidden faces culled and same-colour coplanar faces greedy-merged
- [ ] AO is baked into vertex colours
- [ ] Terrain uses 1-unit voxels; Landmarks and decoration use ¼-unit voxels
- [ ] Seams, bevel and colour jitter are computed in TSL from world position, so merged faces still read as single voxels, matching the settings approved in ticket 01
- [ ] The shadow map renders only when the World changes, and frames render only while something moves
- [ ] DPR is capped at 1.5 on mobile and 2 on desktop
- [ ] The default World is at most 300k triangles
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
