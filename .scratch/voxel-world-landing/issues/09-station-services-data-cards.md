# 09: Station, Services and Data Cards

**What to build:** A visitor opens the Station to read the company's Services, and sees floating Data Cards with key metrics beside Landmarks.

**Blocked by:** 03, 07

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] The Station has a voxel model
- [ ] A `services` MDX collection holds about 4 mock Services, shown on `/services`
- [ ] Data Cards are real HTML text, tilted to the isometric plane with a CSS `matrix3d` matched to the camera
- [ ] A Data Card shows only when the camera is near its Landmark
- [ ] Metrics come from the site data module, keyed to a Landmark id
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
