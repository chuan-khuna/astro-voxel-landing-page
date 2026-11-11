/**
 * Which Project each Garden tree stands for. The World generator only gets
 * the Project count and lays out one tree cell per Project, in order, up to
 * its cap; Projects are taken in a stable order by id, so tree `k` is the
 * `k`-th Project by id. Pure; no DOM.
 */
import type { Cell, World } from '../world';

export interface GardenTree {
  /** The tree's cell, inside the Garden's footprint. */
  cell: Cell;
  projectId: string;
}

/** Projects in tree order: sorted by id. A new copy; the input is left alone. */
export function treeOrder<T extends { id: string }>(projects: readonly T[]): T[] {
  return projects.toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The World's Garden trees, each paired with its Project. Projects beyond
 * the tree cap get no tree; they still appear on the Garden's page.
 */
export function gardenTrees(world: World, projectIds: readonly string[]): GardenTree[] {
  const cells = world.landmarks.find((l) => l.id === 'garden')?.trees ?? [];
  const ordered = treeOrder(projectIds.map((id) => ({ id })));
  return cells.slice(0, ordered.length).map((cell, k) => ({ cell, projectId: ordered[k]!.id }));
}
