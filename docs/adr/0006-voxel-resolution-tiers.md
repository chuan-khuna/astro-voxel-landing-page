# Voxels come in four resolution tiers; structures move to ⅛ unit

Supersedes the scale rules in ADR 0004 ("Detail stays at ¼ unit") and in ADR 0005's amendment ("⅛ unit is allowed for particles only").

The World uses four voxel sizes, each for its own kind of thing:

| Tier | Voxel | Per cell | Used for |
|---|---|---|---|
| Terrain | 1 unit | 1 | ground, sea, clouds |
| Ground detail | ¼ unit | 4×4 | bridges, stairs, path edging, rocks, the Dock's deck and jetty |
| Structure | ⅛ unit | 8×8 | Landmarks, Service structures, Garden plants, fences, boats, ships, Decoration, animals, birds, fish |
| Particle | ⅛ unit | 8×8 | leaves, butterflies, fireflies, snow, ash, foam: single-colour cubes moved in the shader, with no structure file |

The House Interior becomes a scene of its own, drawn at **1/16 unit**: twice the World's structure resolution. Leaving the World for it is a camera transition, so its voxel count never adds to the World's.

Scale anchor at ⅛ unit: one storey is 16 voxels (2 units), a door 4×10, a standing person 12, a head 4×4×4.

We chose this because ¼ unit was too coarse for the detail the user wants on buildings, plants and Services, while 1/16 for the whole World was too costly:
- At the full content (24 Projects, 12 Clients) the World's detail grid was measured at about 3.2k voxels and 4.5k triangles at ¼ unit. ⅛ unit is about 8× the voxels and about 20–35k triangles, which phones handle alongside Ambient Life. 1/16 would be about 200k voxels and 70–300k triangles.
- Structures are still ASCII files drawn by agents (ADR 0004). A House Variant at ⅛ unit is 24×24 per layer and about 32 layers, which an agent can still write and review. At 1/16 it would be 48×48 by about 64 layers.
- Neighbouring things should differ in voxel size by no more than about 4–8×. ⅛-unit structures sit on 1-unit terrain and next to ¼-unit bridges without looking like a different art style, and particles match the voxels of the plants they fall from.

## Consequences

- `DETAIL = 4` splits into one constant per tier, and the mesher and soft-voxel material handle several voxel sizes (the bevel and seam width scale with the voxel).
- `VoxelGrid` may need typed arrays instead of a `Map` for the larger grids; measure first.
- Every structure footprint is drawn at 8 voxels per cell. Existing ¼-unit placeholders are redrawn, not upscaled.
- The House Interior has its own scene, camera and lighting, entered after the roof lifts.
- The triangle budget in `docs/documents/rendering-and-shading.md` is measured again once the first ⅛-unit structures land.

## Considered Options

- **1/16 unit for every structure.** The finest look, but about 64× the voxels, too heavy on phones, too large to draw as ASCII, and 16× finer than the terrain beside it.
- **Stay at ¼ unit** (ADR 0004). Too coarse for windows, fences, Services and readable people.
- **1/32 unit for the Interior.** Close to a smooth model, losing the voxel look, and it would need `.vox` files instead of ASCII.
