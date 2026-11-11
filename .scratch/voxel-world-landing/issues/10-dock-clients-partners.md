# 10: Dock, Clients and Partners

**What to build:** A visitor sees Clients as boats moored at the Dock and Partners as larger ships sailing between Isles, and reads about both on the Dock page.

**Blocked by:** 03, 07

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] `clients` and `partners` YAML collections hold about 5 mock Clients and 3 fictional Partners; no real brands
- [x] The generator places one moored boat per Client, up to a cap of 12, and one sailing route per Partner
- [x] With a single Isle, Partner ships sail a loop around it
- [x] `/dock` lists Clients and Partners as two distinct groups
- [x] Vitest: boat and ship counts match the content counts, including 0 and over the cap
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
