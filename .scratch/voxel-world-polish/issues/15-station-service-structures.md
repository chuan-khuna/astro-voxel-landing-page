# 15: Station group with a structure per Service

**What to build:** The Station becomes a group: a lighthouse at the centre (the company is Lighthouse Data) and a 2×2 structure for each Service round it, so each Service can be seen in the World.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0006-voxel-resolution-tiers.md` · Records: `docs/records/2026-11-11-voxel-scale-and-footprints.md`, `docs/records/2026-11-12-station-group-and-night-light.md`

Answered by the user on 2026-11-12:
- **Layout: a 6×6 ring.** The lighthouse's 2×2 is at the centre and a Service's 2×2 on each side (north, east, south, west):

  ```
  . . S S . .
  . . S S . .
  S S L L S S
  S S L L S S
  . . S S . .
  . . S S . .
  ```
- **More Services use the diagonals.** The group is always 6×6. The first four Services (in content order) take the four sides; Services 5–8 take the four corners. At most 8 show in the World; any more appear only on `/services`. Empty places (fewer than 8 Services) stay open ground, which Decoration may use.
- **Services are not clickable.** The whole group is the Station: one hotspot over the group opens `/services`, as today.
- **The centre is a lighthouse.** It replaces the Station Variants from ticket 03 (the hut with a lattice mast and the round tower): remove those files and update `LANDMARK_VARIANTS`. The glossary's "a lighthouse at its centre" stands.

Then:
- [ ] The central building is a lighthouse, a ⅛-unit ASCII structure on the 2×2 footprint with one style per Biome (a white-and-red tower in the tropics, a stone one in the north, and so on). It stands taller than the House and is the first thing the eye finds in the Overview.
- [ ] Each Service has a ⅛-unit ASCII structure, 16×16 voxels on a 2×2 footprint, with one style per Biome. Examples:
  - data engineering: pipes and tanks
  - data platforms: silos or a warehouse
  - analytics: an observatory with a chart board
  - machine learning: a lab
- [ ] Which structure a Service gets is derived from its id, so it stays the same in every World.
- [ ] `generateWorld` places the whole group as one footprint on the high ground, levelled like today's Station. All placement and never-hidden-by-terrain rules still hold over hundreds of Seeds.
- [ ] The Station's hotspot and Data Card cover the group.
- [ ] Service structures have no hotspot or raycast target of their own; a pointer anywhere on the group reaches the Station.
- [ ] The 6×6 group still fits the Isles from ticket 02 over hundreds of Seeds, Landmark-on-Landmark occlusion (ticket 02) uses the group's heights, and generation stays within the 250 ms test limit. Log the before → after retry and timing figures.
- [ ] Data tests cover every Service structure.
- [ ] The Model Gallery shows the Service structures, and screenshots are attached to the report.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [ ] Spec, glossary and `docs/documents/` (with INDEX) are updated.
