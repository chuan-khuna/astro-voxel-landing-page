# 07: Landmark routes over the World

**What to build:** A visitor clicks a Landmark, the camera flies there, and that section opens as a real page with its own URL over the World. Closing it returns to the World where they left it.

**Blocked by:** 06

**Status:** resolved

Spec: `.scratch/voxel-world-landing/spec.md`

- [x] The work starts by proving the canvas persists across routes on Astro 7; if it cannot, the panel fetches the page content itself, with the same URLs and static pages
- [x] Static routes exist for `/services`, `/about`, `/about/team`, `/garden`, `/dock` and `/contact`, each with intro copy from the `pages` collection
- [x] Clicking a Landmark flies the camera to it and opens its page as a side panel on desktop and a bottom sheet on mobile
- [x] The World keeps its Seed, meshes and camera across route changes; a rolled Seed follows in the URL
- [x] Opening a route directly places the camera at its Landmark with the page open
- [x] Browser back and forward move between pages and the World
- [x] Each page is full static HTML, readable without JS
- [x] `astro check` and `astro build` pass
- [x] Documents under `docs/documents/` and its INDEX are updated for anything this ticket adds or changes
