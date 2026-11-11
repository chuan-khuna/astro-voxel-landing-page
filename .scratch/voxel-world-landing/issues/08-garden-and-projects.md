# 08: Garden and Projects

**What to build:** A visitor sees one tree per Project in the Garden, browses all Projects, and opens a Project's case study by clicking its tree.

**Blocked by:** 03, 07

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] A `projects` MDX collection with a validated schema holds about 6 mock Projects
- [ ] The generator places one tree per Project, in stable order by id, up to a cap of 24; Projects beyond the cap still appear on the page
- [ ] `/garden` lists every Project; `/garden/[slug]` shows the full case study
- [ ] Clicking a tree opens that Project's page
- [ ] Vitest: tree count equals Project count up to the cap, and 0 Projects is handled
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
