import { afterEach, describe, expect, it, vi } from 'vitest';
import { site } from '@/data/site';
import { BIOME_COLOUR_ROLES, BIOME_IDS, DECORATION_HEIGHT, DECORATION_KINDS, GARDEN_HEIGHT, LANDMARK_MIN_HEIGHT, MINOR_BUILDINGS, MAX_CLOUDS, MAX_SCHOOLS, FISH_AREA, HOUSE_CELLS, LANDMARK_HEIGHT, LANDMARK_VARIANTS, MAX_BUOYS, BOAT_KINDS, SHIP_KINDS, PARTICLE_SETS, CREATURE_SETS, ANIMAL_HEIGHT, ANIMAL_REACH, ANIMAL_SPECIES, MAX_ANIMALS_PER_ISLE, MAX_BIRDS, BIRD_REACH, BIRD_BELOW, BIRD_ABOVE, SERVICE_HEIGHT, SERVICE_KINDS, SERVICE_MIN_HEIGHT, generateWorld, type ContentCounts, type World } from './index';

const SERVICE_IDS = ['data-engineering', 'data-platforms', 'analytics', 'machine-learning'];
const counts: ContentCounts = { projects: 6, clients: 5, partners: 3, serviceIds: SERVICE_IDS };
const PLACED = ['station', 'house', 'garden', 'dock', 'mailbox'];
const sampledSeeds = Array.from({ length: 200 }, (_, i) => `seed-${i * 7919}`);
/** One World per sampled Seed, generated once and shared by the rule tests. */
const worlds = new Map<string, World>();
const worldFor = (seed: string): World => {
  if (!worlds.has(seed)) worlds.set(seed, generateWorld(seed, counts));
  return worlds.get(seed)!;
};

// Each rule is checked over hundreds of Worlds, and each Isle is up to 18 cells in radius:
// a test takes a few seconds, more than Vitest's default 5s when files run in parallel.
describe('generateWorld', { timeout: 20_000 }, () => {
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
      station: [[6, 6]],
      mailbox: [[1, 1]],
      garden: [[5, 5]],
      dock: [[2, 1], [1, 2]],
    };
    for (const seed of sampledSeeds) {
      for (const l of worldFor(seed).landmarks) {
        const { origin, width, depth, cells } = l.footprint;
        const rectangle = [];
        for (let z = origin.z; z < origin.z + depth; z++) for (let x = origin.x; x < origin.x + width; x++) rectangle.push({ x, z });
        expect(cells.map(key).toSorted(), `${seed} ${l.id}`).toEqual(rectangle.map(key).toSorted());
        expect(sizes[l.id], `${seed} ${l.id}`).toContainEqual([width, depth]);
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

  it('fixes the Garden at 5×5: a 3×3 bed inside a one-cell fence, its gate south or east', () => {
    const gates = new Set<string>();
    for (const seed of sampledSeeds) {
      const garden = worldFor(seed).landmarks.find((l) => l.id === 'garden')!;
      expect([garden.footprint.width, garden.footprint.depth], seed).toEqual([5, 5]);
      expect(['south', 'east'], seed).toContain(garden.door);
      gates.add(garden.door!);
    }
    expect([...gates].toSorted()).toEqual(['east', 'south']);
  });

  it('blooms the first Pinned Projects as flowers in the bed\'s front two rows, and grows the rest as trees in its back row', () => {
    const cases: Array<[projects: number, pinned: number, flowers: number, trees: number]> = [
      [0, 0, 0, 0],
      [1, 0, 0, 1],
      [6, 0, 0, 3],
      [6, 3, 3, 3],
      [4, 2, 2, 2],
      [6, 6, 6, 0],
      [9, 9, 6, 3],
      [12, 12, 6, 3],
      [24, 2, 2, 3],
      [500, 500, 6, 3],
    ];
    for (const [projects, pinned, flowers, trees] of cases) {
      for (const seed of sampledSeeds.slice(0, 20)) {
        const garden = generateWorld(seed, { ...counts, projects, pinned }).landmarks.find((l) => l.id === 'garden')!;
        const label = `${seed} ${projects}/${pinned}`;
        expect(garden.flowers, label).toHaveLength(flowers);
        expect(garden.trees, label).toHaveLength(trees);
        expect(garden.flowers.length + garden.trees.length, label).toBeLessThanOrEqual(Math.min(projects, 9));
        const { origin } = garden.footprint;
        const local = (c: { x: number; z: number }) => ({ x: c.x - origin.x, z: c.z - origin.z });
        // The bed is the 3×3 inside the fence; the back row is its north row, as the camera sees it.
        for (const c of garden.trees.map(local)) {
          expect(c.z, label).toBe(1);
          expect(c.x, label).toBeGreaterThanOrEqual(1);
          expect(c.x, label).toBeLessThanOrEqual(3);
        }
        for (const c of garden.flowers.map(local)) {
          expect([2, 3], label).toContain(c.z);
          expect(c.x, label).toBeGreaterThanOrEqual(1);
          expect(c.x, label).toBeLessThanOrEqual(3);
        }
        const all = [...garden.flowers, ...garden.trees].map(key);
        expect(new Set(all).size, label).toBe(all.length);
      }
    }
    for (const seed of sampledSeeds) {
      for (const l of worldFor(seed).landmarks) {
        if (l.id === 'garden') continue;
        expect(l.trees, `${seed} ${l.id}`).toEqual([]);
        expect(l.flowers, `${seed} ${l.id}`).toEqual([]);
      }
    }
  });

  /** A Service's place in the Station's group: its 2×2's min corner, local to the group's origin. */
  const localPlaces = (station: World['landmarks'][number]) =>
    station.services.map((s) => ({ x: s.cell.x - station.footprint.origin.x, z: s.cell.z - station.footprint.origin.z }));

  it('groups the Station on 6×6: the lighthouse in the middle, the first four Services on the sides (front first), the next four on the corners', () => {
    // The camera looks from the south-east: south and east are in front, north and west behind the lighthouse.
    const sides = [{ x: 2, z: 4 }, { x: 4, z: 2 }, { x: 2, z: 0 }, { x: 0, z: 2 }];
    const corners = [{ x: 4, z: 4 }, { x: 4, z: 0 }, { x: 0, z: 4 }, { x: 0, z: 0 }];
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `service-${i}`);
    for (const n of [0, 1, 4, 5, 8, 12]) {
      for (const seed of sampledSeeds.slice(0, 20)) {
        const station = generateWorld(seed, { ...counts, serviceIds: ids(n) }).landmarks.find((l) => l.id === 'station')!;
        const label = `${seed} ${n}`;
        expect([station.footprint.width, station.footprint.depth], label).toEqual([6, 6]);
        expect(localPlaces(station), label).toEqual([...sides, ...corners].slice(0, Math.min(n, 8)));
        // In content order: the first Services take the first places; more than 8 show only on /services.
        expect(station.services.map((s) => s.id), label).toEqual(ids(Math.min(n, 8)));
      }
    }
    // Without Service ids, the group is a lighthouse on open ground.
    const bare = generateWorld('harbour', { projects: 6, clients: 5, partners: 3 }).landmarks.find((l) => l.id === 'station')!;
    expect(bare.services).toEqual([]);
    for (const seed of sampledSeeds) {
      for (const l of worldFor(seed).landmarks) if (l.id !== 'station') expect(l.services, `${seed} ${l.id}`).toEqual([]);
    }
  });

  it('keeps the Station\'s layout whatever the Services: adding one never moves the group', () => {
    for (const seed of sampledSeeds.slice(0, 40)) {
      const of = (serviceIds: string[]) => generateWorld(seed, { ...counts, serviceIds }).landmarks.map((l) => [l.id, l.footprint.origin, l.y]);
      expect(of([]), seed).toEqual(of(SERVICE_IDS));
      expect(of(Array.from({ length: 8 }, (_, i) => `s-${i}`)), seed).toEqual(of(SERVICE_IDS));
    }
  });

  it('gives each Service the structure its id names, the same in every World', () => {
    // pipes and tanks for data engineering, a warehouse for data platforms, an observatory for analytics, a lab for machine learning.
    expect(SERVICE_KINDS).toEqual(['pipeline', 'warehouse', 'observatory', 'lab']);
    const kinds = (world: World) => world.landmarks.find((l) => l.id === 'station')!.services.map((s) => SERVICE_KINDS[s.kind - 1]);
    for (const seed of sampledSeeds.slice(0, 40)) expect(kinds(worldFor(seed)), seed).toEqual(['pipeline', 'warehouse', 'observatory', 'lab']);
    // Related ids name the same kind; any other id still gets one, from its id alone, wherever it stands in the list.
    const other = ['ml-ops', 'bi-dashboards', 'lakehouse-platform', 'etl-pipelines', 'consulting', 'training'];
    const first = kinds(generateWorld('harbour', { ...counts, serviceIds: other }));
    expect(first.slice(0, 4)).toEqual(['lab', 'observatory', 'warehouse', 'pipeline']);
    expect(first.every((k) => SERVICE_KINDS.includes(k!))).toBe(true);
    const reordered = kinds(generateWorld('seed-1', { ...counts, serviceIds: other.toReversed() }));
    expect(reordered).toEqual(first.toReversed());
  });

  it('keeps each plant in its place as Projects are added behind it', () => {
    const garden = (projects: number, pinned: number) => generateWorld('harbour', { ...counts, projects, pinned }).landmarks.find((l) => l.id === 'garden')!;
    const before = garden(2, 1);
    const after = garden(5, 2);
    expect(after.flowers.slice(0, 1).map((c) => [c.x - after.footprint.origin.x, c.z - after.footprint.origin.z])).toEqual(
      before.flowers.map((c) => [c.x - before.footprint.origin.x, c.z - before.footprint.origin.z]),
    );
    expect(after.trees.slice(0, 1).map((c) => [c.x - after.footprint.origin.x, c.z - after.footprint.origin.z])).toEqual(
      before.trees.map((c) => [c.x - before.footprint.origin.x, c.z - before.footprint.origin.z]),
    );
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

  it('never hides a Landmark behind another Landmark from the isometric camera', () => {
    for (const seed of sampledSeeds) {
      const { landmarks } = worldFor(seed);
      const hidden: string[] = [];
      const house = landmarks.find((l) => l.id === 'house')!;
      // Each Landmark's model as columns: the top it may reach over each cell it stands on.
      // The House stands on its plot's 3×3; the rest of the plot is yard, at ground level.
      const columns = (l: World['landmarks'][number]) => {
        const cells = l.id === 'house' ? l.footprint.cells.filter((c) => c.x - l.footprint.origin.x < HOUSE_CELLS && c.z - l.footprint.origin.z < HOUSE_CELLS) : coveredCells(l);
        // The Garden: its fence round the edge, flowers in the bed's front two rows and trees in its back row.
        const height = (c: { x: number; z: number }) => {
          if (l.id === 'station') {
            // The Station's group: the lighthouse's 2×2 in the middle, a Service's structure (or open ground) round it.
            const x = c.x - l.footprint.origin.x;
            const z = c.z - l.footprint.origin.z;
            return x >= 2 && x <= 3 && z >= 2 && z <= 3 ? LANDMARK_HEIGHT.station : SERVICE_HEIGHT;
          }
          if (l.id !== 'garden') return LANDMARK_HEIGHT[l.id];
          const x = c.x - l.footprint.origin.x;
          const z = c.z - l.footprint.origin.z;
          if (x < 1 || x > 3 || z < 1 || z > 3) return GARDEN_HEIGHT.fence;
          return z === 1 ? GARDEN_HEIGHT.tree : GARDEN_HEIGHT.flower;
        };
        return new Map(cells.map((c) => [key(c), l.y + height(c)] as const));
      };
      for (const target of landmarks) {
        for (const other of landmarks) {
          // The Mailbox stands in the House's own yard: part of its plot, not a Landmark in front of it.
          if (other === target || (target === house && other.id === 'mailbox')) continue;
          const tops = columns(other);
          const reach = Math.max(...tops.values());
          for (const c of coveredCells(target)) {
            for (let i = 0; i <= 4; i++) {
              for (let k = 0; k <= 4; k++) {
                // March the ray from the ground point towards the camera, (1, 1, 1).
                const px = c.x + i / 4;
                const pz = c.z + k / 4;
                for (let t = 0.001; target.y + t <= reach; t += 0.02) {
                  const top = tops.get(key({ x: Math.floor(px + t), z: Math.floor(pz + t) }));
                  if (top !== undefined && target.y + t < top) {
                    hidden.push(`${other.id} hides ${target.id} at ${px},${pz}`);
                    break;
                  }
                }
              }
            }
          }
        }
      }
      expect(hidden, seed).toEqual([]);
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

  it('frames every Isle, and every cell each Landmark covers, inside the Overview', () => {
    for (const seed of sampledSeeds) {
      const { views, landmarks, isles } = worldFor(seed);
      const { target, radius } = views.overview;
      for (const { id, bounds } of isles) {
        for (const x of [bounds.minX, bounds.maxX + 1]) expect(Math.abs(x - target.x), `${seed} Isle ${id}`).toBeLessThanOrEqual(radius);
        for (const z of [bounds.minZ, bounds.maxZ + 1]) expect(Math.abs(z - target.z), `${seed} Isle ${id}`).toBeLessThanOrEqual(radius);
      }
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

  it('shapes each Isle from a radius of 14–18 cells alone, 10–14 with one or two others, and 9–12 with three', () => {
    const ranges: Record<number, [number, number]> = { 1: [14, 18], 2: [10, 14], 3: [10, 14], 4: [9, 12] };
    for (const seed of sampledSeeds) {
      const { isles } = worldFor(seed);
      const [min, max] = ranges[isles.length]!;
      for (const isle of isles) {
        expect(isle.radius, `${seed} Isle ${isle.id}`).toBeGreaterThanOrEqual(min);
        expect(isle.radius, `${seed} Isle ${isle.id}`).toBeLessThanOrEqual(max);
        // The radius is the land's: noise moves the coast at most 30% of it in or out, so the
        // Isle is 1.4–2.6 radii across at its widest, and covers π(0.7r)² to π(1.3r)² cells.
        const across = Math.max(isle.bounds.maxX - isle.bounds.minX, isle.bounds.maxZ - isle.bounds.minZ) + 1;
        expect(across, `${seed} Isle ${isle.id}`).toBeGreaterThanOrEqual(1.4 * isle.radius);
        expect(across, `${seed} Isle ${isle.id}`).toBeLessThanOrEqual(2.6 * isle.radius + 1);
        expect(isle.cellCount, `${seed} Isle ${isle.id}`).toBeGreaterThanOrEqual(Math.PI * (0.7 * isle.radius) ** 2);
        expect(isle.cellCount, `${seed} Isle ${isle.id}`).toBeLessThanOrEqual(Math.PI * (1.3 * isle.radius) ** 2);
      }
    }
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
        // A one-cell bridge may run any of the four ways.
        const candidates = step ? [step] : SIDES.map(([sx, sz]) => ({ dx: sx, dz: sz }));
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
      for (const l of landmarks) if (l.id !== 'house' && l.id !== 'garden') expect(l.door, `${seed} ${l.id}`).toBeNull();
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

  it('picks each Landmark\'s Variant from its Biome\'s set, and every Variant occurs across sampled Seeds', () => {
    const seen = new Set<string>();
    for (const seed of sampledSeeds) {
      const world = worldFor(seed);
      for (const l of world.landmarks) {
        const count = LANDMARK_VARIANTS[world.biome.id][l.id];
        expect(Number.isInteger(l.variant), `${seed} ${l.id}`).toBe(true);
        expect(l.variant, `${seed} ${l.id}`).toBeGreaterThanOrEqual(1);
        expect(l.variant, `${seed} ${l.id}`).toBeLessThanOrEqual(count);
        seen.add(`${world.biome.id}/${l.id}/${l.variant}`);
      }
    }
    for (const biome of BIOME_IDS) {
      for (const id of PLACED) {
        const count = LANDMARK_VARIANTS[biome][id as keyof (typeof LANDMARK_VARIANTS)[typeof biome]];
        for (let v = 1; v <= count; v++) expect(seen.has(`${biome}/${id}/${v}`), `${biome}/${id}/${v}`).toBe(true);
      }
    }
  });

  it('gives 2–3 Variants to the House, Mailbox and Dock in every Biome, and one lighthouse to the Station', () => {
    for (const biome of BIOME_IDS) {
      for (const id of ['house', 'mailbox', 'dock'] as const) {
        expect(LANDMARK_VARIANTS[biome][id], `${biome} ${id}`).toBeGreaterThanOrEqual(2);
        expect(LANDMARK_VARIANTS[biome][id], `${biome} ${id}`).toBeLessThanOrEqual(3);
      }
      expect(LANDMARK_VARIANTS[biome].station, biome).toBe(1);
    }
  });

  it('keeps a Seed\'s Variants whatever the content counts, so a new Project never rebuilds the House', () => {
    for (const seed of sampledSeeds) {
      const variants = (w: World) => Object.fromEntries(w.landmarks.map((l) => [l.id, l.variant]));
      expect(variants(generateWorld(seed, { projects: 24, clients: 12, partners: 6 })), seed).toEqual(variants(worldFor(seed)));
    }
  });

  it('gives every World one wind direction, a unit vector across the ground, decided by the Seed alone', () => {
    const directions = new Set<string>();
    for (const seed of sampledSeeds) {
      const { wind } = worldFor(seed);
      expect(Math.hypot(wind.direction.x, wind.direction.z), seed).toBeCloseTo(1, 9);
      // The content counts never turn the wind.
      expect(generateWorld(seed, { projects: 24, clients: 12, partners: 6 }).wind, seed).toEqual(wind);
      directions.add(`${wind.direction.x.toFixed(2)},${wind.direction.z.toFixed(2)}`);
    }
    // Seeds blow every which way, not one fixed wind.
    expect(directions.size).toBeGreaterThan(sampledSeeds.length / 2);
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

  it('gives each Client its boat kind and each Partner its ship kind from its id, the same in every World', () => {
    const clientIds = ['copperleaf-grocers', 'harbourside-health', 'isles-ferry-line', 'meridian-ledger', 'northbank-paper', 'port-meridian-authority'];
    const partnerIds = ['cumulus-cloudworks', 'quarry-lakehouse', 'tessellate'];
    const ids = { ...counts, clients: clientIds.length, partners: partnerIds.length, clientIds, partnerIds };
    const first = generateWorld(sampledSeeds[0]!, ids);
    const boatKinds = first.boats.map((b) => b.kind);
    const shipKinds = first.ships.map((s) => s.kind);
    const biomes = new Set<string>();
    for (const seed of sampledSeeds.slice(0, 60)) {
      const world = generateWorld(seed, ids);
      biomes.add(world.biome.id);
      expect(world.boats.map((b) => b.kind), seed).toEqual(boatKinds);
      expect(world.ships.map((s) => s.kind), seed).toEqual(shipKinds);
    }
    expect([...biomes].sort()).toEqual([...BIOME_IDS].sort());
    // A Client keeps its kind when others join or leave: the kind follows the id, not the place in the list.
    const fewer = generateWorld(sampledSeeds[0]!, { ...ids, clients: 3, clientIds: clientIds.slice(3) });
    expect(fewer.boats.map((b) => b.kind)).toEqual(boatKinds.slice(3));
    expect(boatKinds.every((k) => k >= 1 && k <= BOAT_KINDS)).toBe(true);
    expect(shipKinds.every((k) => k >= 1 && k <= SHIP_KINDS)).toBe(true);
  });

  it('spreads kinds: over many ids, every boat kind and every ship kind is used', () => {
    const many = Array.from({ length: 40 }, (_, i) => `client-${i}`);
    const world = generateWorld('harbour', { ...counts, clients: 12, partners: 40, clientIds: many, partnerIds: many });
    expect(new Set(world.boats.map((b) => b.kind)).size).toBe(BOAT_KINDS);
    expect(new Set(world.ships.map((s) => s.kind)).size).toBe(SHIP_KINDS);
  });

  it('still gives every boat and ship a kind without ids (counts only)', () => {
    const world = generateWorld('harbour', counts);
    expect(world.boats.every((b) => b.kind >= 1 && b.kind <= BOAT_KINDS)).toBe(true);
    expect(world.ships.every((s) => s.kind >= 1 && s.kind <= SHIP_KINDS)).toBe(true);
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
        // At least two cells (Chebyshev) from every hazard: none in the 3×3 round each loop cell.
        const hazardSet = new Set(hazards.map(key));
        const tooClose = cells.filter((c) =>
          [-1, 0, 1].some((dz) => [-1, 0, 1].some((dx) => hazardSet.has(key({ x: c.x + dx, z: c.z + dz })))),
        );
        expect(tooClose.map(key), seed).toEqual([]);
      }
    }
  });

  it('sails every loop round the land: round the Isle when there is only one', () => {
    let single = 0;
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, partners: 4 });
      if (world.isles.length === 1) single++;
      // The loop keeps two cells off land (tested above) and each Isle is connected, so
      // a loop round one cell of an Isle goes round all of it: test one cell per Isle.
      const allLand = landCells(world);
      const land = world.isles.map((isle) => allLand.find((c) => c.owner === isle.id)!);
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
    // Coast noise scales with an Isle's radius, so larger Isles bulge further into the same 4–7 cell gaps.
    let checked = 0;
    let between = 0;
    for (const seed of sampledSeeds) {
      const world = generateWorld(seed, { ...counts, partners: 1 });
      if (!world.bridges.some((b) => b.cells.length >= 5)) continue;
      checked++;
      if (world.ships[0]!.cells.some((c) => inStrait(world, c))) between++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(between / checked).toBeGreaterThan(0.8);
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

  describe('Decoration', () => {
    const chebyshev = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

    it('places Decoration on every sampled World, and every kind occurs in every Biome', () => {
      const seen = new Map<string, Set<string>>();
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        expect(world.decoration.length, seed).toBeGreaterThan(5);
        const kinds = seen.get(world.biome.id) ?? new Set<string>();
        for (const d of world.decoration) kinds.add(d.kind);
        seen.set(world.biome.id, kinds);
      }
      for (const biome of BIOME_IDS) expect([...(seen.get(biome) ?? [])].toSorted(), biome).toEqual([...DECORATION_KINDS].toSorted());
    });

    it('stands one piece a cell on land, never on or beside a footprint or jetty, on a path, a bridge end or in the Garden', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, isle } = world.terrain;
        const cells = world.decoration.map((d) => key(d.cell));
        expect(new Set(cells).size, seed).toBe(cells.length);
        const path = new Set(world.paths.flatMap((p) => p.cells.map(key)));
        const bridgeEnds = new Set(
          world.bridges.flatMap((b) => b.cells.flatMap((c) => SIDES.map(([dx, dz]) => key({ x: c.x + dx, z: c.z + dz })))),
        );
        const covered = world.landmarks.flatMap(coveredCells);
        for (const d of world.decoration) {
          const at = `${seed} ${d.kind} ${key(d.cell)}`;
          expect(isle[d.cell.z * width + d.cell.x], at).not.toBe(-1);
          expect(path.has(key(d.cell)), at).toBe(false);
          expect(bridgeEnds.has(key(d.cell)), at).toBe(false);
          // The Garden is a footprint too, so this keeps Decoration out of it and off its fence.
          for (const c of covered) expect(chebyshev(c, d.cell), at).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('never stands taller than the nearest Landmark (by the Station, its nearest Service, not its lighthouse)', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        for (const d of world.decoration) {
          const centre = { x: d.cell.x + 0.5, z: d.cell.z + 0.5 };
          const distance = (l: World['landmarks'][number]) =>
            Math.min(...coveredCells(l).map((c) => Math.hypot(c.x + 0.5 - centre.x, c.z + 0.5 - centre.z)));
          const nearest = Math.min(...world.landmarks.map(distance));
          // The Station's group: what stands round its lighthouse is a Service's structure (or open ground), at least SERVICE_MIN_HEIGHT.
          const height = (l: World['landmarks'][number]) => (l.id === 'station' ? SERVICE_MIN_HEIGHT : LANDMARK_MIN_HEIGHT[l.id]);
          // Ties take the lowest of the nearest Landmarks.
          const cap = Math.min(...world.landmarks.filter((l) => distance(l) === nearest).map(height));
          expect(DECORATION_HEIGHT[d.kind], `${seed} ${d.kind} ${key(d.cell)}`).toBeLessThanOrEqual(cap);
        }
      }
    });

    it('never hides a Landmark from the isometric camera', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, heights } = world.terrain;
        const tops = new Map(world.decoration.map((d) => [key(d.cell), heights[d.cell.z * width + d.cell.x]! + DECORATION_HEIGHT[d.kind]] as const));
        const reach = Math.max(0, ...tops.values());
        const hidden: string[] = [];
        for (const l of world.landmarks) {
          for (const c of coveredCells(l)) {
            for (let i = 0; i <= 4; i++) {
              for (let k = 0; k <= 4; k++) {
                const px = c.x + i / 4;
                const pz = c.z + k / 4;
                for (let t = 0.001; l.y + t <= reach; t += 0.02) {
                  const top = tops.get(key({ x: Math.floor(px + t), z: Math.floor(pz + t) }));
                  if (top !== undefined && l.y + t < top) {
                    hidden.push(`${l.id} at ${px},${pz}`);
                    break;
                  }
                }
              }
            }
          }
        }
        expect(hidden, seed).toEqual([]);
      }
    });

    it('turns a minor building to face the camera (south or east), and keeps minor buildings two cells apart', () => {
      for (const seed of sampledSeeds) {
        const buildings = worldFor(seed).decoration.filter((d) => MINOR_BUILDINGS.includes(d.kind));
        buildings.forEach((b, n) => {
          expect(['south', 'east'], seed).toContain(b.facing);
          for (const other of buildings.slice(n + 1)) expect(chebyshev(b.cell, other.cell), seed).toBeGreaterThanOrEqual(3);
        });
      }
    });
  });

  describe('Particles', () => {
    it('gives each World spawn areas only for the particles its Biome has by Day or at Night, and each Biome all of its own', () => {
      const seen = new Map<string, Set<string>>();
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const sets = PARTICLE_SETS[world.biome.id];
        const out = new Set([...sets.day, ...sets.night]);
        for (const area of world.particles) expect(out.has(area.kind), `${seed} ${world.biome.id} ${area.kind}`).toBe(true);
        const kinds = seen.get(world.biome.id) ?? new Set<string>();
        for (const area of world.particles) kinds.add(area.kind);
        seen.set(world.biome.id, kinds);
      }
      for (const biome of BIOME_IDS) {
        const sets = PARTICLE_SETS[biome];
        expect([...(seen.get(biome) ?? [])].toSorted(), biome).toEqual([...new Set([...sets.day, ...sets.night])].toSorted());
      }
    });

    /** Every cell under an area's box. */
    const boxCells = (a: World['particles'][number]) => {
      const cells: Array<{ x: number; z: number }> = [];
      for (let z = Math.floor(a.centre.z - a.radius); z <= Math.floor(a.centre.z + a.radius); z++)
        for (let x = Math.floor(a.centre.x - a.radius); x <= Math.floor(a.centre.x + a.radius); x++) cells.push({ x, z });
      return cells;
    };

    it('is deterministic: the same Seed and counts give the same areas, on most Worlds of every Biome', () => {
      expect(generateWorld('harbour', counts).particles).toEqual(generateWorld('harbour', counts).particles);
      const withAreas = new Map<string, number>();
      const total = new Map<string, number>();
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        total.set(world.biome.id, (total.get(world.biome.id) ?? 0) + 1);
        const sets = PARTICLE_SETS[world.biome.id];
        // Every kind the Biome has, by Day and at Night, gets at least one area.
        const kinds = new Set(world.particles.map((a) => a.kind));
        if ([...sets.day, ...sets.night].every((k) => kinds.has(k))) withAreas.set(world.biome.id, (withAreas.get(world.biome.id) ?? 0) + 1);
      }
      for (const biome of BIOME_IDS) expect(withAreas.get(biome) ?? 0, biome).toBeGreaterThanOrEqual((total.get(biome) ?? 0) * 0.9);
    });

    it('keeps every area over land no higher than its ground: never a footprint, the jetty, a bridge or the sea, nor Decoration taller than its floor', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, depth, heights, isle } = world.terrain;
        const covered = new Set(world.landmarks.flatMap(coveredCells).map(key));
        const bridges = new Set(world.bridges.flatMap((b) => b.cells.map(key)));
        const decoration = new Map(world.decoration.map((d) => [key(d.cell), d.kind] as const));
        for (const area of world.particles) {
          const at = `${seed} ${area.kind} ${area.centre.x},${area.centre.z}`;
          expect(area.floor, at).toBeGreaterThan(area.ground);
          expect(area.top, at).toBeGreaterThan(area.floor);
          expect(heights[Math.floor(area.centre.z) * width + Math.floor(area.centre.x)], at).toBe(area.ground);
          for (const c of boxCells(area)) {
            expect(c.x >= 0 && c.z >= 0 && c.x < width && c.z < depth, at).toBe(true);
            const i = c.z * width + c.x;
            expect(isle[i], at).not.toBe(-1);
            expect(heights[i], at).toBeLessThanOrEqual(area.ground);
            expect(covered.has(key(c)), at).toBe(false);
            expect(bridges.has(key(c)), at).toBe(false);
            const kind = decoration.get(key(c));
            if (kind) expect(area.ground + DECORATION_HEIGHT[kind], at).toBeLessThanOrEqual(area.floor);
          }
        }
      }
    });

    it('never puts a particle between the camera and a Landmark', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        // The highest a particle may be over each cell: the top of every box over it.
        const tops = new Map<string, number>();
        for (const a of world.particles) for (const c of boxCells(a)) tops.set(key(c), Math.max(tops.get(key(c)) ?? -Infinity, a.top));
        const reach = Math.max(0, ...tops.values());
        const hidden: string[] = [];
        for (const l of world.landmarks) {
          for (const c of coveredCells(l)) {
            for (let i = 0; i <= 4; i++) {
              for (let k = 0; k <= 4; k++) {
                const px = c.x + i / 4;
                const pz = c.z + k / 4;
                for (let t = 0.001; l.y + t <= reach; t += 0.02) {
                  const top = tops.get(key({ x: Math.floor(px + t), z: Math.floor(pz + t) }));
                  if (top !== undefined && l.y + t < top) {
                    hidden.push(`${l.id} at ${px},${pz}`);
                    break;
                  }
                }
              }
            }
          }
        }
        expect(hidden, seed).toEqual([]);
      }
    });

    it('lets butterflies flutter round a flower clump (on it or next to it) and fireflies hang low over grass, all of it', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, surface } = world.terrain;
        const clumps = world.decoration.filter((d) => d.kind === 'clump').map((d) => d.cell);
        for (const area of world.particles) {
          const centre = key({ x: Math.floor(area.centre.x), z: Math.floor(area.centre.z) });
          const at = `${seed} ${area.kind} ${centre}`;
          const cell = { x: Math.floor(area.centre.x), z: Math.floor(area.centre.z) };
          if (area.kind === 'butterfly') expect(clumps.some((c) => Math.max(Math.abs(c.x - cell.x), Math.abs(c.z - cell.z)) <= 1), at).toBe(true);
          if (area.kind === 'firefly') {
            for (const c of boxCells(area)) expect(surface[c.z * width + c.x], at).toBe('grass');
            expect(area.top - area.ground, at).toBeLessThanOrEqual(1.25);
          }
        }
      }
    });

    it('follows the Biome × Day/Night table: butterflies by Day in the tropics, fireflies at Night, snow in the north, ash on volcanic Isles', () => {
      expect(PARTICLE_SETS).toEqual({
        tropical: { day: ['butterfly'], night: ['firefly'] },
        northern: { day: ['snow'], night: ['firefly', 'snow'] },
        autumn: { day: [], night: ['firefly'] },
        volcanic: { day: ['ash'], night: ['ash'] },
      });
    });
  });

  describe('Clouds', () => {
    /** Where a cloud's box corner is `u` (0–1) of the way through its drift. */
    const along = (c: World['clouds'][number], u: number) => ({ x: c.from.x + (c.to.x - c.from.x) * u, z: c.from.z + (c.to.z - c.from.z) * u });

    it('is deterministic: the same Seed and counts give the same clouds', () => {
      expect(generateWorld('harbour', counts).clouds).toEqual(generateWorld('harbour', counts).clouds);
      for (const seed of sampledSeeds.slice(0, 20)) expect(generateWorld(seed, counts).clouds, seed).toEqual(worldFor(seed).clouds);
    });

    it('gives nearly every World a few clouds, never more than the cap', () => {
      let few = 0;
      for (const seed of sampledSeeds) {
        const n = worldFor(seed).clouds.length;
        expect(n, seed).toBeLessThanOrEqual(MAX_CLOUDS);
        if (n >= 3) few++;
      }
      expect(few).toBeGreaterThanOrEqual(sampledSeeds.length * 0.9);
    });

    it('shapes each cloud as a mass of 1-unit voxels 3–8 long, 2–5 wide and 2–3 high, its long side down the wind', () => {
      for (const seed of sampledSeeds.slice(0, 60)) {
        const world = worldFor(seed);
        const { direction } = world.wind;
        for (const cloud of world.clouds) {
          const { size, voxels } = cloud;
          const long = Math.max(size.x, size.z);
          const short = Math.min(size.x, size.z);
          expect(long, seed).toBeGreaterThanOrEqual(3);
          expect(long, seed).toBeLessThanOrEqual(8);
          expect(short, seed).toBeGreaterThanOrEqual(2);
          expect(short, seed).toBeLessThanOrEqual(5);
          expect(size.y, seed).toBeGreaterThanOrEqual(2);
          expect(size.y, seed).toBeLessThanOrEqual(3);
          if (Math.abs(direction.x) > Math.abs(direction.z)) expect(size.x, seed).toBeGreaterThanOrEqual(size.z);
          else expect(size.z, seed).toBeGreaterThanOrEqual(size.x);
          // Whole voxels inside its box, one each, filling every layer of it, its underside the biggest.
          const keys = new Set(voxels.map((v) => `${v.x},${v.y},${v.z}`));
          expect(keys.size, seed).toBe(voxels.length);
          for (const v of voxels) {
            expect(Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z), seed).toBe(true);
            expect(v.x >= 0 && v.x < size.x && v.y >= 0 && v.y < size.y && v.z >= 0 && v.z < size.z, seed).toBe(true);
          }
          const layer = (y: number) => voxels.filter((v) => v.y === y).length;
          for (let y = 1; y < size.y; y++) {
            expect(layer(y), seed).toBeGreaterThan(0);
            expect(layer(y), seed).toBeLessThanOrEqual(layer(y - 1));
          }
          expect(Math.max(...voxels.map((v) => v.x)) + 1, seed).toBe(size.x);
          expect(Math.max(...voxels.map((v) => v.z)) + 1, seed).toBe(size.z);
        }
      }
    });

    it('drifts each cloud down the wind, higher than every Landmark, slowly', () => {
      for (const seed of sampledSeeds.slice(0, 60)) {
        const world = worldFor(seed);
        const { direction } = world.wind;
        const tallest = Math.max(...world.landmarks.map((l) => l.y + LANDMARK_HEIGHT[l.id]));
        for (const cloud of world.clouds) {
          const dx = cloud.to.x - cloud.from.x;
          const dz = cloud.to.z - cloud.from.z;
          const length = Math.hypot(dx, dz);
          expect(length, seed).toBeGreaterThan(4);
          // Along the wind, not against it.
          expect((dx * direction.x + dz * direction.z) / length, seed).toBeCloseTo(1, 6);
          expect(cloud.base, seed).toBeGreaterThanOrEqual(tallest + 2);
          const speed = length / cloud.period;
          expect(speed, seed).toBeGreaterThan(0.1);
          expect(speed, seed).toBeLessThan(0.6);
          expect(cloud.phase >= 0 && cloud.phase < 1, seed).toBe(true);
        }
      }
    });

    it('keeps every cloud over open sea all the way along its drift: never over an Isle, a bridge, the jetty or a boat, nor between the camera and one', () => {
      for (const seed of sampledSeeds.slice(0, 60)) {
        const world = worldFor(seed);
        const { width, depth, isle } = world.terrain;
        const kept = new Set([...world.bridges.flatMap((b) => b.cells), ...world.landmarks.flatMap((l) => l.jetty), ...world.boats.map((b) => b.cell)].map(key));
        const land = (x: number, z: number) => {
          const cx = Math.floor(x);
          const cz = Math.floor(z);
          return kept.has(key({ x: cx, z: cz })) || (cx >= 0 && cz >= 0 && cx < width && cz < depth && isle[cz * width + cx] !== -1);
        };
        const over: string[] = [];
        for (const cloud of world.clouds) {
          const top = cloud.base + cloud.size.y;
          // Each column of the cloud once.
          const columns = [...new Map(cloud.voxels.map((v) => [`${v.x},${v.z}`, v])).values()];
          for (let step = 0; step <= 20; step++) {
            const at = along(cloud, step / 20);
            for (const v of columns) {
              for (const [ox, oz] of [[0.02, 0.02], [0.98, 0.02], [0.02, 0.98], [0.98, 0.98], [0.5, 0.5]] as const) {
                // Straight down (s = 0), and down the camera's view ray (−1, −1, −1) from its top to the ground.
                for (let s = 0; s <= top; s += 0.5) {
                  const x = at.x + v.x + ox - s;
                  const z = at.z + v.z + oz - s;
                  if (land(x, z)) over.push(`cloud at ${at.x.toFixed(1)},${at.z.toFixed(1)} over ${x.toFixed(1)},${z.toFixed(1)}`);
                }
              }
            }
          }
        }
        expect(over.slice(0, 3), seed).toEqual([]);
      }
    });

    it('drifts where the Overview sees it: over the sea round the Isles, not far off', () => {
      for (const seed of sampledSeeds.slice(0, 60)) {
        const world = worldFor(seed);
        const { target, radius } = world.views.overview;
        for (const cloud of world.clouds) {
          // Where its middle is seen on the ground, half-way through its drift.
          const mid = along(cloud, 0.5);
          const lift = cloud.base + cloud.size.y / 2;
          const seen = { x: mid.x + cloud.size.x / 2 - lift, z: mid.z + cloud.size.z / 2 - lift };
          expect(Math.hypot(seen.x - target.x, seen.z - target.z), seed).toBeLessThan(radius * 1.6);
        }
      }
    });
  });

  describe('Fish', () => {
    /** Every cell under a school's square of water. */
    const schoolCells = (s: World['fish'][number]) => {
      const cells: Array<{ x: number; z: number }> = [];
      for (let z = Math.floor(s.centre.z - s.radius); z < Math.ceil(s.centre.z + s.radius); z++)
        for (let x = Math.floor(s.centre.x - s.radius); x < Math.ceil(s.centre.x + s.radius); x++) cells.push({ x, z });
      return cells;
    };

    it('is deterministic: the same Seed and counts give the same schools', () => {
      expect(generateWorld('harbour', counts).fish).toEqual(generateWorld('harbour', counts).fish);
      for (const seed of sampledSeeds.slice(0, 20)) expect(generateWorld(seed, counts).fish, seed).toEqual(worldFor(seed).fish);
    });

    it('gives nearly every World a few schools of 3–5 fish, never more than the cap', () => {
      let some = 0;
      for (const seed of sampledSeeds) {
        const { fish } = worldFor(seed);
        expect(fish.length, seed).toBeLessThanOrEqual(MAX_SCHOOLS);
        if (fish.length >= 2) some++;
        for (const school of fish) {
          expect(school.size, seed).toBeGreaterThanOrEqual(3);
          expect(school.size, seed).toBeLessThanOrEqual(5);
          expect(school.radius, seed).toBe(FISH_AREA);
        }
      }
      expect(some).toBeGreaterThanOrEqual(sampledSeeds.length * 0.9);
    });

    it('keeps every school in shallow water: each cell under it is sea within 2 cells of the land', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, depth, isle } = world.terrain;
        const land = (x: number, z: number) => x >= 0 && z >= 0 && x < width && z < depth && isle[z * width + x] !== -1;
        for (const school of world.fish) {
          for (const c of schoolCells(school)) {
            expect(c.x >= 0 && c.z >= 0 && c.x < width && c.z < depth, `${seed} ${c.x},${c.z}`).toBe(true);
            expect(land(c.x, c.z), `${seed} ${c.x},${c.z} is land`).toBe(false);
            // An independent measure: some land cell within 2 cells, centre to centre.
            let near = false;
            for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= 2 && land(c.x + dx, c.z + dz)) near = true;
            expect(near, `${seed} ${c.x},${c.z} is out of the shallows`).toBe(true);
          }
        }
      }
    });

    it('keeps schools off and clear of the jetty and the moored boats, off bridges, buoys and the ships\' loops, and apart', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const key = (c: { x: number; z: number }) => `${c.x},${c.z}`;
        const near = (cells: Array<{ x: number; z: number }>) => cells.flatMap((c) => [-1, 0, 1].flatMap((dz) => [-1, 0, 1].map((dx) => key({ x: c.x + dx, z: c.z + dz }))));
        const banned = new Set([
          ...near([...world.landmarks.flatMap((l) => l.jetty), ...world.boats.map((b) => b.cell)]),
          ...world.bridges.flatMap((b) => b.cells).map(key),
          ...world.buoys.map(key),
          ...world.ships.flatMap((s) => s.cells).map(key),
        ]);
        for (const school of world.fish) for (const c of schoolCells(school)) expect(banned.has(key(c)), `${seed} ${key(c)}`).toBe(false);
        for (const [i, a] of world.fish.entries())
          for (const b of world.fish.slice(i + 1)) expect(Math.hypot(a.centre.x - b.centre.x, a.centre.z - b.centre.z), seed).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('Land animals', () => {
    const chebyshev = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    const neighbours = (c: { x: number; z: number }) => [-1, 0, 1].flatMap((dz) => [-1, 0, 1].map((dx) => ({ x: c.x + dx, z: c.z + dz })));

    it('is deterministic: the same Seed and counts give the same animals', () => {
      expect(generateWorld('harbour', counts).animals).toEqual(generateWorld('harbour', counts).animals);
      for (const seed of sampledSeeds.slice(0, 20)) expect(generateWorld(seed, counts).animals, seed).toEqual(worldFor(seed).animals);
    });

    it('gives nearly every World a few animals of its Biome\'s species, never more than 3 an Isle', () => {
      let some = 0;
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        if (world.animals.length >= 2) some++;
        for (const isle of world.isles) expect(world.animals.filter((a) => a.isle === isle.id).length, seed).toBeLessThanOrEqual(3);
        for (const a of world.animals) expect(a.species, seed).toBe(ANIMAL_SPECIES[world.biome.id]);
      }
      expect(MAX_ANIMALS_PER_ISLE).toBe(3);
      expect(some).toBeGreaterThanOrEqual(sampledSeeds.length * 0.9);
    });

    it('starts each route at its rest point and walks 2–5 steps to neighbouring cells, never back on itself, on level land of its Isle', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, heights, isle } = world.terrain;
        for (const a of world.animals) {
          expect(a.route[0], seed).toEqual(a.rest);
          expect(a.route.length, seed).toBeGreaterThanOrEqual(3);
          expect(a.route.length, seed).toBeLessThanOrEqual(6);
          expect(new Set(a.route.map(key)).size, seed).toBe(a.route.length);
          for (const [i, c] of a.route.entries()) {
            expect(isle[c.z * width + c.x], `${seed} ${key(c)}`).toBe(a.isle);
            expect(heights[c.z * width + c.x], `${seed} ${key(c)}`).toBe(a.y);
            if (i > 0) expect(Math.abs(c.x - a.route[i - 1]!.x) + Math.abs(c.z - a.route[i - 1]!.z), seed).toBe(1);
          }
        }
      }
    });

    it('keeps every route off and clear of footprints and the jetty (so out of the Garden), off paths, bridges and their ends, and clear of everything but grass and clumps', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, heights, isle } = world.terrain;
        const path = new Set(world.paths.flatMap((p) => p.cells.map(key)));
        const bridge = new Set(world.bridges.flatMap((b) => b.cells.flatMap((c) => [c, ...SIDES.map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz }))]).map(key)));
        const covered = world.landmarks.flatMap(coveredCells);
        const standing = new Map(world.decoration.map((d) => [key(d.cell), d.kind as string] as const));
        for (const a of world.animals) {
          for (const c of a.route) {
            const at = `${seed} ${key(c)}`;
            expect(path.has(key(c)), at).toBe(false);
            expect(bridge.has(key(c)), at).toBe(false);
            for (const f of covered) expect(chebyshev(f, c), at).toBeGreaterThanOrEqual(2);
            // Nothing on the cell or beside it but grass and flower clumps; no wall or drop to the sea beside it, and no step down next to an animal that overhangs its cell.
            for (const n of neighbours(c)) {
              expect(['grass', 'clump', undefined], at).toContain(standing.get(key(n)));
              expect(isle[n.z * width + n.x], at).not.toBe(-1);
              expect(heights[n.z * width + n.x], at).toBeLessThanOrEqual(a.y);
              if (ANIMAL_REACH[a.species] > 0.5 && (n.x === c.x || n.z === c.z)) expect(heights[n.z * width + n.x], at).toBe(a.y);
            }
          }
        }
      }
    });

    it('keeps animals apart: no two routes share a cell or touch', () => {
      for (const seed of sampledSeeds) {
        const { animals } = worldFor(seed);
        for (const [i, a] of animals.entries())
          for (const b of animals.slice(i + 1)) for (const c of a.route) for (const d of b.route) expect(chebyshev(c, d), seed).toBeGreaterThanOrEqual(2);
      }
    });

    it('never puts an animal between the camera and a Landmark, anywhere along its route', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const tall = ANIMAL_HEIGHT[world.animals[0]?.species ?? 'deer'];
        // An animal's body may reach over the cells beside its route.
        const tops = new Map<string, number>();
        for (const a of world.animals) for (const c of a.route) for (const n of neighbours(c)) tops.set(key(n), a.y + tall);
        const reach = Math.max(0, ...tops.values());
        const hidden: string[] = [];
        for (const l of world.landmarks) {
          for (const c of coveredCells(l)) {
            for (let i = 0; i <= 4; i++) {
              for (let k = 0; k <= 4; k++) {
                const px = c.x + i / 4;
                const pz = c.z + k / 4;
                for (let t = 0.001; l.y + t <= reach; t += 0.02) {
                  const top = tops.get(key({ x: Math.floor(px + t), z: Math.floor(pz + t) }));
                  if (top !== undefined && l.y + t < top) {
                    hidden.push(`${l.id} at ${px},${pz}`);
                    break;
                  }
                }
              }
            }
          }
        }
        expect(hidden, seed).toEqual([]);
      }
    });

    it('follows the Biome × Day/Night table: a land animal by Day in every Biome, seabirds or gulls by Day, bats at Night', () => {
      expect(ANIMAL_SPECIES).toEqual({ tropical: 'junglefowl', northern: 'deer', autumn: 'squirrel', volcanic: 'goat' });
      expect(CREATURE_SETS).toEqual({
        tropical: { day: ['animal', 'bird'], night: [] },
        northern: { day: ['animal', 'bird'], night: [] },
        autumn: { day: ['animal'], night: ['bat'] },
        volcanic: { day: ['animal'], night: ['bat'] },
      });
    });
  });

  describe('Birds', () => {
    /** Where a bird is `a` radians round its circle. */
    const at = (b: World['birds'][number], a: number) => ({ x: b.centre.x + b.radius * Math.cos(a), z: b.centre.z + b.radius * Math.sin(a) });

    it('is deterministic: the same Seed and counts give the same birds', () => {
      expect(generateWorld('harbour', counts).birds).toEqual(generateWorld('harbour', counts).birds);
      for (const seed of sampledSeeds.slice(0, 20)) expect(generateWorld(seed, counts).birds, seed).toEqual(worldFor(seed).birds);
    });

    it('gives nearly every World a few birds (or bats) of its Biome, never more than the cap', () => {
      let some = 0;
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        expect(world.birds.length, seed).toBeLessThanOrEqual(MAX_BIRDS);
        if (world.birds.length >= 2) some++;
        const sets = CREATURE_SETS[world.biome.id];
        for (const b of world.birds) expect([...sets.day, ...sets.night], seed).toContain(b.kind);
      }
      expect(some).toBeGreaterThanOrEqual(sampledSeeds.length * 0.9);
    });

    it('circles each bird over an Isle, 1.5–3 units round, higher than every Landmark and lower than every cloud', () => {
      for (const seed of sampledSeeds) {
        const world = worldFor(seed);
        const { width, depth, isle } = world.terrain;
        const tallest = Math.max(...world.landmarks.map((l) => l.y + LANDMARK_HEIGHT[l.id]));
        for (const b of world.birds) {
          const cx = Math.floor(b.centre.x);
          const cz = Math.floor(b.centre.z);
          expect(cx >= 0 && cz >= 0 && cx < width && cz < depth && isle[cz * width + cx] !== -1, `${seed} centre over land`).toBe(true);
          expect(b.radius, seed).toBeGreaterThanOrEqual(1.5);
          expect(b.radius, seed).toBeLessThanOrEqual(3);
          expect(b.height - BIRD_BELOW, seed).toBeGreaterThan(tallest);
          expect(b.height + BIRD_ABOVE, seed).toBeLessThan(tallest + 2);
          for (const c of world.clouds) expect(b.height + BIRD_ABOVE, seed).toBeLessThan(c.base);
          expect(Math.abs(b.turn), seed).toBeGreaterThan(0);
        }
      }
    });

    it('never flies through the camera\'s view of a Landmark, all the way round its circle', () => {
      // A coarser march than the generator's check, on a fifth of the Seeds: it is slow.
      for (const seed of sampledSeeds.slice(0, 40)) {
        const world = worldFor(seed);
        const hidden: string[] = [];
        for (const b of world.birds) {
          for (let s = 0; s < 24; s++) {
            const p = at(b, (s / 24) * 2 * Math.PI);
            for (const l of world.landmarks) {
              const top = l.y + LANDMARK_HEIGHT[l.id];
              for (const c of coveredCells(l)) {
                for (let i = 0; i <= 2; i++) {
                  for (let k = 0; k <= 2; k++) {
                    for (let y = l.y; y <= top; y += 0.5) {
                      // The ray from this point of the Landmark climbs (1, 1, 1): it is level with the bird's body for t in [lo, hi].
                      const lo = b.height - BIRD_BELOW - y;
                      const hi = b.height + BIRD_ABOVE - y;
                      const px = c.x + i / 2;
                      const pz = c.z + k / 2;
                      for (let t = Math.max(0, lo); t <= hi; t += 0.1) {
                        if (Math.abs(px + t - p.x) < BIRD_REACH && Math.abs(pz + t - p.z) < BIRD_REACH) {
                          hidden.push(`${l.id} from ${px},${y},${pz}`);
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        expect(hidden.slice(0, 3), seed).toEqual([]);
      }
    });
  });
});
