# 12: Clouds and cloud shadows

**What to build:** Clouds drift high over the sea round the Isles, and their soft shadows cross the whole World.

**Blocked by:** 02, 09

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [ ] Clouds are slightly translucent 1-unit voxel masses with the soft-voxel look, in a few shapes drawn as ASCII structures or generated from the Seed. They drift with the wind.
- [ ] Cloud bodies drift only over the sea and never pass over an Isle, at any camera angle the bounds allow.
- [ ] Soft cloud shadows drift across Isles and sea. They are computed in the shader (for example, a scrolling noise mask on the terrain and water materials), not with extra shadow-map casters.
- [ ] Clouds fade out as the camera zooms in on a Landmark, and are gone in the close-up.
- [ ] At Night clouds darken and cast no shadow. If Day/Night is not built yet, note this.
- [ ] Clouds are never raycast or hotspot targets. The cloud count follows the tier, and nothing moves when the clock is frozen.
- [ ] Tests through `generateWorld`: cloud paths are deterministic and stay over the sea.
- [ ] The real page is checked in a browser at desktop and phone sizes on several Seeds, at the Overview and at every Landmark's close-up, with no console errors.
- [ ] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.
