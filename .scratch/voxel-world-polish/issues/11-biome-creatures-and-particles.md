# 11: Butterflies, fireflies and Biome particles

**What to build:** Each Biome has its own flying particles, and Day or Night decides which are out: butterflies by Day, fireflies at Night, snow in the north and ash on volcanic Isles.

**Blocked by:** 09

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [ ] Particles are single-colour ⅛-unit cubes in one `InstancedMesh` per kind, moved in the shader from the shared clock and wind.
- [ ] The sets follow the spec's Biome × Day/Night table. Butterflies flutter in loose paths near flower clumps. Fireflies blink as emissive points low over the grass at Night. Snow and ash drift with the wind.
- [ ] Spawn areas are deterministic from the Seed, through `generateWorld`, and stay off Landmark footprints and out of the camera's view of a Landmark.
- [ ] Particles are never raycast or hotspot targets, and clicks reach Landmarks and Garden plants through them.
- [ ] Counts follow the tier, and nothing moves when the clock is frozen.
- [ ] If the Day/Night theme is not built yet, the Night sets are skipped. Say so in the report and leave them for the theme ticket.
- [ ] Tests through `generateWorld`: the sets come from the World's Biome, and spawn areas are deterministic and never on a footprint.
- [ ] The real page is checked in a browser on Seeds covering all four Biomes, in Day and Night, at desktop and phone sizes, with no console errors. Short recordings are attached.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
