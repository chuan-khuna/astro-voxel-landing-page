# 13: Day and Night theme

**What to build:** The World and pages follow the visitor's light or dark preference, and a toggle lets them override it.

**Blocked by:** 04

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] One set of OKLCH tokens drives both CSS and the three.js materials
- [x] A toggle offers Auto, Day and Night; Auto follows `prefers-color-scheme`
- [x] At Night the House lights are on, buoys glow and the water darkens
- [x] Changing theme never changes the World's layout
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
