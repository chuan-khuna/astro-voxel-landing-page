# Voxel World polish: design grilling

Date: 2026-11-11

## Discussed

The user asked for a polished version of the World:
- predefined Landmark structures (House, Station, Garden plants, Mailbox and so on)
- several kinds of boat at the Dock
- each structure in 5–10 forms per Biome
- flowers for pinned Projects and big trees for other Projects
- correct voxel detail on buildings
- larger Isles dressed with trees, grass, flowers and minor buildings
- voxel water

The Garden's first browser check (base ticket 08) showed full-cell tree canopies merging into one hedge, and tree click targets about 13×15px on phones.

## Decided

1. **Sequencing.** The base feature `.scratch/voxel-world-landing/` runs to completion first. The polish is a new feature, `.scratch/voxel-world-polish/`, with tickets 01–08.
2. **Pinned Projects.**
   - A Project may be pinned.
   - The first six Pinned Projects by id bloom as large one-cell flowers in the Garden's front row. Further Pinned Projects grow as trees.
   - Flowers and trees together are capped at 24, and Pinned Projects take places first.
   - Projects beyond the cap appear only on `/garden`, where Pinned Projects are listed first.
3. **The Garden holds no decorative flowers**, only grass and paths. Trees leave a one-voxel gap, with a 3×3 canopy in a 4×4 cell.
4. **Variants.** Each Landmark has one style per Biome, with 2–3 Variants per style (about 8–12 per Landmark). The Seed picks the Variant.
5. **Format.** Structures are ASCII layer files with a colour-role key, parsed at build time and drawn by agents (ADR 0004). `.vox` was weighed and rejected because no one will draw by hand.
6. **Rendering.** Landmarks are greedy-meshed. Repeated structures use `InstancedMesh`.
7. **Detail** stays at ¼ unit.
8. **Boats and ships.** The kind is derived from the Client's or Partner's id, so it stays the same in every World. The style follows the Biome. Partner ships are always larger than Client boats.
9. **Isles** grow about 1.5×: radius 14–18 for one Isle, 10–14 for two or three, 9–12 for four.
10. **Decoration** is a new glossary term.
    - It cannot be clicked, and each Biome has its own set.
    - It is never on footprints, paths, bridge ends or in the Garden.
    - It is never taller than nearby Landmarks, and never in front of a Landmark from the camera.
    - It is reduced on mobile.
11. **Water** is a translucent 1-unit voxel layer. It shades from shallow to deep and has a gentle shader bob that stops under reduced motion.
12. **House Interior** has one furnished room per Biome. Every House Variant in a Biome has a liftable roof and the same interior space. Every room has the developer, and clicking the developer opens Team.
13. **Review.** A dev-only Model Gallery at `/dev/models`, plus screenshots in agent reports. Work stops for the user's approval after the first House models.

## Open questions

- None at the end of the session.
