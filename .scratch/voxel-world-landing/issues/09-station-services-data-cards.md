# 09: Station, Services and Data Cards

**What to build:** A visitor opens the Station to read the company's Services, and sees floating Data Cards with key metrics beside Landmarks.

**Blocked by:** 03, 07

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] The Station has a voxel model
- [x] A `services` MDX collection holds about 4 mock Services, shown on `/services`
- [x] Data Cards are real HTML text, tilted to the isometric plane with a CSS `matrix3d` matched to the camera
- [x] A Data Card shows only when the camera is near its Landmark
- [x] Metrics come from the site data module, keyed to a Landmark id
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
