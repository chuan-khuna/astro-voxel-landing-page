# 06: Kinds of Client boats and Partner ships

**What to build:** Client boats and Partner ships come in several kinds styled per Biome, and each Client and Partner keeps its kind in every World.

**Blocked by:** 01

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-polish/spec.md`

- [ ] There are several Client boat kinds and 2–3 Partner ship kinds, with Biome-styled Variants as ASCII structures. Partner ships are always clearly larger than Client boats.
- [ ] The kind comes from a stable hash of the Client's or Partner's id, not the Seed.
- [ ] Boats and ships are drawn with `InstancedMesh`.
- [ ] Tests: the same id gives the same kind across Seeds and Biomes, and counts still match content and caps.
- [ ] The Model Gallery shows all boats and ships, and screenshots are attached.
- [ ] The real page is checked in a browser on several Seeds and Biomes, with no console errors.
- [ ] Spec and `docs/documents/` (with INDEX) are updated.
