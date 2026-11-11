# 10: Wind in the plants, falling leaves and rocking boats

**What to build:** The wind sways every instanced plant, drifts leaves across the Isles and rocks boats and ships on the swell.

**Blocked by:** 05, 06, 08, 09

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [ ] Garden trees and flowers, and Decoration's small trees, grass and flower clumps, sway in the vertex shader from the shared wind uniform. The base stays still, the canopy moves at most ½ voxel, and gusts visibly roll across the Isle.
- [ ] Landmarks never sway.
- [ ] Garden tree and flower hotspots still line up with the plants while they sway. Check the tap size on phones again.
- [ ] Falling leaves are ⅛-unit single-colour cubes, coloured from the Biome's foliage roles. They drift with the wind, tumble and fade on landing. The count follows the tier.
- [ ] Moored boats and sailing ships rock on the swell, in step with the water bob.
- [ ] Everything stops when the clock is frozen.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with reduced motion on and off, and with no console errors. Short screen recordings or frame sequences are attached.
- [ ] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.
