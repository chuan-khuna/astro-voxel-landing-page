import { describe, expect, it } from 'vitest';
import { generateWorld } from '../world';
import { gardenTrees, treeOrder } from './gardenTrees';

const ids = (n: number) => Array.from({ length: n }, (_, k) => `project-${String(k).padStart(3, '0')}`);
const worldFor = (seed: string, projects: number) => generateWorld(seed, { projects, clients: 0, partners: 0 });

describe('treeOrder', () => {
  it('orders Projects by id, whatever order they come in', () => {
    const projects = [{ id: 'tide-tables' }, { id: 'archive-search' }, { id: 'mill-sensors' }];
    expect(treeOrder(projects).map((p) => p.id)).toEqual(['archive-search', 'mill-sensors', 'tide-tables']);
    // The input is left alone.
    expect(projects[0]!.id).toBe('tide-tables');
  });
});

describe('gardenTrees', () => {
  it('gives one tree per Project, up to the cap of 24', () => {
    for (const seed of ['lighthouse', 'harbour', '42']) {
      for (const n of [1, 6, 23, 24, 25, 40]) {
        const trees = gardenTrees(worldFor(seed, n), ids(n));
        expect(trees, `${seed} ${n}`).toHaveLength(Math.min(n, 24));
      }
    }
  });

  it('handles 0 Projects: an empty Garden', () => {
    expect(gardenTrees(worldFor('lighthouse', 0), [])).toEqual([]);
  });

  it('pairs each tree with a Project in order by id, each on its own Garden cell', () => {
    const world = worldFor('harbour', 6);
    const garden = world.landmarks.find((l) => l.id === 'garden')!;
    const shuffled = ['f', 'b', 'd', 'a', 'e', 'c'];
    const trees = gardenTrees(world, shuffled);
    expect(trees.map((t) => t.projectId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(trees.map((t) => t.cell)).toEqual(garden.trees);
  });

  it('leaves Projects beyond the cap out of the Garden', () => {
    const trees = gardenTrees(worldFor('42', 30), ids(30));
    expect(trees.map((t) => t.projectId)).toEqual(ids(24));
  });

  it('adding a Project keeps every earlier Project on the same tree index', () => {
    const before = gardenTrees(worldFor('lighthouse', 5), ['b', 'c', 'd', 'e', 'f']);
    const after = gardenTrees(worldFor('lighthouse', 6), ['b', 'c', 'd', 'e', 'f', 'g']);
    expect(after.slice(0, 5).map((t) => t.projectId)).toEqual(before.map((t) => t.projectId));
  });
});
