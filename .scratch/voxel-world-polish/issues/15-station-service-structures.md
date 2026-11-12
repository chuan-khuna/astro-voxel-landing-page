# 15: Station group with a structure per Service

**What to build:** The Station becomes a group: a lighthouse at the centre (the company is Lighthouse Data) and a 2×2 structure for each Service round it, so each Service can be seen in the World.

**Blocked by:** 01, 02, 03

**Status:** resolved

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
- [x] The central building is a lighthouse, a ⅛-unit ASCII structure on the 2×2 footprint with one style per Biome (a white-and-red tower in the tropics, a stone one in the north, and so on). It stands taller than the House and is the first thing the eye finds in the Overview.
- [x] Each Service has a ⅛-unit ASCII structure, 16×16 voxels on a 2×2 footprint, with one style per Biome. Examples:
  - data engineering: pipes and tanks
  - data platforms: silos or a warehouse
  - analytics: an observatory with a chart board
  - machine learning: a lab
- [x] Which structure a Service gets is derived from its id, so it stays the same in every World.
- [x] `generateWorld` places the whole group as one footprint on the high ground, levelled like today's Station. All placement and never-hidden-by-terrain rules still hold over hundreds of Seeds.
- [x] The Station's hotspot and Data Card cover the group.
- [x] Service structures have no hotspot or raycast target of their own; a pointer anywhere on the group reaches the Station.
- [x] The 6×6 group still fits the Isles from ticket 02 over hundreds of Seeds, Landmark-on-Landmark occlusion (ticket 02) uses the group's heights, and generation stays within the 250 ms test limit. Log the before → after retry and timing figures.
- [x] Data tests cover every Service structure.
- [x] The Model Gallery shows the Service structures, and screenshots are attached to the report.
- [x] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with no console errors.
- [x] Spec, glossary and `docs/documents/` (with INDEX) are updated.

## Comments

**Built (polish 15, 2026-11-12).**
- `world/station.ts`: the 6×6 group. The lighthouse's 2×2 is in the middle; `SERVICE_PLACES` fills the sides then the corners; at most `MAX_SERVICES` (8); `serviceKind(id)`. `PlacedLandmark.services` lists each Service's id, place and kind. `ContentCounts.serviceIds` arrive in content order (`lib/services.ts` `serviceOrder`, shared with `ServiceList.astro`).
- Placement: the group is levelled up to the Isle's top like the old Station. Occlusion uses the group's heights: 6 units over the lighthouse and `SERVICE_HEIGHT` (2.5) over every other place, whether or not a Service stands there, so Services never move the layout. Over 400 Seeds (`seed-0`…`seed-399`): retries 30.5% → 32.8%, the safe layout 1 → 1 (`seed-30`); mean 41 → 45 ms, p95 78 → 82 ms, worst 144 → 141 ms (24 Projects / 8 Services: 42 → 46, 78 → 83, 145 → 142). The 250 ms test passes.
- Structures: one lighthouse per Biome (`station/<biome>-1`, 47 layers, door 4×10, lamp lantern) replaces the hut-and-mast and the round tower, so `LANDMARK_VARIANTS.station` is 1. Four Service kinds per Biome (`service/<biome>-<kind>`: pipeline, warehouse, observatory, lab; 12–20 layers). All were written by a throwaway generator (`site/.tmp/draw15.py`).
- Rendering: `drawStructures` draws each Service into the structure grid round the lighthouse. `landmarkExtent` covers the whole group, so the Station's one hotspot, its Data Card, the Guide's spot and the camera focus all span it. Services have no hotspot of their own.
- Model Gallery: kind `station` shows the whole group (`stationGroup`); kind `service` shows the 16 structures, each labelled with its kind.

**Decisions (also in `docs/todo.md`, Polish 15):**
- The places in front of the camera come first: south, east, north, west, then SE, NE, SW, NW.
- Kinds come from words in the id, falling back to a hash. Without words to match, two Services may share a kind.
- Empty places are bare ground. Decoration still keeps off the whole 6×6 group, and Decoration beside the group is no taller than the lowest Service (1.5 units). The answer says Decoration "may" use the empty places; this build chose the simpler rule.
- The Service structures are 1.5–2.5 units tall, below the README's 16–32 voxels, so the lighthouse dominates.
- The lighthouse lamp has no Night glow yet; that is left to ticket 16.
- Each Service structure costs about 1,070 triangles.

**Test seams** were picked without confirming, as in earlier polishes: `generateWorld`, the structure data tests, `structureModels` and `landmarkExtent`, and `serviceOrder`.

**Screenshots** (gallery, all four Biomes on desktop and phone, Day and Night) are in `.scratch/voxel-world-polish/screenshots/15-*`. Per the user's instruction they are not committed. The page showed no console errors.

**Code review:** Two documentation rows were missing, the `serviceStructure` signature was awkward, Decoration's height cap by the Station used the lighthouse's height, and the structure files named the gitignored script; all were fixed. The open questions and deferred smells are in `docs/todo.md` ("Code review of polish 15").
