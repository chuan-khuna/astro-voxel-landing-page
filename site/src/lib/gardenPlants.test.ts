import { describe, expect, it } from 'vitest';
import { generateWorld } from '@/world';
import { gardenCountsOf, gardenPlants, projectOrder } from './gardenPlants';

interface P {
  id: string;
  pinned?: boolean;
}
const ids = (n: number, prefix = 'project') => Array.from({ length: n }, (_, k) => `${prefix}-${String(k).padStart(3, '0')}`);
const projectsOf = (plain: number, pinned = 0): P[] => [...ids(plain).map((id) => ({ id })), ...ids(pinned, 'pinned').map((id) => ({ id, pinned: true }))];
const worldFor = (seed: string, projects: readonly P[]) => generateWorld(seed, { ...gardenCountsOf(projects), clients: 0, partners: 0 });

describe('projectOrder', () => {
  it('lists Pinned Projects first, then the rest, each by id, whatever order they come in', () => {
    const projects = [{ id: 'tide-tables' }, { id: 'zebra', pinned: true }, { id: 'archive-search' }, { id: 'mill-sensors', pinned: true }];
    expect(projectOrder(projects).map((p) => p.id)).toEqual(['mill-sensors', 'zebra', 'archive-search', 'tide-tables']);
    // The input is left alone.
    expect(projects[0]!.id).toBe('tide-tables');
  });

  it('reads a content entry\'s `data.pinned`, too', () => {
    const entries = [{ id: 'b', data: {} }, { id: 'c', data: { pinned: true } }, { id: 'a', data: { pinned: false } }];
    expect(projectOrder(entries).map((p) => p.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('gardenPlants', () => {
  it('blooms min(pinned, 6) flowers, and grows at most 3 trees, at most min(Projects, 9) plants in all', () => {
    for (const seed of ['lighthouse', 'harbour', '42']) {
      for (const [plain, pinned] of [[0, 0], [1, 0], [0, 1], [6, 0], [3, 3], [2, 5], [0, 6], [0, 7], [4, 9], [30, 30]] as const) {
        const plants = gardenPlants(worldFor(seed, projectsOf(plain, pinned)), projectsOf(plain, pinned));
        const label = `${seed} ${plain}+${pinned}`;
        expect(plants.filter((p) => p.kind === 'flower'), label).toHaveLength(Math.min(pinned, 6));
        expect(plants.filter((p) => p.kind === 'tree').length, label).toBeLessThanOrEqual(3);
        expect(plants.length, label).toBeLessThanOrEqual(Math.min(plain + pinned, 9));
      }
    }
  });

  it('handles 0 Projects: an empty Garden', () => {
    expect(gardenPlants(worldFor('lighthouse', []), [])).toEqual([]);
  });

  it('handles every Project pinned: six flowers, then the next three Pinned Projects as trees', () => {
    const projects = projectsOf(0, 12);
    const plants = gardenPlants(worldFor('harbour', projects), projects);
    expect(plants.map((p) => [p.projectId, p.kind])).toEqual([
      ...ids(6, 'pinned').map((id) => [id, 'flower']),
      ...ids(9, 'pinned').slice(6).map((id) => [id, 'tree']),
    ]);
  });

  it('pairs Pinned Projects with flowers and the others with trees, by id, on the World\'s cells', () => {
    const projects: P[] = [{ id: 'f' }, { id: 'b', pinned: true }, { id: 'd' }, { id: 'a' }, { id: 'e', pinned: true }, { id: 'c' }];
    const world = worldFor('harbour', projects);
    const garden = world.landmarks.find((l) => l.id === 'garden')!;
    const plants = gardenPlants(world, projects);
    expect(plants.map((p) => [p.projectId, p.kind])).toEqual([
      ['b', 'flower'],
      ['e', 'flower'],
      ['a', 'tree'],
      ['c', 'tree'],
      ['d', 'tree'],
    ]);
    expect(plants.map((p) => p.cell)).toEqual([...garden.flowers, ...garden.trees]);
  });

  it('leaves other Projects out of empty flower cells: they stay grass', () => {
    const projects = projectsOf(8, 1);
    const plants = gardenPlants(worldFor('42', projects), projects);
    expect(plants.map((p) => p.kind)).toEqual(['flower', 'tree', 'tree', 'tree']);
  });
});
