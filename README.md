# astro-voxel-landing-page

A corporate landing site for a data/AI company, built as an explorable,
seed-generated voxel **World**. The site is built with Astro and three.js
(WebGPU with a WebGL 2 fallback). Each Landmark in the World opens a real,
static page.

## Prerequisites

- [mise](https://mise.jdx.dev/), which installs the pinned tools from
  `mise.toml`:
  - Node 24
  - bun 1.4.4 (package manager)
  - just 1.59
  - uv 0.13.6
- A browser with WebGPU or WebGL 2 (any current Chrome, Edge, Firefox or Safari)

## Getting started

```sh
git clone https://github.com/chuan-khuna/astro-voxel-landing-page.git
cd astro-voxel-landing-page

mise trust      # allow this repo's mise.toml
mise install    # install the pinned toolchain

mise run dev    # install site dependencies and start the dev server
```

Then open the URL the dev server prints (Astro uses http://localhost:4321 by
default).

## Repository layout

| Path | What it is |
|---|---|
| `site/` | The Astro site: World generator, renderer, pages and content |
| `prototypes/look/` | Throwaway soft-voxel look prototype (`cd prototypes/look && bun install && bun run dev`) |
| `docs/` | ADRs, implementation documents and discussion records |
| `.scratch/` | Spec and implementation tickets |
| `GLOSSARY.md` | Domain vocabulary (World, Isle, Seed, Biome, Landmark, …) |
