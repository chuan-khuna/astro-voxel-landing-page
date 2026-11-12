import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { bakeBlockLight, floodLight } from './blockLight';
import { lightSources } from './lightSources';

/** An open box of air 9×5×9, with optional solid cells. */
const box = (solid: (x: number, y: number, z: number) => boolean = () => false) => ({ width: 9, height: 5, depth: 9, solid });

describe('floodLight', () => {
  it('falls one level per cell away from a source, in steps along the axes', () => {
    const { level, at } = floodLight(box(), [{ x: 4, y: 2, z: 4, level: 4 }]);
    expect(level[at(4, 2, 4)]).toBe(4);
    expect(level[at(5, 2, 4)]).toBe(3);
    expect(level[at(4, 2, 2)]).toBe(2);
    expect(level[at(5, 3, 5)]).toBe(1);
    expect(level[at(4, 2, 0)]).toBe(0);
    expect(level[at(8, 2, 8)]).toBe(0);
  });

  it('is stopped by solid cells: light goes round a wall, never through it', () => {
    // A wall across x = 5, two cells high (y 0–1), from z = 0 to 8; the source is at y = 0.
    const wall = (x: number, y: number) => x === 5 && y <= 1;
    const { level, at } = floodLight(box(wall), [{ x: 4, y: 0, z: 4, level: 5 }]);
    expect(level[at(5, 0, 4)]).toBe(0);
    expect(level[at(5, 1, 4)]).toBe(0);
    // Over the top: up two, across, down two from the far side.
    expect(level[at(5, 2, 4)]).toBe(2);
    expect(level[at(6, 0, 4)]).toBe(0);
    expect(level[at(6, 1, 4)]).toBe(0);
    expect(level[at(6, 2, 4)]).toBe(1);
  });

  it('takes the brighter level where two sources overlap, and remembers which source that is', () => {
    const { level, source, at } = floodLight(box(), [
      { x: 1, y: 2, z: 4, level: 5 },
      { x: 6, y: 2, z: 4, level: 3 },
    ]);
    expect(level[at(4, 2, 4)]).toBe(2); // 5 − 3 beats 3 − 2
    expect(source[at(4, 2, 4)]).toBe(0);
    expect(level[at(6, 2, 4)]).toBe(3);
    expect(source[at(6, 2, 4)]).toBe(1);
    expect(level[at(7, 2, 4)]).toBe(2);
    expect(source[at(7, 2, 4)]).toBe(1);
  });

  it('lights nothing from a source inside a solid cell or outside the box', () => {
    const { level } = floodLight(box((x, y, z) => x === 4 && y === 2 && z === 4), [
      { x: 4, y: 2, z: 4, level: 4 },
      { x: -3, y: 2, z: 4, level: 4 },
    ]);
    expect(level.every((l) => l === 0)).toBe(true);
  });
});

describe('bakeBlockLight', () => {
  const counts = { projects: 6, clients: 5, partners: 3, serviceIds: ['data-engineering', 'analytics'] };
  const worlds = ['lighthouse', 'seed-1', 'seed-2', 'seed-3', '42'].map((seed) => generateWorld(seed, counts));

  it('lights the air over every torch with a warm light, and none reaches the sky', () => {
    for (const world of worlds) {
      const light = bakeBlockLight(world);
      const { width, height, depth, data } = light;
      expect(data.length).toBe(width * height * depth * 4);
      for (const torch of world.torches) {
        const c = torch.cell.x + width * (Math.floor(torch.y) + height * torch.cell.z);
        // Red over blue: a warm light.
        expect(data[c * 4]!, `${world.seed} ${torch.by}`).toBeGreaterThan(40);
        expect(data[c * 4]!).toBeGreaterThan(data[c * 4 + 2]!);
      }
      // The top layer is open sky: no light reaches it.
      for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) expect(data[(x + width * (height - 1 + height * z)) * 4]).toBe(0);
    }
  });

  it('counts every torch, the House\'s room and windows and every buoy as Light Sources', () => {
    for (const world of worlds) {
      const sources = lightSources(world);
      expect(sources.length, world.seed).toBeGreaterThanOrEqual(world.torches.length + world.buoys.length + 2);
      expect(sources.filter((s) => s.colour === 'buoy')).toHaveLength(world.buoys.length);
      expect(sources.filter((s) => s.colour === 'window').length, world.seed).toBeGreaterThan(0);
      for (const torch of world.torches) {
        expect(sources.some((s) => Math.floor(s.x) === torch.cell.x && Math.floor(s.z) === torch.cell.z && s.y > torch.y), `${world.seed} ${torch.by}`).toBe(true);
      }
    }
  });
});
