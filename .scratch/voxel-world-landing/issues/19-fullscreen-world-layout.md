# 19: Full-screen World layout and Jersey fonts

**What to build:** The World fills the whole viewport, like haru-ni.net. The company name, Landmark menu, dice and section panels float over it as cards instead of sitting in a page column around a framed canvas. The site uses Jersey 20 for body text and Jersey 15 for headings.

**Blocked by:** 07, 09 (run before 10–17, which place Data Cards, the Guide, the Tour and the theme toggle over the World)

**Status:** ready-for-agent

Spec: `.scratch/voxel-world-landing/spec.md`

Requested by the user on 2026-11-11, comparing the current page with haru-ni.net. The spec named haru-ni for the interaction (pan, zoom, routes over the canvas) but never stated the full-screen layout, so the first build put the canvas in a framed column.

Also requested on 2026-11-11: "use Jersey 20 for body font, Jersey 15 for heading font".

## Layout

- [ ] The World canvas fills the viewport (`100dvh`, edge to edge), with no frame or border. The page does not scroll while the World is shown.
- [ ] **Top left:** the company logo and name float over the World.
- [ ] **Top right:** the Landmark menu is a floating rounded bar, haru-ni style. The current section is marked (`aria-current`). On phones it collapses into a menu button.
- [ ] **Bottom left:** the dice button and the current Seed.
- [ ] **Section panels** are floating rounded cards with a shadow. They are not full height. On desktop the card sits at one side and leaves room for the camera's focus on the Landmark; on phones it is a bottom sheet. Long content scrolls inside the card.
- [ ] The Overview's intro copy (tagline and story) sits in the same floating card style.
- [ ] Camera framing (`landmarkFocus` and flights) accounts for the new card position, so the focused Landmark stays in the free part of the screen.
- [ ] Hotspots, keyboard focus order, Escape to close and focus moving to the panel still work.
- [ ] Without JS, or without WebGPU/WebGL, the page is still a normal readable HTML page that scrolls. The fallback must not be a viewport-locked empty screen.

## Fonts

- [ ] Jersey 20 is the body font and Jersey 15 is the heading font (h1–h3, card titles and the company name). Both are self-hosted (e.g. Fontsource), with `font-display: swap` and a sensible fallback stack.
- [ ] The font choice lives in the site data module or theme tokens, not scattered through components.
- [ ] Body size and line height are tuned so pixel-style text stays readable in panels and on phones.
- [ ] Contrast stays at WCAG AA.

## Checks

- [ ] The real page is checked in a browser at 1280×800, 1920×1080 and 390×844 on several Seeds and every route. There are no console errors, and screenshots are attached to the report.
- [ ] `astro check`, the full test suite and `astro build` pass.
- [ ] The spec gains an explicit layout section (full-screen World, floating UI, fonts). `docs/documents/` and its INDEX are updated.
