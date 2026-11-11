# 07: Voxel water

**What to build:** The sea becomes a translucent voxel layer that shades from shallow to deep and bobs gently.

**Blocked by:** 02

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] The sea is a 1-unit voxel layer with the soft-voxel seam and bevel look, and it still fills the frame at any aspect ratio.
- [ ] It is slightly translucent over shallow ground. Colour runs from the Biome's shallow to deep water by distance from the coast.
- [ ] A gentle per-voxel bob is computed in the shader. It stops under reduced motion, and the idle page still schedules no needless frames beyond the bob.
- [ ] The Dock jetty, moored boats and sailing ships still sit correctly on the water.
- [ ] Night darkens the water as the base spec says, if the Day/Night theme exists.
- [ ] The real page is checked in a browser at desktop and phone sizes, with frame rate noted on the phone size and no console errors.
- [ ] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.
