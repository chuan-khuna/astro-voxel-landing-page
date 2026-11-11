# Voxel World polish: voxel scale and footprints

Date: 2026-11-11

## Discussed

The user asked for the current sizes of the World and its structures, then for finer voxels and a structure per Service. The current sizes are recorded in `.scratch/voxel-world-polish/README.md`.

Measured on `feat/voxel-world`:
- **Detail grid.** About 3.2k voxels and 4.5k triangles at the full content (24 Projects, 12 Clients).
- **World size.** Over 400 Seeds, a one-Isle World is 31–43 cells wide with 246–498 land cells.
- **Scale problems.**
  - The seated developer is as tall as the House's walls.
  - The Mailbox is nearly as tall as a tree.
  - Trees are one storey high.
  - The Station and the House use different storey heights.
  - Full-cell canopies merge into a hedge.

The user asked whether structures could be 1/16 unit and the House Interior 1/32 unit. 1/16 unit was weighed against:
- **Cost.** About 200k voxels and 70–300k triangles.
- **Authoring.** 48×48 ASCII layers.
- **Visual mismatch.** 16× finer than the terrain.

## Decided

1. **Resolution tiers** (ADR 0006, superseding the scale rules in ADR 0004 and 0005):
   - terrain, sea and clouds: 1 unit
   - bridges, stairs and the Dock's deck and jetty: ¼ unit
   - every structure (Landmarks, Services, plants, boats, ships, Decoration, creatures): ⅛ unit
   - particles: ⅛ unit
   - the House Interior: 1/16 unit, in a scene of its own
2. **Scale anchor at ⅛ unit:** a storey is 16 voxels, a door 4×10, a standing person 12.
3. **House:** a 4×4 plot. The House itself is 3×3. The other seven cells are its front yard on the door side, and the Mailbox stands there. The Mailbox is still the Contact Landmark with its own hotspot, but it no longer has a footprint of its own.
4. **Station:** a group. The Station's own building is 2×2 at the centre, and each Service has a 2×2 structure of its own around it.
5. **Garden:** a fixed 3×3 bed inside a fence one cell wide, 5×5 in all.
   - The front two rows (3×2, as the camera sees them) are six Pinned Project flowers.
   - The back row (3×1) is three Project trees.
   - One plant per cell, so the Garden shows at most 9 Projects. This replaces the earlier cap of 24.
   - Projects beyond that are listed only on `/garden`.

## Open questions

- **Garden spare cells.** With fewer than six Pinned Projects, do other Projects grow as trees in the empty flower cells, or do those cells stay grass?
- **Station layout.** How are the Service structures arranged round the Station: a 6×4 row (two Services on each side) or a 6×6 ring? How does the layout change when the number of Services changes (four today)?
- **Clicking Services.** Can each Service structure be clicked to open that Service, like a Garden tree?
- **Isle size.** Are the ticket 02 Isle radii still enough for the larger footprints (House 4×4, Garden 5×5, Station group about 6×4)?
