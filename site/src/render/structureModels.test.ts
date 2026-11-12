import { describe, expect, it } from 'vitest';
import { BIOME_IDS, LIGHTHOUSE_CELL, SERVICE_KINDS, generateWorld, houseYard, type World } from '@/world';
import { structureVoxels } from '@/structures/parse';
import { drawStructure, housePlacement, houseStructure, houseWindowFaces, landmarkPlacement, landmarkStructure, serviceStructure, stationGroup, turned } from './structureModels';
import { worldColours, worldToVoxels } from './worldVoxels';
import { GROUND_DETAIL, STRUCTURE } from './voxelTiers';

const counts = { projects: 6, clients: 3, partners: 2, serviceIds: ['data-engineering', 'data-platforms', 'analytics', 'machine-learning', 'ml-ops'] };
const worlds = Array.from({ length: 40 }, (_, i) => generateWorld(`house-${i}`, counts));
const houseOf = (world: World) => world.landmarks.find((l) => l.id === 'house')!;

describe('the House in the World', () => {
  it('draws its Biome\'s House Variant', () => {
    for (const world of worlds) {
      const s = houseStructure(world);
      expect(s.kind).toBe('house');
      expect(s.biome).toBe(world.biome.id);
    }
  });

  it('meshes only its base in the World\'s ⅛-unit structure grid, inside the House\'s 3×3 and on its ground', () => {
    for (const world of worlds) {
      const { structure } = worldToVoxels(world);
      const house = houseOf(world);
      const base = [...structureVoxels(houseStructure(world))].filter((v) => v.part === 'base');
      expect(structure.size).toBe(1 / STRUCTURE);
      // The House's 3×3 holds its base, nothing else (the Mailbox stands in the yard; the room is drawn at 1/16 unit apart).
      const { origin } = houseYard(house).house;
      const inHouse = [...structure.voxels()].filter((v) => {
        const dx = Math.floor(v.x / STRUCTURE) - origin.x;
        const dz = Math.floor(v.z / STRUCTURE) - origin.z;
        return dx >= 0 && dx < 3 && dz >= 0 && dz < 3;
      });
      expect(inHouse.length, world.seed).toBe(base.length);
      for (const v of inHouse) expect(v.y, world.seed).toBeGreaterThanOrEqual(house.y * STRUCTURE);
    }
  });

  it('turns the door to face the House\'s way, onto the yard cell in front of it', () => {
    const seen = new Set<string>();
    for (const world of worlds) {
      const house = houseOf(world);
      seen.add(house.door!);
      const s = houseStructure(world);
      const at = housePlacement(house);
      // The door: a 4×10 opening in the middle of the front wall's outer layer, as drawn (+z).
      const door = [...structureVoxels(s)].filter((v) => v.x >= 10 && v.x < 14 && v.y >= 2 && v.y < 12 && v.z === s.size.z - 3);
      expect(door.length, world.seed).toBe(40);
      const yard = houseYard(house).door;
      const inside = house.door === 'south' ? { x: yard.x, z: yard.z - 1 } : { x: yard.x - 1, z: yard.z };
      for (const v of door) {
        const p = turned(s, v, at.facing);
        expect({ x: Math.floor((at.x + p.x) / STRUCTURE), z: Math.floor((at.z + p.z) / STRUCTURE) }, world.seed).toEqual(inside);
      }
    }
    expect([...seen].toSorted()).toEqual(['east', 'south']);
  });

  it('lights each window on an open face towards +x or +z: out of the front walls, into the room from the back walls', () => {
    for (const world of worlds.slice(0, 8)) {
      const faces = houseWindowFaces(world);
      expect(faces.some((f) => f.part === 'lid'), world.seed).toBe(true);
      expect(faces.some((f) => f.part === 'base'), world.seed).toBe(true);
      const filled = new Set<string>();
      const { structure } = worldToVoxels(world);
      for (const v of structure.voxels()) filled.add(`${v.x},${v.y},${v.z}`);
      for (const f of faces) {
        const front = f.facing === '+x' ? `${f.x + 1},${f.y},${f.z}` : `${f.x},${f.y},${f.z + 1}`;
        expect(filled.has(front), `${world.seed} ${front}`).toBe(false);
      }
    }
  });
});

describe('the Landmark Variants in the World', () => {
  const placed = (world: World) => world.landmarks;

  it('draws each Landmark\'s own Variant, from the World\'s Biome', () => {
    const seen = new Set<string>();
    for (const world of worlds) {
      for (const l of placed(world)) {
        const s = landmarkStructure(world, l);
        expect([s.kind, s.biome, s.variant], `${world.seed} ${l.id}`).toEqual([l.id, world.biome.id, l.variant]);
        seen.add(`${l.id}/${l.variant}`);
      }
    }
    // Across the sampled Worlds, more than one Variant of each shows (the Station has one lighthouse a Biome).
    for (const id of ['house', 'mailbox', 'dock']) expect([...seen].filter((k) => k.startsWith(`${id}/`)).length, id).toBeGreaterThan(1);
  });

  it('meshes every Landmark\'s structure in the World\'s ⅛-unit grid, filling its footprint on its ground (the House\'s lid and the Garden\'s bed apart)', () => {
    for (const world of worlds.slice(0, 12)) {
      const { structure } = worldToVoxels(world);
      const cells = new Map<string, number>();
      for (const v of structure.voxels()) {
        const key = `${Math.floor(v.x / STRUCTURE)},${Math.floor(v.z / STRUCTURE)}`;
        cells.set(key, Math.min(cells.get(key) ?? Infinity, v.y));
      }
      for (const l of placed(world)) {
        if (l.id === 'station') continue;
        const ground = l.id === 'house' ? houseYard(l).house : l.footprint;
        for (let z = 0; z < ground.depth; z++) {
          for (let x = 0; x < ground.width; x++) {
            // The Garden's bed holds its plants, which are instanced, not in the grid.
            if (l.id === 'garden' && x >= 1 && x <= 3 && z >= 1 && z <= 3) continue;
            const key = `${ground.origin.x + x},${ground.origin.z + z}`;
            expect(cells.has(key), `${world.seed} ${l.id} ${key}`).toBe(true);
            expect(cells.get(key), `${world.seed} ${l.id} ${key}`).toBeGreaterThanOrEqual(l.y * STRUCTURE);
          }
        }
      }
      // Nothing outside the footprints.
      const inside = new Set(placed(world).flatMap((l) => l.footprint.cells.map((c) => `${c.x},${c.z}`)));
      for (const key of cells.keys()) expect(inside.has(key), `${world.seed} ${key}`).toBe(true);
    }
  });

  it('stands the Station\'s lighthouse in the middle of its group and each Service\'s structure on its place, leaving empty places open ground', () => {
    for (const world of worlds.slice(0, 12)) {
      const station = world.landmarks.find((l) => l.id === 'station')!;
      const { origin } = station.footprint;
      const { structure } = worldToVoxels(world);
      // Every structure voxel in each 2×2 place of the group, by place.
      const byPlace = new Map<string, Array<{ x: number; y: number; z: number }>>();
      for (const v of structure.voxels()) {
        const dx = Math.floor(v.x / STRUCTURE) - origin.x;
        const dz = Math.floor(v.z / STRUCTURE) - origin.z;
        if (dx < 0 || dz < 0 || dx >= 6 || dz >= 6) continue;
        const place = `${dx - (dx % 2)},${dz - (dz % 2)}`;
        byPlace.set(place, [...(byPlace.get(place) ?? []), v]);
      }
      const lighthouse = landmarkStructure(world, station);
      expect(lighthouse.kind).toBe('station');
      expect(byPlace.get(`${LIGHTHOUSE_CELL.x},${LIGHTHOUSE_CELL.z}`)?.length, world.seed).toBe([...structureVoxels(lighthouse)].length);
      expect(station.services, world.seed).toHaveLength(5);
      for (const service of station.services) {
        const s = serviceStructure(world.biome.id, service.kind);
        expect([s.kind, s.biome, s.variant], `${world.seed} ${service.id}`).toEqual(['service', world.biome.id, service.kind]);
        const place = `${service.cell.x - origin.x},${service.cell.z - origin.z}`;
        const voxels = byPlace.get(place) ?? [];
        expect(voxels.length, `${world.seed} ${service.id}`).toBe([...structureVoxels(s)].length);
        for (const v of voxels) expect(v.y, `${world.seed} ${service.id}`).toBeGreaterThanOrEqual(station.y * STRUCTURE);
      }
      // Three places stand empty: open ground.
      expect(byPlace.size, world.seed).toBe(1 + 5);
    }
    // Each kind shows across the sampled Worlds' Services.
    const kinds = new Set(worlds.flatMap((w) => w.landmarks.find((l) => l.id === 'station')!.services.map((s) => s.kind)));
    expect(kinds.size).toBe(SERVICE_KINDS.length);
  });

  it('builds the Model Gallery\'s Station group: 6×6, the lighthouse in the middle and one Service of each kind on the sides', () => {
    for (const biome of BIOME_IDS) {
      const group = stationGroup(biome);
      expect(group.footprint, biome).toEqual({ width: 6, depth: 6 });
      const count = (s: { voxels: Uint8Array }) => s.voxels.filter((v) => v !== 0).length;
      const lighthouse = landmarkStructure({ biome: { id: biome } as World['biome'] }, { id: 'station', variant: 1 } as World['landmarks'][number]);
      const services = SERVICE_KINDS.map((_, k) => serviceStructure(biome, k + 1));
      expect(count(group), biome).toBe(count(lighthouse) + services.reduce((sum, s) => sum + count(s), 0));
      expect(group.size.y, biome).toBe(lighthouse.size.y);
    }
  });

  it('turns the Mailbox\'s front the way the House\'s door faces, and lays the Dock along its footprint', () => {
    for (const world of worlds) {
      const house = houseOf(world);
      const mailbox = world.landmarks.find((l) => l.id === 'mailbox')!;
      const dock = world.landmarks.find((l) => l.id === 'dock')!;
      expect(landmarkPlacement(world, mailbox).facing, world.seed).toBe(house.door);
      expect(landmarkPlacement(world, dock).facing, world.seed).toBe(dock.footprint.width === 2 ? 'south' : 'east');
    }
  });

  it('stands the Dock\'s things on top of its ¼-unit deck', () => {
    for (const world of worlds) {
      const dock = world.landmarks.find((l) => l.id === 'dock')!;
      const s = landmarkStructure(world, dock);
      let lowest = Infinity;
      drawStructure(s, landmarkPlacement(world, dock), worldColours(world), (_x, y) => (lowest = Math.min(lowest, y)));
      expect(lowest, world.seed).toBe(dock.y * STRUCTURE + STRUCTURE / GROUND_DETAIL);
    }
  });
});
