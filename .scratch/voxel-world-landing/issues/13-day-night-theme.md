# 13: Day and Night theme

**What to build:** The World and pages follow the visitor's light or dark preference, and a toggle lets them override it.

**Blocked by:** 04

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] One set of OKLCH tokens drives both CSS and the three.js materials
- [ ] A toggle offers Auto, Day and Night; Auto follows `prefers-color-scheme`
- [ ] At Night the House lights are on, buoys glow and the water darkens
- [ ] Changing theme never changes the World's layout
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
