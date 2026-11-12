# Render with WebGPURenderer and TSL, not WebGLRenderer

The World renders with three.js `WebGPURenderer` (`three/webgpu`, r187), and all custom shading is written in TSL. Custom shading covers the per-voxel seams, bevel and colour jitter drawn over greedy-meshed faces.

TSL compiles to both WebGPU and the automatic WebGL 2 fallback, so the shaders are written once. It is also the direction three.js is heading, so we avoid a later migration.

## Consequences

- Every material is a node material. GLSL snippets and `onBeforeCompile` recipes from older tutorials do not apply directly.
- WebGPU-only features, such as compute, must not be load-bearing, because they are unavailable on the WebGL 2 fallback.

## Considered Options

- **`WebGLRenderer` with GLSL or `onBeforeCompile`.** More examples and more mature, but it ties the shaders to WebGL and needs a rewrite to move later.
