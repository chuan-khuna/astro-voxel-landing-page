# 12: Clouds and cloud shadows

**What to build:** Clouds drift high over the sea round the Isles, and their soft shadows cross the whole World.

**Blocked by:** 02, 09

**Status:** resolved

Spec: `.scratch/voxel-world-polish/spec.md` · ADR: `docs/adr/0005-continuous-render-for-ambient-life.md`

- [x] Clouds are slightly translucent 1-unit voxel masses with the soft-voxel look, in a few shapes drawn as ASCII structures or generated from the Seed. They drift with the wind.
- [x] Cloud bodies drift only over the sea and never pass over an Isle, at any camera angle the bounds allow.
- [x] Soft cloud shadows drift across Isles and sea. They are computed in the shader (for example, a scrolling noise mask on the terrain and water materials), not with extra shadow-map casters.
- [x] Clouds fade out as the camera zooms in on a Landmark, and are gone in the close-up.
- [x] At Night clouds darken and cast no shadow. If Day/Night is not built yet, note this.
- [x] Clouds are never raycast or hotspot targets. The cloud count follows the tier, and nothing moves when the clock is frozen.
- [x] Tests through `generateWorld`: cloud paths are deterministic and stay over the sea.
- [x] The real page is checked in a browser at desktop and phone sizes on several Seeds, at the Overview and at every Landmark's close-up, with no console errors.
- [x] Spec and `docs/documents/rendering-and-shading.md` (with INDEX) are updated.

## Comments

Built (polish 12):
- `generateWorld` places up to 8 clouds (`World.clouds`, `site/src/world/clouds.ts`, from `<seed>/clouds`): shapes generated from the Seed (3–8 long down the wind, 2–5 wide, 2–3 high, layered lumps), floating 2–4 units above the tallest Landmark, each drifting 6–14 units down the wind at 0.2–0.4 units/s and round again. No column of a cloud is over land, straight down or down the fixed isometric view ray from its top, all along its drift (with a cell to spare), so a cloud is never over an Isle nor seen over one, whatever the pan and zoom. Tests in `generateWorld.test.ts` ("Clouds"): deterministic, counts, shapes, drift down the wind and height, over the sea (an independent march), within reach of the Overview.
- `site/src/render/clouds.ts`: one merged, culled, translucent mesh (80% opaque, a little self-glow), moved in the vertex shader on the shared clock, fading in and out at the ends of each drift; white by Day, dark grey-blue at Night; never raycast, no shadow-map casting, drawn after the sea; the life tier's share via a draw range.
- `site/src/render/cloudMath.ts` (pure, tested): the zoom fade (whole at the Overview, gone well before every Landmark close-up and the phone Story Scroll's framings), the tier share, the shadows' drift and strength. `canvas.dataset.clouds` reports the fade.
- `site/src/render/cloudShadow.ts`: the shadows are a drifting two-octave noise mask multiplied into the colour of every voxel material and the sea's water and seabed; 20% by Day, none at Night; the drift comes from the clock's seconds, so a frozen clock holds them.
- Day/Night was already built: `WorldTokens.cloud` and `cloudShadow` added.
- Checked in headless Chromium on `harbour`, `seed-1`, `seed-2`, `seed-3`, desktop and phone, Day and Night, at the Overview and every Landmark's close-up (`screenshots/12-*`), no console errors; `e2e/ambient-life.spec.ts` gained a clouds check.

Decisions (also in `docs/todo.md`): shapes generated, not ASCII; "never over an Isle at any camera angle" read as the view-ray check above, which keeps clouds off a band of sea south-east of each Isle; shadows are independent of the bodies (bodies never cross land); shadows darken the surface colour (sky light included), and fall on everything drawn with the voxel material, the Guide included; on phones clouds are never seen, because the Story Scroll never pulls back to the Overview.
