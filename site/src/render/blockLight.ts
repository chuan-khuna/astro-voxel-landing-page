/**
 * Block light (polish ticket 16, ADR 0007): the warm light torches, lamps
 * and lit windows throw at Night, spread over the World's 1-unit cells the
 * way a torch lights the blocks near it in a block-building game. Pure: no
 * three.js, so it runs in the World Web Worker beside the mesher.
 *
 * `floodLight` is the flood fill: from each source's cell, one level less
 * per cell (steps along the axes), stopped by solid cells; where sources
 * overlap the brighter level wins. `bakeBlockLight` turns a World's Light
 * Sources (`lightSources.ts`) into a volume of RGBA bytes a cell: the light's
 * colour times its brightness, and the phase its flame flickers at. The
 * voxel materials sample it at Night (`blockLightNode.ts`).
 */
import type { World } from '@/world';
import { THEME_TOKENS } from '@/data/theme';
import { oklchToLinear } from './palette';
import { lightSources, type LightSource } from './lightSources';

/** The cells a flood fill runs over: `solid` cells stop light and hold none. */
export interface LightGrid {
  width: number;
  height: number;
  depth: number;
  solid: (x: number, y: number, z: number) => boolean;
}

/** A source for the flood fill: its cell and its level there (it reaches `level` − 1 cells). */
export interface FloodSource {
  x: number;
  y: number;
  z: number;
  level: number;
}

/** No source lights this cell. */
export const NO_SOURCE = 0xffff;

/**
 * Flood light from each source over the grid: `level[at(x, y, z)]` is the
 * brightest level that reaches the cell (0 for none) and `source[…]` the
 * index of the source it comes from (`NO_SOURCE` for none).
 */
export function floodLight(grid: LightGrid, sources: readonly FloodSource[]) {
  const { width, height, depth, solid } = grid;
  const at = (x: number, y: number, z: number) => x + width * (y + height * z);
  const level = new Uint8Array(width * height * depth);
  const source = new Uint16Array(width * height * depth).fill(NO_SOURCE);
  const inside = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < width && y < height && z < depth;
  // One queue per level, brightest first: a cell is spread from once, at its final level.
  const queues: number[][] = [];
  sources.forEach((s, i) => {
    if (!inside(s.x, s.y, s.z) || solid(s.x, s.y, s.z) || s.level <= 0) return;
    const c = at(s.x, s.y, s.z);
    if (s.level <= level[c]!) return;
    level[c] = s.level;
    source[c] = i;
    (queues[s.level] ??= []).push(c);
  });
  const steps = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;
  for (let l = queues.length - 1; l > 1; l--) {
    for (const c of queues[l] ?? []) {
      if (level[c] !== l) continue;
      const x = c % width;
      const y = Math.floor(c / width) % height;
      const z = Math.floor(c / (width * height));
      for (const [dx, dy, dz] of steps) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (!inside(nx, ny, nz) || solid(nx, ny, nz)) continue;
        const n = at(nx, ny, nz);
        if (level[n]! >= l - 1) continue;
        level[n] = l - 1;
        source[n] = source[c]!;
        (queues[l - 1] ??= []).push(n);
      }
    }
  }
  return { level, source, at };
}

/** A World's block light, ready for a 3D texture: RGBA bytes a cell, x fastest, then y, then z. */
export interface LightVolume {
  width: number;
  height: number;
  depth: number;
  /** Per cell: the light's linear colour times its brightness (RGB, 0–255) and its source's flicker phase (A: 1–255 for a flame, 0 for a steady light). */
  data: Uint8Array;
  /** How many Light Sources throw light. */
  sources: number;
}

/** Cells of air kept over the highest ground, so every source and its reach fit and the top layer stays dark. */
const HEADROOM = 12;

/** Linear colour of a Light Source's light (the Night tokens: by Day the light is off). */
export function lightColour(world: Pick<World, 'biome'>, source: LightSource): readonly [number, number, number] {
  const tokens = THEME_TOKENS.night.world;
  if (source.colour === 'window') return oklchToLinear(tokens.windowLight);
  if (source.colour === 'buoy') return oklchToLinear(tokens.buoyLight);
  return oklchToLinear(tokens.torchLight[world.biome.id]);
}

/**
 * Bake a World's block light: flood every Light Source's light over the
 * World's cells (the terrain is solid; structures are smaller than a cell
 * and let it through), then colour each lit cell by the source whose light
 * is brightest there. A level `l` of a source reaching `r` cells at
 * strength `s` is brightness `s · (l / r)²`.
 */
export function bakeBlockLight(world: World): LightVolume {
  const { width, depth, heights } = world.terrain;
  const height = Math.max(...heights) + HEADROOM;
  const sources = lightSources(world);
  const { level, source } = floodLight(
    { width, height, depth, solid: (x, y, z) => y < heights[z * width + x]! },
    sources.map((s) => ({ x: Math.floor(s.x), y: Math.floor(s.y), z: Math.floor(s.z), level: s.reach })),
  );
  const colours = sources.map((s) => lightColour(world, s));
  const data = new Uint8Array(level.length * 4);
  for (let c = 0; c < level.length; c++) {
    const i = source[c]!;
    if (i === NO_SOURCE) continue;
    const s = sources[i]!;
    // Brightest by the source, falling off faster than the level does (a torch's pool of light).
    const brightness = s.strength * (level[c]! / s.reach) ** 2;
    const [r, g, b] = colours[i]!;
    data[c * 4] = Math.round(255 * r * brightness);
    data[c * 4 + 1] = Math.round(255 * g * brightness);
    data[c * 4 + 2] = Math.round(255 * b * brightness);
    // A flame's phase (1–255); 0 for a steady light, which never flickers.
    data[c * 4 + 3] = s.flickers ? 1 + Math.round(254 * s.phase) : 0;
  }
  return { width, height, depth, data, sources: sources.length };
}
