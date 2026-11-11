import { afterEach, describe, expect, it, vi } from 'vitest';
import { site } from '@/data/site';
import { BIOME_COLOUR_ROLES, BIOME_IDS, MAX_BUOYS, generateWorld, type ContentCounts, type World } from './index';

const counts: ContentCounts = { projects: 6, clients: 5, partners: 3 };
const PLACED = ['station', 'house', 'garden', 'dock', 'mailbox'];
const sampledSeeds = Array.from({ length: 200 }, (_, i) => `seed-${i * 7919}`);
/** One World per sampled Seed, generated once and shared by the rule tests. */
const worlds = new Map<string, World>();
const worldFor = (seed: string): World => {
  if (!worlds.has(seed)) worlds.set(seed, generateWorld(seed, counts));
  return worlds.get(seed)!;
};

describe('generateWorld', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives a deep-equal World for the same Seed and content counts', () => {
    expect(generateWorld('harbour', counts)).toEqual(generateWorld('harbour', counts));
    expect(generateWorld('12345', counts)).toEqual(generateWorld('12345', counts));
  });

  it('never uses Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    expect(() => generateWorld('harbour', counts)).not.toThrow();
  });

  it('gives different Worlds for different Seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e'].map((s) => JSON.stringify({ ...generateWorld(s, counts), seed: '' }));
    expect(new Set(worlds).size).toBeGreaterThan(1);
  });

  it('places each of the five placed Landmarks exactly once, for every sampled Seed', () => {
    for (const seed of sampledSeeds) {
      const ids = worldFor(seed).landmarks.map((l) => l.id);
      expect(ids.toSorted(), seed).toEqual(PLACED.toSorted());
    }
  });

  /** Every cell a Landmark covers: its footprint, plus the Dock's jetty. */
  const coveredCells = (l: World['landmarks'][number]) => [...l.footprint.cells, ...l.jetty];
  const key = (c: { x: number; z: number }) => `${c.x},${c.z}`;
  const isSeaAt = (world: World, x: number, z: number) => world.terrain.isle[z * world.terrain.width + x] === -1;
  const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  it('gives each placed Landmark a rectangular footprint: origin, width, depth and the cells it covers', () => {
    const sizes: Record<string, Array<[number, number]>> = {
      house: [[4, 4]],
      station: [[2, 2]],
      mailbox: [[1, 1]],
      dock: [[2, 1], [1, 2]],
    };
    for (const seed of sampledSeeds) {
      for (const l of worldFor(seed).landmarks) {
        const { origin, width, depth, cells } = l.footprint;
        const rectangle = [];
        for (let z = origin.z; z < origin.z + depth; z++) for (let x = origin.x; x < origin.x + width; x++) rectangle.push({ x, z });
        expect(cells.map(key).toSorted(), `${seed} ${l.id}`).toEqual(rectangle.map(key).toSorted());
        if (l.id === 'garden') {
          expect(width, seed).toBeGreaterThanOrEqual(3);
          expect(depth, seed).toBeGreaterThanOrEqual(3);
        } else {
          expect(sizes[l.id], `${seed} ${l.id}`).toContainEqual([width, depth]);
        }
      }
    }
  });

  it('stands every footprint on flat land of the Isle it names, at the Landmark\'s height', () => {
    for (const seed of sampledSeeds) {
      const { terrain, landmarks } = worldFor(seed);
      for (const l of landmarks) {
        expect(l.y, `${seed} ${l.id}`).toBeGreaterThan(0);
        for (const c of l.footprint.cells) {
          const i = c.z * terrain.width + c.x;
          expect(terrain.isle[i], `${seed} ${l.id}`).toBe(l.isle);
          expect(terrain.heights[i], `${seed} ${l.id} ${key(c)}`).toBe(l.y);
        }
      }
    }
  });

  it('never overlaps two footprints, a bridge or bridge end, or the Dock-to-House path', () => {
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      const { width } = world.terrain;
      // The Mailbox stands in the House's front yard, on the House's plot: it has no ground of its own.
      const covered = world.landmarks.filter((l) => l.id !== 'mailbox').flatMap((l) => coveredCells(l).map(key));
      expect(new Set(covered).size, seed).toBe(covered.length);
      const coveredSet = new Set(covered);
      for (const b of world.bridges) {
        // The bridge cells and the land cell beyond each end.
        const first = b.cells[0]!;
        const last = b.cells.at(-1)!;
        const ends = SIDES.flatMap(([dx, dz]) => [
          { x: first.x + dx, z: first.z + dz },
          { x: last.x + dx, z: last.z + dz },
        ]).filter((c) => world.terrain.isle[c.z * width + c.x] !== -1);
        for (const c of [...b.cells, ...ends]) expect(coveredSet.has(key(c)), `${seed} bridge ${key(c)}`).toBe(false);
      }
      for (const p of world.paths) for (const c of p.cells) expect(coveredSet.has(key(c)), `${seed} path ${key(c)}`).toBe(false);
    }
  });

  it('keeps footprints out of the sea, except the Dock\'s jetty, which reaches 2–3 cells straight out to sea', () => {
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      for (const l of world.landmarks) {
        for (const c of l.footprint.cells) expect(isSeaAt(world, c.x, c.z), `${seed} ${l.id}`).toBe(false);
        if (l.id !== 'dock') expect(l.jetty, `${seed} ${l.id}`).toEqual([]);
      }
      const dock = world.landmarks.find((l) => l.id === 'dock')!;
      expect(dock.jetty.length, seed).toBeGreaterThanOrEqual(2);
      expect(dock.jetty.length, seed).toBeLessThanOrEqual(3);
      for (const c of dock.jetty) expect(isSeaAt(world, c.x, c.z), `${seed} jetty ${key(c)}`).toBe(true);
      // The jetty starts beside a footprint cell and runs straight on, away from it.
      const start = dock.jetty[0]!;
      const root = dock.footprint.cells.find((c) => Math.abs(c.x - start.x) + Math.abs(c.z - start.z) === 1);
      expect(root, seed).toBeDefined();
      const dx = start.x - root!.x;
      const dz = start.z - root!.z;
      dock.jetty.forEach((c, k) => expect(c, seed).toEqual({ x: root!.x + dx * (k + 1), z: root!.z + dz * (k + 1) }));
    }
  });

  it('lays out the Garden with one cell per tree, inside it, plus room for paths', () => {
    for (const projects of [0, 1, 6, 9, 24, 500]) {
      for (const seed of sampledSeeds.slice(0, 40)) {
        const garden = generateWorld(seed, { ...counts, projects }).landmarks.find((l) => l.id === 'garden')!;
        expect(garden.trees, `${seed} ${projects}`).toHaveLength(Math.min(projects, 24));
        const inside = new Set(garden.footprint.cells.map(key));
        const trees = garden.trees.map(key);
        expect(new Set(trees).size).toBe(trees.length);
        for (const t of trees) expect(inside.has(t), `${seed} tree ${t}`).toBe(true);
        expect(garden.footprint.cells.length).toBeGreaterThan(trees.length);
      }
    }
    for (const seed of sampledSeeds) {
      for (const l of worldFor(seed).landmarks) if (l.id !== 'garden') expect(l.trees, `${seed} ${l.id}`).toEqual([]);
    }
  });

  it('grows the Garden with the number of trees', () => {
    const area = (projects: number) =>
      generateWorld('harbour', { ...counts, projects }).landmarks.find((l) => l.id === 'garden')!.footprint.cells.length;
    expect(area(0)).toBe(9);
    expect(area(24)).toBeGreaterThan(area(6));
  });

  /**
   * Is any terrain or bridge in front of this point, seen from the fixed
   * isometric camera? The camera looks along −(1, 1, 1), so march the ray
   * from the point towards (1, 1, 1) until it clears the highest ground.
   */
  const hiddenFromCamera = (world: World, px: number, py: number, pz: number) => {
    const { width, depth, heights } = world.terrain;
    const top = Math.max(...heights, ...world.bridges.map((b) => b.y));
    // Bridge decks, and the Dock's jetty: a deck at the Dock's height.
    const deck = new Map([
      ...world.bridges.flatMap((b) => b.cells.map((c) => [key(c), b.y] as const)),
      ...world.landmarks.flatMap((l) => l.jetty.map((c) => [key(c), l.y] as const)),
    ]);
    for (let t = 0.001; py + t <= top; t += 0.02) {
      const x = px + t;
      const y = py + t;
      const z = pz + t;
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      if (cx >= width || cz >= depth) return false;
      // Past the grid's low edges is open sea.
      if (cx >= 0 && cz >= 0 && y < heights[cz * width + cx]!) return true;
      const deckY = deck.get(`${cx},${cz}`);
      if (deckY !== undefined && y < deckY && y > deckY - 0.25) return true;
    }
    return false;
  };

  it('never hides a Landmark behind terrain or a bridge from the isometric camera', () => {
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      for (const l of world.landmarks) {
        // Every point of the ground the Landmark covers, on a ¼-cell grid. Points
        // above it (the model) are then visible too: the ray from a higher point
        // runs above the ray from the ground point below it.
        for (const c of coveredCells(l)) {
          for (let i = 0; i <= 4; i++) {
            for (let k = 0; k <= 4; k++) {
              const hidden = hiddenFromCamera(world, c.x + i / 4, l.y, c.z + k / 4);
              expect(hidden, `${seed} ${l.id} ${key(c)} +${i / 4},${k / 4}`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('defines the two derived views, Overview and House Interior', () => {
    for (const seed of sampledSeeds) {
      const { views, landmarks } = worldFor(seed);
      expect(views.overview.radius).toBeGreaterThan(0);
      expect(views['house-interior'].radius).toBeGreaterThan(0);
      const house = landmarks.find((l) => l.id === 'house')!;
      // House Interior is derived from the House's position: the middle of the House (3×3) at its plot's origin.
      const { origin } = house.footprint;
      expect(views['house-interior'].target).toEqual({ x: origin.x + 1.5, y: house.y, z: origin.z + 1.5 });
    }
  });

  it('frames every cell each Landmark covers inside the Overview', () => {
    for (const seed of sampledSeeds) {
      const { views, landmarks } = worldFor(seed);
      const { target, radius } = views.overview;
      for (const l of landmarks) {
        for (const c of coveredCells(l)) {
          expect(Math.abs(c.x + 0.5 - target.x), `${seed} ${l.id}`).toBeLessThanOrEqual(radius);
          expect(Math.abs(c.z + 0.5 - target.z), `${seed} ${l.id}`).toBeLessThanOrEqual(radius);
        }
      }
    }
  });

  it('generates one to four Isles, and every count occurs across sampled Seeds', () => {
    const seen = new Set<number>();
    for (const seed of sampledSeeds) {
      const n = worldFor(seed).isles.length;
      expect(n, seed).toBeGreaterThanOrEqual(1);
      expect(n, seed).toBeLessThanOrEqual(4);
      seen.add(n);
    }
    expect([...seen].toSorted()).toEqual([1, 2, 3, 4]);
  });

  it('quantises heights to whole voxel steps, with sea at 0 and stepped land', () => {
    let stepped = 0;
    for (const seed of sampledSeeds) {
      const { terrain } = worldFor(seed);
      const bad = terrain.heights.filter((h, i) => !Number.isInteger(h) || (h === 0) !== (terrain.isle[i] === -1));
      expect(bad, seed).toEqual([]);
      if (new Set(terrain.heights.filter((h) => h > 0)).size >= 3) stepped++;
    }
    // Noise terrain: most Worlds have at least three land heights.
    expect(stepped).toBeGreaterThan(sampledSeeds.length / 2);
  });

  it('surrounds the World with sea', () => {
    for (const seed of sampledSeeds) {
      const { terrain } = worldFor(seed);
      for (let x = 0; x < terrain.width; x++) {
        expect(terrain.isle[x], seed).toBe(-1);
        expect(terrain.isle[(terrain.depth - 1) * terrain.width + x], seed).toBe(-1);
      }
      for (let z = 0; z < terrain.depth; z++) {
        expect(terrain.isle[z * terrain.width], seed).toBe(-1);
        expect(terrain.isle[z * terrain.width + terrain.width - 1], seed).toBe(-1);
      }
    }
  });

  it('gives each Isle one connected footprint matching its bounds and cell count', () => {
    for (const seed of sampledSeeds) {
      const { terrain, isles } = worldFor(seed);
      isles.forEach((isle, index) => {
        expect(isle.id).toBe(index);
        const cells: Array<[number, number]> = [];
        terrain.isle.forEach((id, i) => {
          if (id === isle.id) cells.push([i % terrain.width, Math.floor(i / terrain.width)]);
        });
        expect(cells.length, seed).toBe(isle.cellCount);
        for (const [x, z] of cells) {
          expect(x >= isle.bounds.minX && x <= isle.bounds.maxX && z >= isle.bounds.minZ && z <= isle.bounds.maxZ).toBe(true);
        }
        // Flood fill from the first cell reaches them all.
        const key = (x: number, z: number) => z * terrain.width + x;
        const seen = new Set([key(...cells[0]!)]);
        const queue = [cells[0]!];
        while (queue.length > 0) {
          const [x, z] = queue.pop()!;
          for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
            if (terrain.isle[key(nx, nz)] === isle.id && !seen.has(key(nx, nz))) {
              seen.add(key(nx, nz));
              queue.push([nx, nz]);
            }
          }
        }
        expect(seen.size, `${seed} isle ${isle.id}`).toBe(isle.cellCount);
      });
    }
  });

  it('links every Isle to every other by bridges', () => {
    for (const seed of sampledSeeds) {
      const { isles, bridges } = worldFor(seed);
      const reached = new Set([0]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const b of bridges) {
          if (reached.has(b.from) !== reached.has(b.to)) {
            reached.add(b.from).add(b.to);
            grew = true;
          }
        }
      }
      expect(reached.size, seed).toBe(isles.length);
    }
  });

  it('builds each bridge as a straight run of sea cells between two level ends on the Isles it names', () => {
    for (const seed of sampledSeeds) {
      const { terrain, bridges } = worldFor(seed);
      const at = (x: number, z: number) => z * terrain.width + x;
      for (const b of bridges) {
        expect(b.from, seed).not.toBe(b.to);
        expect(b.cells.length, seed).toBeGreaterThan(0);
        const dx = Math.sign(b.cells.at(-1)!.x - b.cells[0]!.x);
        const dz = Math.sign(b.cells.at(-1)!.z - b.cells[0]!.z);
        expect(Math.abs(dx) + Math.abs(dz), seed).toBeLessThanOrEqual(1);
        const step = b.cells.length > 1 ? { dx, dz } : null;
        b.cells.forEach((c, k) => {
          expect(terrain.isle[at(c.x, c.z)], seed).toBe(-1);
          if (k > 0 && step) expect({ x: c.x, z: c.z }).toEqual({ x: b.cells[k - 1]!.x + dx, z: b.cells[k - 1]!.z + dz });
        });
        // The cells just beyond each end are land of the named Isles, at deck height.
        const first = b.cells[0]!;
        const last = b.cells.at(-1)!;
        const ends = [
          [b.from, first, -1],
          [b.to, last, 1],
        ] as const;
        const candidates = step ? [step] : [{ dx: 1, dz: 0 }, { dx: 0, dz: 1 }];
        expect(
          candidates.some(({ dx: sx, dz: sz }) =>
            ends.every(([isle, c, sign]) => {
              const i = at(c.x + sign * sx, c.z + sign * sz);
              return terrain.isle[i] === isle && terrain.heights[i] === b.y;
            }),
          ),
          seed,
        ).toBe(true);
      }
    }
  });

  it('stands the House on a 4×4 plot, its door south or east onto the front yard', () => {
    const doors = new Set<string>();
    for (const seed of sampledSeeds) {
      const { landmarks } = worldFor(seed);
      const house = landmarks.find((l) => l.id === 'house')!;
      expect(['south', 'east'], seed).toContain(house.door);
      doors.add(house.door!);
      for (const l of landmarks) if (l.id !== 'house') expect(l.door, `${seed} ${l.id}`).toBeNull();
    }
    expect([...doors].toSorted()).toEqual(['east', 'south']);
  });

  it('stands the Mailbox in the House\'s front yard, in the plot\'s corner nearest the camera, on the House\'s ground', () => {
    for (const seed of sampledSeeds) {
      const { landmarks } = worldFor(seed);
      const house = landmarks.find((l) => l.id === 'house')!;
      const mailbox = landmarks.find((l) => l.id === 'mailbox')!;
      const { origin } = house.footprint;
      // The south-east corner, whichever way the door faces: never between the camera and the door.
      expect(mailbox.footprint.cells, seed).toEqual([{ x: origin.x + 3, z: origin.z + 3 }]);
      expect(mailbox.y, seed).toBe(house.y);
      expect(mailbox.isle, seed).toBe(house.isle);
    }
  });

  it('puts the House and the Garden on the same Isle', () => {
    for (const seed of sampledSeeds) {
      const { landmarks } = worldFor(seed);
      const isleOf = (id: string) => landmarks.find((l) => l.id === id)!.isle;
      expect(isleOf('garden'), seed).toBe(isleOf('house'));
    }
  });

  it('puts the Dock on the shoreline, at the water\'s edge', () => {
    for (const seed of sampledSeeds) {
      const { terrain, landmarks } = worldFor(seed);
      const { footprint } = landmarks.find((l) => l.id === 'dock')!;
      const seaBeside = footprint.cells.some((c) =>
        SIDES.some(([dx, dz]) => terrain.isle[(c.z + dz) * terrain.width + c.x + dx] === -1),
      );
      expect(seaBeside, seed).toBe(true);
    }
  });

  it('puts the Station on its Isle\'s high ground', () => {
    for (const seed of sampledSeeds) {
      const { terrain, landmarks } = worldFor(seed);
      const station = landmarks.find((l) => l.id === 'station')!;
      const isleTop = Math.max(...terrain.heights.filter((_, i) => terrain.isle[i] === station.isle));
      expect(station.y, seed).toBe(isleTop);
    }
  });

  /** Walking height of a cell: its land height, or the deck height on a bridge. */
  const walkHeight = (world: World, c: { x: number; z: number }) => {
    const bridge = world.bridges.find((b) => b.cells.some((bc) => bc.x === c.x && bc.z === c.z));
    if (bridge) return bridge.y;
    const i = c.z * world.terrain.width + c.x;
    return world.terrain.isle[i] === -1 ? undefined : world.terrain.heights[i];
  };

  it('lays a walkable path from beside the Dock to the House\'s door, over land and bridges', () => {
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      const landmark = (id: string) => world.landmarks.find((l) => l.id === id)!;
      /** Is `c` one step from the Landmark's footprint, and at most one voxel above or below it? */
      const beside = (id: string, c: { x: number; z: number }) => {
        const l = landmark(id);
        const touches = l.footprint.cells.some((f) => Math.abs(f.x - c.x) + Math.abs(f.z - c.z) === 1);
        return touches && Math.abs(walkHeight(world, c)! - l.y) <= 1;
      };
      const paths = world.paths.filter((p) => p.from === 'dock' && p.to === 'house');
      expect(paths, seed).toHaveLength(1);
      const { cells } = paths[0]!;
      expect(beside('dock', cells[0]!), seed).toBe(true);
      expect(beside('house', cells.at(-1)!), seed).toBe(true);
      // It ends just outside the plot, in line with the door in the middle of the House's front wall.
      const { origin } = landmark('house').footprint;
      const approach = landmark('house').door === 'south' ? { x: origin.x + 1, z: origin.z + 4 } : { x: origin.x + 4, z: origin.z + 1 };
      expect(cells.at(-1), seed).toEqual(approach);
      cells.forEach((c, k) => {
        const h = walkHeight(world, c);
        expect(h, `${seed} path cell ${k} is on land or a bridge`).toBeDefined();
        if (k === 0) return;
        const prev = cells[k - 1]!;
        expect(Math.abs(c.x - prev.x) + Math.abs(c.z - prev.z), seed).toBe(1);
        expect(Math.abs(h! - walkHeight(world, prev)!), `${seed} step ${k}`).toBeLessThanOrEqual(1);
      });
    }
  });

  it('puts stairs exactly at the single-step height changes along paths, climbing the right way', () => {
    const facingOf = (dx: number, dz: number) => (dx === 1 ? 'east' : dx === -1 ? 'west' : dz === 1 ? 'south' : 'north');
    let total = 0;
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      const expected = world.paths.flatMap(({ cells }) =>
        cells.slice(1).flatMap((c, k) => {
          const prev = cells[k]!;
          const [a, b] = [walkHeight(world, prev)!, walkHeight(world, c)!];
          if (a === b) return [];
          const [low, high] = a < b ? [prev, c] : [c, prev];
          return [{ cell: low, y: Math.min(a, b), facing: facingOf(high.x - low.x, high.z - low.z) }];
        }),
      );
      const key = (s: { cell: { x: number; z: number }; y: number; facing: string }) =>
        `${s.cell.x},${s.cell.z},${s.y},${s.facing}`;
      expect(world.stairs.map(key).toSorted(), seed).toEqual(expected.map(key).toSorted());
      total += world.stairs.length;
    }
    // Stepped terrain: stairs are common, not a rare edge case.
    expect(total).toBeGreaterThan(sampledSeeds.length);
  });

  it('gives cliffs a layered cross-section: a layer for every buried voxel, in visible bands', () => {
    for (const seed of sampledSeeds) {
      const { terrain, strata } = worldFor(seed);
      const top = Math.max(...terrain.heights);
      // Voxels below a column's top run from y = 0 to top - 2.
      expect(strata.length, seed).toBeGreaterThanOrEqual(top - 1);
      for (const kind of strata) expect(['soil', 'rock', 'rockDark'], seed).toContain(kind);
      if (top >= 4) expect(new Set(strata.slice(0, top - 1)).size, seed).toBeGreaterThanOrEqual(2);
    }
  });

  it('picks one of the four Biomes, and every Biome occurs across sampled Seeds', () => {
    const seen = new Set<string>();
    for (const seed of sampledSeeds) {
      const { biome } = worldFor(seed);
      expect(BIOME_IDS, seed).toContain(biome.id);
      seen.add(biome.id);
    }
    expect([...seen].toSorted()).toEqual([...BIOME_IDS].toSorted());
  });

  it('keeps every Biome colour muted: OKLCH chroma at most 0.10', () => {
    const biomes = new Map(sampledSeeds.map((seed) => {
      const { biome } = worldFor(seed);
      return [biome.id, biome] as const;
    }));
    expect(biomes.size).toBe(BIOME_IDS.length);
    for (const biome of biomes.values()) {
      expect(Object.keys(biome.colours).toSorted()).toEqual([...BIOME_COLOUR_ROLES].toSorted());
      for (const [role, { l, c, h }] of Object.entries(biome.colours)) {
        expect(c, `${biome.id} ${role}`).toBeLessThanOrEqual(0.1);
        expect(c, `${biome.id} ${role}`).toBeGreaterThanOrEqual(0);
        expect(l >= 0 && l <= 1, `${biome.id} ${role}`).toBe(true);
        expect(h >= 0 && h < 360, `${biome.id} ${role}`).toBe(true);
      }
    }
  });

  it('gives the default Seed the brand Biome', () => {
    expect(generateWorld(site.defaultSeed, counts).biome.id).toBe(site.brandBiome);
  });

  it('falls back to the default Seed when the Seed is empty or longer than 32 characters', () => {
    const fallback = generateWorld(site.defaultSeed, counts);
    expect(generateWorld('', counts)).toEqual(fallback);
    expect(generateWorld('x'.repeat(33), counts)).toEqual(fallback);
    const longest = generateWorld('y'.repeat(32), counts);
    expect(longest.seed).toBe('y'.repeat(32));
  });

  it('is deterministic across hundreds of sampled Seeds', () => {
    for (const seed of sampledSeeds) {
      expect(generateWorld(seed, counts), seed).toEqual(worldFor(seed));
    }
  });

  it('retries a layout that breaks a rule, deterministically, and always stops', () => {
    const retried = sampledSeeds.filter((seed) => worldFor(seed).attempts > 1);
    // Some sampled Seeds fail their first layout; every rule test above covers them too.
    expect(retried.length).toBeGreaterThan(0);
    for (const seed of sampledSeeds) {
      // Eight noise layouts, then the safe layout.
      expect(worldFor(seed).attempts, seed).toBeLessThanOrEqual(9);
    }
    for (const seed of retried) {
      const world = worldFor(seed);
      expect(world.seed).toBe(seed);
      expect(generateWorld(seed, counts), seed).toEqual(world);
    }
  });

  it('generates a World well within one second', () => {
    let slowest = 0;
    for (const seed of sampledSeeds) {
      const start = performance.now();
      generateWorld(seed, { projects: 24, clients: 12, partners: 6 });
      slowest = Math.max(slowest, performance.now() - start);
    }
    expect(slowest).toBeLessThan(250);
  });

  it('handles content counts of zero and large counts', () => {
    for (const c of [
      { projects: 0, clients: 0, partners: 0 },
      { projects: 500, clients: 500, partners: 500 },
    ]) {
      expect(generateWorld('harbour', c).landmarks).toHaveLength(5);
    }
  });

  it('moors one boat per Client at the Dock, up to 12', () => {
    for (const clients of [0, 1, 5, 12, 13, 500]) {
      for (const seed of sampledSeeds.slice(0, 40)) {
        expect(generateWorld(seed, { ...counts, clients }).boats, `${seed} ${clients}`).toHaveLength(Math.min(clients, 12));
      }
    }
  });

  it('sails one ship per Partner', () => {
    for (const partners of [0, 1, 3, 7, 500]) {
      for (const seed of sampledSeeds.slice(0, 20)) {
        expect(generateWorld(seed, { ...counts, partners }).ships, `${seed} ${partners}`).toHaveLength(partners);
      }
    }
  });

  /** Is the point inside the loop through these cells' centres? Ray casting along +x. */
  const encloses = (loop: Array<{ x: number; z: number }>, px: number, pz: number) => {
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!;
      const b = loop[j]!;
      if (a.z > pz !== b.z > pz && px < ((b.x - a.x) * (pz - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };
  const landCells = (world: World) =>
    world.terrain.isle.flatMap((owner, i) => (owner === -1 ? [] : [{ x: i % world.terrain.width, z: Math.floor(i / world.terrain.width), owner }]));

  it('sails each ship round a closed loop of open sea, clear of land, bridges, the jetty and the boats', () => {
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, clients: 12, partners: 7 });
      const hazards = [
        ...landCells(world),
        ...world.bridges.flatMap((b) => b.cells),
        ...world.landmarks.flatMap((l) => l.jetty),
        ...world.boats.map((b) => b.cell),
      ];
      for (const ship of world.ships) {
        const { cells, phase } = ship;
        expect(phase, seed).toBeGreaterThanOrEqual(0);
        expect(phase, seed).toBeLessThan(1);
        expect(cells.length, seed).toBeGreaterThanOrEqual(8);
        expect(new Set(cells.map(key)).size, seed).toBe(cells.length);
        cells.forEach((c, i) => {
          const next = cells[(i + 1) % cells.length]!;
          expect(Math.max(Math.abs(next.x - c.x), Math.abs(next.z - c.z)), `${seed} step ${key(c)}`).toBe(1);
        });
        for (const c of cells) {
          const nearest = Math.min(...hazards.map((h) => Math.max(Math.abs(h.x - c.x), Math.abs(h.z - c.z))));
          expect(nearest, `${seed} ${key(c)}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('sails every loop round the land: round the Isle when there is only one', () => {
    let single = 0;
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, partners: 4 });
      if (world.isles.length === 1) single++;
      const land = landCells(world);
      for (const { cells } of world.ships) {
        const centres = cells.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
        for (const c of land) expect(encloses(centres, c.x + 0.5, c.z + 0.5), `${seed} ${key(c)}`).toBe(true);
      }
    }
    expect(single).toBeGreaterThan(0);
  });

  it('sails between two Isles where a bridge leaves room to pass it', () => {
    /** Is this sea cell in a strait: land of two different Isles either side of it, along x or z? */
    const inStrait = (world: World, c: { x: number; z: number }) => {
      const { width, depth, isle } = world.terrain;
      const firstLand = (dx: number, dz: number) => {
        for (let s = 1; s <= 12; s++) {
          const x = c.x + dx * s;
          const z = c.z + dz * s;
          if (x < 0 || z < 0 || x >= width || z >= depth) return -1;
          if (isle[z * width + x] !== -1) return isle[z * width + x]!;
        }
        return -1;
      };
      return [[1, 0], [0, 1]].some(([dx, dz]) => {
        const one = firstLand(dx!, dz!);
        const other = firstLand(-dx!, -dz!);
        return one !== -1 && other !== -1 && one !== other;
      });
    };
    // A strait can still be too tight where the coasts bulge in: then the ship sails round instead.
    let checked = 0;
    let between = 0;
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, partners: 1 });
      if (!world.bridges.some((b) => b.cells.length >= 5)) continue;
      checked++;
      if (world.ships[0]!.cells.some((c) => inStrait(world, c))) between++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(between / checked).toBeGreaterThan(0.85);
  });

  it('spreads ships that share a loop round it', () => {
    const world = generateWorld('harbour', { ...counts, partners: 12 });
    const byLoop = new Map<string, number[]>();
    for (const { cells, phase } of world.ships) byLoop.set(JSON.stringify(cells), [...(byLoop.get(JSON.stringify(cells)) ?? []), phase]);
    for (const phases of byLoop.values()) expect(new Set(phases).size).toBe(phases.length);
    expect(byLoop.size).toBeGreaterThan(1);
  });

  it('moors each boat in its own sea cell beside the jetty or off its tip, bow out to sea, in plain view', () => {
    const FACING = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] } as const;
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, clients: 12 });
      const { width, depth } = world.terrain;
      const dock = world.landmarks.find((l) => l.id === 'dock')!;
      const jetty = new Set(dock.jetty.map(key));
      const bridgeCells = new Set(world.bridges.flatMap((b) => b.cells.map(key)));
      const cells = world.boats.map((b) => key(b.cell));
      expect(new Set(cells).size, seed).toBe(cells.length);
      const out = [dock.jetty[1]!.x - dock.jetty[0]!.x, dock.jetty[1]!.z - dock.jetty[0]!.z];
      for (const { cell, facing } of world.boats) {
        const inside = cell.x >= 0 && cell.z >= 0 && cell.x < width && cell.z < depth;
        if (inside) expect(isSeaAt(world, cell.x, cell.z), `${seed} ${key(cell)}`).toBe(true);
        expect(jetty.has(key(cell)) || bridgeCells.has(key(cell)), `${seed} ${key(cell)}`).toBe(false);
        const reach = Math.min(...dock.jetty.map((j) => Math.max(Math.abs(j.x - cell.x), Math.abs(j.z - cell.z))));
        expect(reach, `${seed} ${key(cell)}`).toBeLessThanOrEqual(2);
        expect(FACING[facing], seed).toEqual(out);
        for (let i = 0; i <= 4; i++) {
          for (let k = 0; k <= 4; k++) {
            expect(hiddenFromCamera(world, cell.x + i / 4, 0, cell.z + k / 4), `${seed} boat ${key(cell)}`).toBe(false);
          }
        }
        const { target, radius } = world.views.overview;
        expect(Math.abs(cell.x + 0.5 - target.x), seed).toBeLessThanOrEqual(radius);
        expect(Math.abs(cell.z + 0.5 - target.z), seed).toBeLessThanOrEqual(radius);
      }
    }
  });

  it('sets buoys out at sea near the Isles, clear of ships, boats, the jetty and bridges, apart and in plain view', () => {
    const chebyshev = (a: { x: number; z: number }, b: { x: number; z: number }) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    let withBuoys = 0;
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      const { width, depth, isle } = world.terrain;
      expect(world.buoys.length, seed).toBeLessThanOrEqual(MAX_BUOYS);
      if (world.buoys.length >= 2) withBuoys++;
      const land: Array<{ x: number; z: number }> = [];
      isle.forEach((owner, i) => owner !== -1 && land.push({ x: i % width, z: Math.floor(i / width) }));
      const dock = world.landmarks.find((l) => l.id === 'dock')!;
      const shipCells = world.ships.flatMap((s) => s.cells);
      const keepClear = [...dock.jetty, ...world.boats.map((b) => b.cell), ...world.bridges.flatMap((b) => b.cells)];
      world.buoys.forEach((buoy, n) => {
        const at = `${seed} buoy ${key(buoy)}`;
        expect(buoy.x >= 0 && buoy.z >= 0 && buoy.x < width && buoy.z < depth, at).toBe(true);
        expect(isSeaAt(world, buoy.x, buoy.z), at).toBe(true);
        const shore = Math.min(...land.map((c) => chebyshev(c, buoy)));
        expect(shore, at).toBeGreaterThanOrEqual(1);
        expect(shore, at).toBeLessThanOrEqual(4);
        for (const c of shipCells) expect(chebyshev(c, buoy), at).toBeGreaterThanOrEqual(2);
        for (const c of keepClear) expect(chebyshev(c, buoy), at).toBeGreaterThanOrEqual(2);
        for (const other of world.buoys.slice(n + 1)) expect(chebyshev(other, buoy), at).toBeGreaterThanOrEqual(4);
        // Its lamp, a unit above the sea floor in the middle of the cell, is never hidden.
        expect(hiddenFromCamera(world, buoy.x + 0.5, 1, buoy.z + 0.5), at).toBe(false);
      });
    }
    // Nearly every World has buoys to light at Night.
    expect(withBuoys, 'Worlds with two or more buoys').toBeGreaterThan(sampledSeeds.length * 0.9);
  });
});
