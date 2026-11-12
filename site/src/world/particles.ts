/**
 * Particles' spawn areas (ADR 0005): where each of the Biome's Ambient Life
 * particles lives, worked out once the layout and Decoration are done, from
 * a sequence of the Seed's own (`<seed>/particles`), so it never moves the
 * layout and the same layout always gets the same areas.
 *
 * Each Biome has its own particles, and Day or Night decides which are out
 * (`PARTICLE_SETS`). The World holds the areas of both; the renderer shows
 * the ones out (`render/particles.ts`).
 *
 * An area is a box of air over level land (`ParticleArea`). Rules, every one
 * held by `generateWorld`'s tests:
 * - every cell under the box is land no higher than the box's ground (the
 *   ground of its centre cell), never a footprint
 *   or the Dock's jetty, never a bridge, and holds no Decoration taller than
 *   the box's floor;
 * - no Landmark's sight line to the camera passes below the box's top
 *   (`sightClearance`, the check Decoration uses);
 * - butterflies flutter round a flower clump (centred on it or next to it); fireflies hang low over grass;
 *   snow and ash drift down anywhere on the land;
 * - areas of one kind keep apart, and each kind has a cap.
 */
import { DECORATION_HEIGHT } from './decoration';
import { createRng } from './prng';
import { sightClearance } from './sightline';
import type { BiomeId, Bridge, Decoration, ParticleArea, ParticleKind, PlacedLandmark, Terrain } from './types';

/**
 * Which particles are out in each Biome, by Day and at Night (the spec's
 * Biome × Day/Night table; the creatures, leaves and foam are elsewhere).
 * Snow and ash are weather, so they keep falling at Night.
 */
export const PARTICLE_SETS: Record<BiomeId, { day: readonly ParticleKind[]; night: readonly ParticleKind[] }> = {
  tropical: { day: ['butterfly'], night: ['firefly'] },
  northern: { day: ['snow'], night: ['firefly', 'snow'] },
  autumn: { day: [], night: ['firefly'] },
  volcanic: { day: ['ash'], night: ['ash'] },
};

/**
 * Each kind's box: its half-width across the ground, its floor and top above
 * the ground (units), and how many areas a World has at most. Floors clear
 * grass, clumps and rocks (½ unit); boxes keep off taller Decoration.
 */
export const PARTICLE_AREA: Record<ParticleKind, { radius: number; floor: number; top: number; most: number }> = {
  butterfly: { radius: 0.9, floor: 0.55, top: 1.4, most: 6 },
  firefly: { radius: 1.1, floor: 0.55, top: 1.1, most: 8 },
  snow: { radius: 1.4, floor: 0.55, top: 3.5, most: 14 },
  ash: { radius: 1.4, floor: 0.55, top: 3.5, most: 12 },
};

/** A clump's cell and its eight neighbours: where a butterfly swarm may be centred. */
const NEAR = [-1, 0, 1].flatMap((dz) => [-1, 0, 1].map((dx) => [dx, dz] as const));

/** Areas of one kind keep at least this far apart, centre to centre, in units: no two swarms in one place. */
const AREA_GAP = 2.5;

/** Place the spawn areas of every particle the Biome has, by Day and at Night. */
export function placeParticles(
  seed: string,
  biome: BiomeId,
  terrain: Terrain,
  bridges: Bridge[],
  landmarks: PlacedLandmark[],
  decoration: Decoration[],
): ParticleArea[] {
  const { width, depth, heights, isle, surface } = terrain;
  const index = (x: number, z: number) => z * width + x;
  const sets = PARTICLE_SETS[biome];
  const kinds = [...new Set([...sets.day, ...sets.night])];
  if (kinds.length === 0) return [];

  // Cells no box may cover: footprints, the jetty, bridges. And how tall the Decoration on each cell stands.
  const covered = new Uint8Array(width * depth);
  for (const l of landmarks) for (const c of [...l.footprint.cells, ...l.jetty]) if (c.x >= 0 && c.z >= 0 && c.x < width && c.z < depth) covered[index(c.x, c.z)] = 1;
  for (const b of bridges) for (const c of b.cells) covered[index(c.x, c.z)] = 1;
  const standing = new Float64Array(width * depth);
  for (const d of decoration) standing[index(d.cell.x, d.cell.z)] = DECORATION_HEIGHT[d.kind];
  const tallest = Math.max(...kinds.map((k) => PARTICLE_AREA[k].top));
  const clearance = sightClearance(
    terrain,
    landmarks.map((l) => ({ y: l.y, cells: [...l.footprint.cells, ...l.jetty] })),
    Math.max(...heights) + tallest,
  );

  /** The box of `kind` centred on (`cx`, `cz`) over ground `ground`, if every cell under it allows it. */
  const boxAt = (kind: ParticleKind, cx: number, cz: number, ground: number): ParticleArea | null => {
    const { radius, floor, top } = PARTICLE_AREA[kind];
    for (let z = Math.floor(cz - radius); z <= Math.floor(cz + radius); z++) {
      for (let x = Math.floor(cx - radius); x <= Math.floor(cx + radius); x++) {
        if (x < 0 || z < 0 || x >= width || z >= depth) return null;
        const i = index(x, z);
        if (isle[i] === -1 || covered[i] || heights[i]! > ground) return null;
        if (standing[i]! > floor) return null;
        if (clearance[i]! < ground + top) return null;
      }
    }
    return { kind, centre: { x: cx, z: cz }, radius, ground, floor: ground + floor, top: ground + top };
  };

  const rng = createRng(`${seed}/particles`);
  const clumps = decoration.filter((d) => d.kind === 'clump');
  const land: Array<{ x: number; z: number }> = [];
  for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) if (isle[index(x, z)] !== -1) land.push({ x, z });

  const areas: ParticleArea[] = [];
  for (const kind of kinds) {
    // Where a swarm of this kind may be centred: round a clump, over grass, or anywhere on the land.
    const candidates =
      kind === 'butterfly'
        ? clumps.flatMap((d) => NEAR.map(([dx, dz]) => ({ x: d.cell.x + dx, z: d.cell.z + dz }))).filter((c) => c.x >= 0 && c.z >= 0 && c.x < width && c.z < depth && isle[index(c.x, c.z)] !== -1)
        : kind === 'firefly'
          ? land.filter((c) => surface[index(c.x, c.z)] === 'grass')
          : land;
    // Shuffle (Fisher–Yates), so the areas spread over the whole World.
    const order = [...candidates];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const placed: ParticleArea[] = [];
    for (const cell of order) {
      if (placed.length >= PARTICLE_AREA[kind].most) break;
      const cx = cell.x + 0.5;
      const cz = cell.z + 0.5;
      if (placed.some((a) => Math.hypot(a.centre.x - cx, a.centre.z - cz) < AREA_GAP)) continue;
      const area = boxAt(kind, cx, cz, heights[index(cell.x, cell.z)]!);
      if (area) placed.push(area);
    }
    areas.push(...placed);
  }
  return areas;
}
