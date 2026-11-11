# 05: Roll and share a Seed

**What to build:** A visitor clicks a dice button and gets a brand-new World without the page freezing, and can share it by URL.

**Blocked by:** 03

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] A dice button rolls a new numeric Seed and regenerates the World
- [ ] The URL updates with `?seed=`, and opening that URL shows the same World
- [ ] Generation runs in a Web Worker, finishes within 1 second, and results are cached per Seed
- [ ] With no `?seed=`, the default Seed from the site data module is used
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
