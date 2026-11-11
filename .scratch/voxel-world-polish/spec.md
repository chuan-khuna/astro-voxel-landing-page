# Spec: Voxel World polish

Status: ready-for-agent

Starts after every ticket in `.scratch/voxel-world-landing/` is resolved. It builds on that feature's World generator, renderer and routes.

Sources:
- Discussion record: `docs/records/2026-11-11-voxel-world-polish.md`
- Glossary: `GLOSSARY.md` (Pinned Project, Landmark Variant, Decoration, and the updated Biome, Client and Partner)
- ADRs: `docs/adr/0004-ascii-voxel-structures.md`, plus 0001–0003
- Base spec: `.scratch/voxel-world-landing/spec.md`

## Problem Statement

The first version of the World works, but it looks like a placeholder:
- Every Landmark is a single code-built shape.
- The Garden's trees merge into one hedge.
- The Isles are small and bare.
- The sea is two flat planes.

Rolling a new Seed changes the terrain and the colours, but not the character of the place. The World should feel like a crafted miniature, and each Biome should feel like its own place.

## Solution

**Structures are predefined.** Every Landmark, tree, flower, boat, ship and piece of Decoration is a hand-drawn voxel structure, kept in the repo as an ASCII file at ¼-unit scale (ADR 0004). An agent draws them, and the user reviews them in a dev-only Model Gallery.

**Landmark Variants.**
- Each Biome has its own building style for every Landmark. For example, the House is a stilt house in the tropical Biome, a timber cabin in northern, a brick cottage in autumn and a stone house in volcanic.
- Each style has 2–3 Variants that differ in shape, such as the roof, an extra wing or a porch.
- The Seed picks the Variant.

**Garden.**
- A **Pinned Project** grows as one large flower filling a cell, in the front row of the Garden as the camera sees it.
- Every other Project grows as a tree.
- Trees and flowers leave a one-voxel gap so each reads as its own plant.
- The Garden holds grass and paths but no decorative flowers.

**Boats and ships.**
- Clients and Partners come in several kinds of boat and ship.
- Each Client and Partner keeps its kind in every World. The kind is derived from its id, and its style follows the Biome.

**Bigger Isles and Decoration.**
- Isles are about 1.5× wider.
- Each Biome scatters its own **Decoration**: small trees, grass, flower clumps and minor buildings.

**Water.** The sea becomes a translucent voxel layer. It shades from shallow to deep and bobs gently.

**House Interior.** Each Biome has its own furnished room. Every House Variant in that Biome has a liftable roof and fits that room.

## User Stories

1. As a visitor, I want each Biome's buildings to have their own style, so that rolling a new Seed feels like visiting a new place.
2. As a visitor, I want the same Landmark to come in a few shapes, so that two Worlds of the same Biome still differ.
3. As a visitor, I want buildings to have doors, windows, roofs and chimneys drawn properly, so that the World feels like a premium miniature.
4. As a visitor, I want the company's highlighted work shown as flowers at the front of the Garden, so that I notice it first.
5. As a visitor, I want each tree in the Garden to read as a separate tree, so that I can tell Projects apart and click the right one.
6. As a visitor, I want Clients' boats and Partners' ships to come in several kinds, so that the Dock looks lively.
7. As a returning visitor, I want each Client to keep its boat across Worlds, so that I can recognise it.
8. As a visitor, I want bigger Isles dressed with trees, grass, flowers and small buildings, so that the World feels lived in.
9. As a visitor, I want scenery never to hide or be confused with a Landmark, so that I always find the sections.
10. As a visitor, I want voxel water that moves gently, so that the sea matches the rest of the World.
11. As a visitor who prefers reduced motion, I want the water to stay still, so that the World does not move without me.
12. As a visitor, I want the House Interior to match the House's Biome, so that inside and outside belong together.
13. As a site owner, I want to pin Projects in content, so that I choose what the Garden highlights.
14. As a site owner, I want to review every model in one gallery before it ships, so that the look stays under my control.
15. As a mobile visitor, I want fewer Decoration pieces, so that the World stays smooth, but never missing Landmarks.

## Implementation Decisions

**Structure files (ADR 0004)**
- Each structure is an ASCII file: one block per ¼-unit layer, bottom to top, with one character per voxel.
- A key maps each character to a colour role, such as wall, roof, window, door, trim or foliage.
- Roles resolve to the Biome's palette or to the fixed House and brand colours. Structures never hold raw colours, so the same OKLCH, jitter and seam shading applies everywhere.
- Files are parsed at build time into typed voxel arrays. The browser never parses ASCII.
- Each structure declares its footprint in 1-unit cells, the face its door is on (if it has one) and its anchor point.

**Rendering**
- Each placed Landmark is meshed once by the existing greedy mesher.
- Repeated structures (trees, flowers, Decoration, boats, ships) are drawn with one `InstancedMesh` per structure.

**Scale.** Structures stay at ¼ unit:

| Structure | Voxels |
|---|---|
| House | 12×12 |
| Station | 8×8 |
| Mailbox | 4×4 |
| Tree or flower | 4×4 |

**Landmark Variants**
- Each Landmark (House, Station, Mailbox, Dock) has one style per Biome and 2–3 Variants per style, about 8–12 per Landmark.
- The Seed picks a Variant per Landmark, so the same Seed gives the same Variants.
- A Variant fills its Landmark's footprint (ticket 18 of the base feature).
- Doors face the path where there is one.

**Garden**
- Projects gain an optional `pinned` flag.
- Pinned Projects bloom as flowers, up to 6, chosen as the first six by id. Any further Pinned Projects grow as trees.
- Flowers and trees together are capped at 24 (the existing cap). Pinned Projects take places first.
- Projects beyond the cap are not in the World but stay on `/garden`, where Pinned Projects are listed first.
- Flowers occupy the Garden's front row as the camera sees it.
- Trees use the Biome's tree species and a 3×3 canopy in a 4×4 cell.
- No Decoration inside the Garden: an empty Garden is a grass patch.

**Boats and ships**
- Client boats and Partner ships each have several kinds, styled per Biome.
- The kind comes from a stable hash of the Client's or Partner's id, not from the Seed.
- Partner ships are always clearly larger than Client boats.

**Isles**
- Radii grow about 1.5×:

  | Isles | Radius |
  |---|---|
  | 1 | 14–18 |
  | 2–3 | 10–14 |
  | 4 | 9–12 |

- Camera bounds follow.
- Mobile uses the same Isles with less Decoration.

**Decoration**
- Each Biome has its own Decoration set: small trees (a different, smaller species from Project trees), grass, flower clumps, and minor buildings such as sheds, fences, lamps, rock piles and windmills.
- Placement is deterministic from the Seed.
- Decoration never sits on a footprint, a path, a bridge end or inside the Garden.
- It is never taller than the nearest Landmark.
- It never stands between the camera and any Landmark. This uses the same occlusion check as terrain placement.
- A reduced tier applies on small devices.

**Water**
- The sea is a 1-unit voxel layer with the soft-voxel seam and bevel look.
- It is slightly translucent over shallow ground.
- Its colour runs from the Biome's shallow to deep water by distance from the coast.
- A gentle per-voxel bob is computed in the shader. It stops under reduced motion.
- At Night the water darkens, as the base spec already says.

**House Interior**
- There is one furnished room per Biome, four in all.
- Every House Variant in a Biome has a roof that lifts off and the same interior space, so that Biome's room fits it.
- Every room has the developer at a computer, and clicking the developer opens Team.

**Model Gallery**
- A dev-only page at `/dev/models`. It is not part of the production build.
- It shows every structure in a grid of Biome × Variant, with the real renderer and shading.
- Models can be rotated, and the page can switch between Day and Night.
- Agents attach gallery screenshots whenever they add or change models.

## Testing Decisions

- World behaviour is still tested through `generateWorld` only.
- **Determinism:** the same Seed gives the same Variants and Decoration.
- **Rules over hundreds of Seeds:**
  - Variants come from the Biome's set.
  - Decoration never overlaps a footprint, path, bridge end or the Garden, and never occludes a Landmark.
  - Isle radii fall in the new ranges.
  - Pinned flowers number at most 6, and flowers plus trees are at most 24.
- **Structure files** are tested as data:
  - each parses
  - each uses only known roles
  - each fills its declared footprint
  - each House Variant has a liftable roof and the Biome's interior space
- **Boat kinds:** the same id gives the same kind in every World.
- **No snapshots:** voxel grids are not snapshot-tested.
- **Real page:** every ticket is checked in a browser on several Seeds at desktop and phone sizes, with no console errors.

## Out of Scope

- Finer than ¼-unit detail.
- MagicaVoxel `.vox` files (ADR 0004).
- Interior rooms per House Variant; there is one per Biome.
- New Biomes.
- User-editable or uploaded models.

## Further Notes

The first ticket stops for the user to approve the House models in the Model Gallery before any other model is drawn, as the look prototype did in the base feature.
