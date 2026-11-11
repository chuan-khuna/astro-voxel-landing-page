# Corporate landing site as a generated voxel world: design grilling

Date: 2026-11-11

## Discussed

The site is a storytelling corporate landing page for a data/AI software company. The visitor walks across a small generated isometric world, and each place in it is one section of the site.

Stack: Astro 7 with MDX content collections and three.js. Colours are written in OKLCH. Site data lives in `data/site.ts`, not hardcoded.

The starting visual reference was `claude-drawing/examples/isometric_weather_island.jpg`: a pastel isometric island with floating data cards.

## Decided

1. **Rendering.** The world is a real three.js 3D scene: an isometric orthographic camera over geometry generated in code. It is not a pre-rendered image.
2. **Seed.**
   - A Seed deterministically generates the world.
   - The default Seed is set in `data/site.ts`.
   - A dice button rolls a new Seed, and the URL carries `?seed=` so a world can be shared.
3. **What the Seed controls.**
   - It controls everything: world size, number of islands (archipelago), terrain, decoration, and Landmark variants.
   - Every Landmark is always present.
4. **Landmarks, in Story Order:**

   | # | Landmark | Section |
   |---|---|---|
   | 1 | Overview | Hero |
   | 2 | Station | Services |
   | 3 | House | About |
   | 4 | House Interior (computer and developer) | Team |
   | 5 | Garden (one tree per project) | Portfolio |
   | 6 | Dock | Clients |
   | 7 | Mailbox | Contact |

5. **Distribution.**
   - The Seed spreads Landmarks across 1–4 islands, linked by bridges.
   - House and Garden always share an island, and the Dock is always on the water's edge.
   - If a Seed's layout breaks these rules, generation retries deterministically.
6. **Style: soft voxel.**
   - Voxels have a slight bevel, visible per-voxel seams and per-voxel colour jitter, with soft AO and no textures.
   - Palette is muted (see below).
7. **Voxel scale: two sizes.** Terrain voxels are 1 unit. Landmarks and decoration are ¼ unit.
8. **Performance approach.**
   - Chunked meshes with hidden-face culling and greedy meshing.
   - Seams and colour jitter are drawn in the shader. AO is baked into vertex colours.
   - The shadow map is static and frames render only on demand.
   - DPR is capped. Generation runs in a Web Worker.
   - Mobile drops decoration but keeps every Landmark.
9. **Renderer.** `WebGPURenderer` from `three/webgpu` with TSL shaders. It falls back to WebGL 2 automatically.
10. **Storytelling mechanic: an explorable map in the style of haru-ni.**
    - Visitors pan and zoom freely by drag, pinch or wheel.
    - Clicking a Landmark opens its section as a page with its own URL (e.g. `/garden`) over the world. Closing it returns to the world.
    - A Tour button moves the camera through the Landmarks in Story Order.
11. **House Interior.**
    - The dive into the house happens in the same scene. The roof lifts, and the camera zooms into a ¼-unit voxel room with a desk, a computer and an animated developer. The screen plays code or data.
    - The About page (`/about`) opens beside the room. Clicking the developer opens Team (`/about/team`).
    - The Seed may vary the room layout.
12. **Content split.**
    - `data/site.ts` holds:
      - company identity: name, tagline, logo, address, email, phone, socials
      - SEO and OG settings
      - the default Seed
      - the Landmark list (id, route, label, Story Order)
      - floating-card metrics
      - the contact endpoint
    - Collections:
      - `projects` (MDX): one tree each, with `/garden/[slug]`
      - `services` (MDX)
      - `team` (MDX)
      - `clients` (YAML data): one boat each
      - `pages` (MDX): the intro of each Landmark
    - The number of entries drives the world: N projects means N trees, and M clients means M boats. The Seed decides only where they go and how they look.
13. **Language.** English only; no i18n routing.
14. **Client vs Partner.**
    - Clients are organisations that hired the company: moored boats, in the `clients` collection.
    - Partners are technology allies: larger ships sailing between the islands, in the `partners` collection.
    - Both appear at the Dock Landmark.
    - Mock Partners use fictional names, not real brands.
15. **Company identity.** Everything is mock data, to be swapped for real content later without code changes. That covers the company name, Projects, Services, Team Members, Clients, Partners, metrics and contact details.
16. **HTML-first and accessibility.**
    - Every route is static HTML with full content, readable without JS.
    - The home page has an HTML Landmark menu under the canvas, and Landmarks can take keyboard focus.
    - With no WebGL/WebGPU or no JS, the page shows a build-time still render of the default Seed plus the menu.
    - Under `prefers-reduced-motion`, camera flights and the Tour become cuts, and looping animation is off.
    - On mobile, visitors drag and pinch, and section pages open as a bottom sheet.
17. **Theme: Day and Night.**
    - The theme follows `prefers-color-scheme`. A toggle offers Auto, Day and Night.
    - At night the house lights are on, buoys glow and the water darkens.
    - CSS and three.js share one set of OKLCH tokens.
    - The theme never depends on the Seed or the clock, so the same Seed always gives the same world.
18. **Contact is information only.**
    - `/contact` shows email, phone, address and socials from `data/site.ts`.
    - There is no form and nothing is submitted.
19. **Data Cards.**
    - Data Cards are HTML with a CSS `matrix3d` transform matched to the camera. They tilt to the isometric plane and stay real, crisp, accessible text.
    - A card shows only when the camera is near its Landmark.
    - Metrics come from `data/site.ts`.
20. **Naming.**
    - World is everything a Seed generates. Isle is one landmass in it.
    - "Island" is avoided because it clashes with Astro Islands.
21. **Biomes.**
    - The Seed picks one of 3–4 hand-tuned Biomes: tropical, northern, autumn or volcanic.
    - Every Biome passes the C ≤ 0.10 rule.
    - The House colours and brand/UI colours stay fixed.
    - The default Seed in `data/site.ts` lands on the brand's main Biome.
22. **Terrain generation: noise plus rules.**
    - Noise (simplex/FBM) with an island falloff shapes the Isles, their heights and the Biome.
    - Heights are quantised to 1-voxel steps.
    - Local rules add the arranged details:
      - a path from Dock to House
      - stairs at a 1-step height change
      - layered cliff cross-sections at the edges
    - Wave Function Collapse was rejected because it costs too much tileset work.
23. **Project setup.**
    - The site lives in `site/`.
    - Versions: `astro` ^7.4, `@astrojs/mdx` ^8.1, `three` ^0.187, Node ≥ 22. Package manager: pnpm.
    - TypeScript is strict, with Zod from `astro/zod`.
    - Output is static, host-agnostic.
    - Camera tweens are hand-rolled, with no GSAP.
    - Vitest covers the World generator: determinism, and every Landmark is present for any Seed.
24. **Story hook: a guide character.** The Guide leads the Tour and speaks in speech bubbles.
    - The Guide is a floating voxel cube whose screen face shows pixel-eye moods.
    - Its personality is talkative, with a dry sense of humour. The *tone* is inspired by Portal 2, but no design is copied from Valve characters.
    - It assembles itself from voxels on first visit, and dissolves and re-forms on a new Seed.
    - Outside the Tour it idles near the Station, and clicking it starts the Tour.
    - Its lines come from the `pages` collection and tell the data → insight → value story. Its name is set in `data/site.ts` (mock).
    - Under reduced motion it stays still.

25. **ADRs written:**
    - `docs/adr/0001-seed-generated-world.md`
    - `docs/adr/0002-webgpu-renderer-with-tsl.md`
    - `docs/adr/0003-html-routes-over-the-world.md`

## Palette direction

Muted, easy on the eyes. Colours are converted to OKLCH, chroma is clamped to about ≤ 0.10, and L and h are kept.

Measured in OKLCH:

| Palette | max C | mean C | L range | Role |
|---|---|---|---|---|
| [late night bath](https://lospec.com/palette-list/late-night-bath) | 0.12 | 0.055 | 0.30–0.87 | Mood (day) |
| [Cryptic Ocean](https://lospec.com/palette-list/cryptic-ocean) | 0.098 | 0.074 | 0.25–0.78 | Mood (night / dusk) |
| [Punolite Plus Remake](https://lospec.com/palette-list/punolite-plus-remake) | 0.166 | 0.083 | 0.16–0.96 | Biome base (sand, grass, water, rock, wood) |
| [Aquaverse](https://lospec.com/palette-list/aquaverse) | 0.128 | 0.091 | 0.15–0.97 | Water depth ramp |
| [Eulbink](https://lospec.com/palette-list/eulbink) | 0.144 | 0.088 | 0.23–1.00 | Reference only (cyan too loud) |
| [soapy 10](https://lospec.com/palette-list/soapy-10) | 0.230 | 0.139 | 0.26–0.84 | Reference only (too saturated) |

## References

### Visual style

**Soft diorama**
- [Dribbble – Desk collection](https://dribbble.com/mattcobb/collections/6025865-Desk)
- [Behance – 3D Isometric Scene (Christmas)](https://behance.com/gallery/164389391/3D-Isometric-Scene-All-Set-for-Christmas)
- [Sketchfab – Astrologer's Chambers](https://sketchfab.com/blogs/community/art-spotlight-astrologers-chambers)

**Voxel**
- [80.lv – Incredibly detailed voxel dioramas](https://80.lv/articles/incredibly-detailed-voxel-dioramas)
- [80.lv – Using voxels for simple dioramas](https://80.lv/articles/using-voxels-for-simple-dioramas)
- [Sketchfab – Ilios](https://sketchfab.com/blogs/community/art-spotlight-ilios)
- [Krea – cozy isometric voxel moodboard](https://www.krea.ai/moodboard-feed/cozy-isometric-voxel-4beff9fd-3e9e-55e3-8317-ab0e86c0ef18)
- A user-supplied reference: a whitewashed Cycladic voxel house with blue trim and bougainvillea. Its seams and per-voxel colour jitter are the target look.

**Procedural islands**
- [Islanders](https://wikipedia.com/wiki/Islanders_(game))
- [Bad North](https://store.steampowered.com/app/688420/Bad_North/)
- [Townscaper](https://en.wikipedia.org/wiki/Townscaper)
- [80.lv – Wave Function Collapse for dioramas](https://80.lv/articles/using-wave-function-collapse-algorithm-for-dioramas)

### Landing pages

- [Pudgy World](https://www.pudgyworld.com/): a game landing page, user-supplied reference. It is a single scrolling page with a story hook (a missing character), a world gallery, a features list, and repeated calls to action.

- [haru-ni.net](https://haru-ni.net/): corporate site of a game studio, user-supplied reference.
  - The homepage is a map built with three.js: `WebGLRenderer`, an `OrthographicCamera` and illustrated `Sprite`s.
  - Visitors pan it by drag, pinch or wheel. Clicking a place opens its section as a page that transitions over the canvas.
  - Sections: Game Production, Works, Education, Company, Recruit, Contact.

### three.js

- [Three.js Journey](https://threejs-journey.com/): course by Bruno Simon
- [Bruno Simon – portfolio case study](https://medium.com/@bruno_simon/bruno-simon-portfolio-case-study-960402cc259b)
- [three.js manual – WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)

### Astro

As of 2026-11-11:
- `astro` 7.4.10
- `@astrojs/mdx` 8.1.4
- three r187

Docs:
- [Astro 7 release](https://astro.build/blog/astro-7/)
- [Upgrade to v7](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Upgrade to v6](https://docs.astro.build/en/guides/upgrade-to/v6/)

## Open questions

None. The design tree is fully visited; implementation is pending.


