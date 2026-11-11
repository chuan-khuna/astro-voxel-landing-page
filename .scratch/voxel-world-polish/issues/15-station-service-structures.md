# 15: Station group with a structure per Service

**What to build:** The Station becomes a group: its own building at the centre and a 2×2 structure for each Service round it, so each Service can be seen in the World.

**Blocked by:** 01, 02, 03

**Status:** needs-info

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0006-voxel-resolution-tiers.md` · Record: `docs/records/2026-11-11-voxel-scale-and-footprints.md`

Needs the user's answers first:
- the group's layout: a 6×4 row (two Services on each side) or a 6×6 ring
- how the layout adapts to the number of Services (four today)
- whether each Service structure can be clicked to open its Service

Then:
- [ ] Each Service has a ⅛-unit ASCII structure, 16×16 voxels on a 2×2 footprint, with one style per Biome. Examples:
  - data engineering: pipes and tanks
  - data platforms: silos or a warehouse
  - analytics: an observatory with a chart board
  - machine learning: a lab
- [ ] Which structure a Service gets is derived from its id, so it stays the same in every World.
- [ ] `generateWorld` places the whole group as one footprint on the high ground, levelled like today's Station. All placement and never-hidden-by-terrain rules still hold over hundreds of Seeds.
- [ ] The Station's hotspot and Data Card cover the group.
- [ ] If Services can be clicked, their click targets do not overlap, and the tap size on phones is checked.
- [ ] Data tests cover every Service structure.
- [ ] The Model Gallery shows the Service structures, and screenshots are attached to the report.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [ ] Spec, glossary and `docs/documents/` (with INDEX) are updated.
