# 14: Land animals and birds

**What to build:** Each Biome's animals walk short routes on the Isles, rest and graze, and birds circle high above, without ever hiding a Landmark.

**Blocked by:** 08, 09

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [ ] Animals and birds are ⅛-unit ASCII structures per Biome, drawn with `InstancedMesh`. Examples: deer in the north, squirrels in autumn, seabirds in the tropics, bats at Night. Simple poses (walk, rest, graze, head turn, wing beat) are separate frames or a few shader-driven parts.
- [ ] `generateWorld` gives each land animal a rest point and a short route from the Seed. Routes never cross a footprint, a bridge or the Garden, and never stand between the camera and a Landmark, using the Decoration occlusion check.
- [ ] Each Isle has at most 2–3 animals. The count follows the tier.
- [ ] At runtime an animal walks its route, then rests, grazes or turns its head, on the shared clock.
- [ ] Birds circle above the Isles, higher than every Landmark, and their paths avoid the camera's view of each Landmark.
- [ ] Animals and birds are never click targets, and nothing moves when the clock is frozen.
- [ ] Tests through `generateWorld` over hundreds of Seeds: determinism, routes clear of footprints, bridges and the Garden, no occlusion, at most 3 animals per Isle, and sets from the World's Biome.
- [ ] Data tests cover every new structure. The Model Gallery shows them, and screenshots are attached.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, in Day and Night if the theme exists, at desktop and phone sizes, with no console errors.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
