# 18: Landmark footprints larger than one cell

**What to build:** Landmarks occupy real ground, not a single terrain cell. The House, the Station and the other placed Landmarks each stand on a footprint of several 1-unit cells, the Garden is an area that holds its trees, and each tree is a full-cell model rather than a tiny one. The World generator places every footprint on flat, dry land, and the renderer builds each ¼-unit model to fill its footprint.

**Blocked by:** 03, 04 (run after 06 to avoid render conflicts; do before 08–12, which build the real Landmark models on these footprints)

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

Requested by the user on 2026-11-11: "อยากให้ landmark/building มีพื้นที่มากกว่า 1 block. eg house, station, tree, etc" (landmarks and buildings should cover more than one block, e.g. the House, the Station, trees).

Also requested on 2026-11-11: "แต่ละbuilding, landmark ต้องอยู่ในมุมที่ไม่ถูกบดบังจาก terrain (isometric view)" (every building and Landmark must sit where terrain does not hide it in the isometric view).

Default footprints (in 1-unit cells; tune if they don't fit the terrain):

| Landmark | Footprint |
|---|---|
| House | 3 × 3 |
| Station | 2 × 2 |
| Garden | an area of at least 3 × 3 that grows with the number of trees shown (one cell per tree, plus paths) |
| Dock | 2 × 1 on land plus a jetty of 2–3 cells reaching into the sea |
| Mailbox | 1 × 1 |
| Garden tree (one per Project) | 1 × 1 each, model fills the cell |

- [x] World data gives each placed Landmark a footprint (origin cell, width, depth, and the cells it covers), and the Garden lists one cell per tree
- [x] Every footprint sits on land of one Isle at one height (the generator levels the terrain under it if needed) and never overlaps another footprint, a bridge end, the Dock-to-House path or the sea (except the Dock's jetty)
- [x] **Never hidden by terrain.** From the fixed isometric camera direction, no terrain (or bridge) stands in front of any part of a Landmark: every footprint cell and the full model height is visible. The generator knows the view direction as a constant (the camera never rotates), checks each candidate footprint by marching the height grid toward the camera, and rejects placements that would be occluded (falling back to retry if none fit). The Garden's trees count as part of the Garden.
- [x] Existing placement rules still hold: House and Garden share an Isle, the Dock is on the shoreline, the Station is on high ground
- [x] Generator tests cover footprints for hundreds of sampled Seeds, through `generateWorld` only
- [x] Placeholder ¼-unit models fill their footprints; trees fill their cell
- [x] Picking and hotspots cover the whole footprint
- [x] Spec, `world-generator.md` and `rendering-and-shading.md` are updated

## Comments

- 2026-11-11: Done. `PlacedLandmark` now has `footprint` (`origin`, `width`, `depth`, `cells`) in place of `cell`, plus `trees` (Garden) and `jetty` (Dock). Placement lives in `site/src/world/landmarks.ts`: Station, then Garden, House (on the Garden's Isle), Dock, Mailbox; each tries the Isles in a Seed-shuffled order. Footprints whose cells differ by up to 2 voxels are levelled (down; the Station up to the Isle top), keep a one-cell gap, and stay off bridges and bridge ends; the Dock-to-House path now runs from beside the Dock to beside the House and never enters a footprint. Occlusion: every ground point of a candidate footprint (¼-cell grid) is ray-marched towards the fixed camera, (1, 1, 1), against the levelled height grid and bridge decks. Tuning: footprint sizes kept at the defaults; levelling allowed up to 2 voxels (1 failed too often with 24 trees); Garden rows are two tree rows then a path row (0–6 trees 3×3, 24 trees 6×5); the safe layout is now radius 10 with at most 2 terrace steps so a 24-tree Garden always fits. Placeholder models fill their footprints, trees fill their cells, and hotspots use `landmarkExtent(landmark)`, which never covers less than the footprint and jetty. Verified in Chrome (Playwright, on the dev server) for Seeds 694157692, default, 7, 42, harbour and 123456: the World draws, all five hotspots show, no console or page errors. The home page still passes 0 Projects, so the Garden shows flowers only until the projects collection exists.
