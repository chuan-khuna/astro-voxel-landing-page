# 11: House and House Interior

**What to build:** A visitor clicks the House, its roof lifts, and the camera dives into a room with a developer at a computer. About opens beside it, and clicking the developer opens Team.

**Blocked by:** 04, 07

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

- [ ] The House has a voxel model with a roof that lifts
- [ ] The interior is a ¼-unit voxel room with a desk, a computer whose screen animates code or data, and an animated developer
- [ ] `/about` opens beside the room; clicking the developer opens `/about/team`
- [ ] A `team` MDX collection holds about 4 mock Team Members
- [ ] Leaving the pages lowers the roof and returns the camera to the World
- [ ] `astro check` and `astro build` pass
- [ ] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
