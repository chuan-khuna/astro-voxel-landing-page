# 08: Garden and Projects

**What to build:** A visitor sees one tree per Project in the Garden, browses all Projects, and opens a Project's case study by clicking its tree.

**Blocked by:** 03, 07

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] A `projects` MDX collection with a validated schema holds about 6 mock Projects
- [x] The generator places one tree per Project, in stable order by id, up to a cap of 24; Projects beyond the cap still appear on the page
- [x] `/garden` lists every Project; `/garden/[slug]` shows the full case study
- [x] Clicking a tree opens that Project's page
- [x] Vitest: tree count equals Project count up to the cap, and 0 Projects is handled
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
