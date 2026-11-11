# Each Landmark is a real static HTML route layered over the World

The home page is an explorable map that visitors pan by drag, pinch or wheel, modelled on haru-ni.net. Clicking a Landmark opens its section as a real route, such as `/about`, `/about/team`, `/garden` or `/garden/[slug]`. Astro renders that route as static HTML over the persistent World canvas, rather than as a canvas-only single-page app.

We chose this so every section is indexable, shareable, readable without JS or WebGL, and accessible.

## Consequences

- The World canvas and its state (Seed, camera, generated meshes) must survive route changes.
- Opening a route directly, for example a deep link to `/garden/foo`, must place the camera at that Landmark.
- Without WebGL or WebGPU, or without JS, a build-time still image of the default Seed plus an HTML Landmark menu stands in for the World.

## Considered Options

- **Scroll-driven single page.** Linear and easy to follow, but it fights free exploration of a generated World.
- **Canvas-only SPA with in-canvas panels.** Most immersive, but it is weak on SEO, deep links and accessibility.
