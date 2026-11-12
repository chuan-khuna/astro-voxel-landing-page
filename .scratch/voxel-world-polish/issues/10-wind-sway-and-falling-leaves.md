# 10: Wind in the plants, falling leaves and rocking boats

**What to build:** The wind sways every instanced plant, drifts leaves across the Isles and rocks boats and ships on the swell.

**Blocked by:** 05, 06, 08, 09

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [x] Garden trees and flowers, and Decoration's small trees, grass and flower clumps, sway in the vertex shader from the shared wind uniform. The base stays still, the canopy moves at most ½ voxel, and gusts visibly roll across the Isle.
- [x] Landmarks never sway.
- [x] Garden tree and flower hotspots still line up with the plants while they sway. Check the tap size on phones again.
- [x] Falling leaves are ⅛-unit single-colour cubes, coloured from the Biome's foliage roles. They drift with the wind, tumble and fade on landing. The count follows the tier.
- [x] Moored boats and sailing ships rock on the swell, in step with the water bob.
- [x] Everything stops when the clock is frozen.
- [x] The real page is checked in a browser on Seeds covering all four Biomes, at desktop and phone sizes, with reduced motion on and off, and with no console errors. Short screen recordings or frame sequences are attached.
- [x] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.

## Comments

Built in polish 10 (agent, 2026-11-12).

- **Wind sway** (`render/windSway.ts`): the Garden's trees and flowers and Decoration's grass, flower clumps, bushes and small trees (`sapling`) take a soft-voxel material whose vertex shader moves each vertex down the shared wind (`windAt`, gusts rolling across the Isle) times how far up the canopy it is: the lower 35% (trunk or stem) stays still, the top moves at most 1/16 unit (half a ⅛-unit voxel), a lean plus a flutter in each copy's own phase. Landmarks, sheds, windmills, fences, lamps and rocks never sway. The seams ride with the voxels: `voxelMaterial` now takes the look's seams from the geometry as meshed and a `displace` for the vertex shader.
- **Hotspots:** plant links are sized from the plant's cell, so they still line up. On a 390×844 phone flowers are still 32×37 px (the known issue in `docs/todo.md`); desktop 47×53 px.
- **Falling leaves** (`render/fallingLeaves.ts`, pure; `render/leaves.ts`): ⅛-unit cubes from every tree (2 each, autumn 3, at most 72 a World), coloured as the foliage voxel they start on, landing down the wind on level land off the Landmarks, tumbling whole turns, lying 1.5 s fading. One `InstancedMesh`, all motion in the shader on the shared clock. The life tier's share shows (`setLife`, every frame, so a tier drop takes effect at once).
- **Rocking** (`render/swell.ts`): boats and ships heave 0.04 with the water voxel of their cell (its hashed phase worked out on the CPU as the shader does), roll up to 0.05 rad and pitch up to 0.035 rad; `instanceMatrix` takes a heave, roll and pitch. The sea shares the swell's period and stride.
- **Frozen clock:** everything is on the shared clock; under reduced motion the clock stays 0 and the canvas is unchanged between frames (`e2e/ambient-life.spec.ts`).
- **Checked** on `harbour` (tropical), `seed-1` (autumn), `seed-2` (northern), `seed-3` (volcanic): desktop Day and Night (`life=full`) and phone (`life=reduced`) on `/garden`, the Dock on desktop, and reduced motion. No console errors besides the dev server's known 404s for `/stills/*.webp`. Frame sequences (1.2 s apart): `screenshots/10-desktop-day-<biome>-f0..f2.png` and `10-dock-tropical-f0..f2.png`; stills: `10-desktop-night-<biome>-f0.png`, `10-phone-day-<biome>-f0.png`, `10-dock-<biome>-f0.png`, `10-reduced-autumn-f0.png` (under reduced motion the later frames were byte-identical).
- Decisions and judgement calls are in `docs/todo.md` ("Polish 10: wind, leaves and the swell", "Plant sway is subtle", "Bevels on rocking vessels"). Not measured on a real phone or GPU.
