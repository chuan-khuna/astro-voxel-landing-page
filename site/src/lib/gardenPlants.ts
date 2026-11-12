/**
 * Which Project each Garden plant stands for. The World generator only
 * gets the Project and Pinned Project counts (`gardenCountsOf`) and lays out
 * a cell per flower and per tree; Projects are taken in Garden order
 * (`projectOrder`): Pinned Projects by id, then the rest by id. The first
 * six Pinned Projects bloom as flowers; the Projects after them grow as
 * trees, up to three. Pure; no DOM.
 */
import { gardenCounts, type Cell, type ContentCounts, type World } from '@/world';

export type PlantKind = 'flower' | 'tree';

export interface GardenPlant {
  /** The plant's cell, in the Garden's bed. */
  cell: Cell;
  kind: PlantKind;
  projectId: string;
}

/** A Project as a plain object, or a content entry with its data. */
type Pinnable = { id: string; pinned?: boolean } | { id: string; data: { pinned?: boolean } };

const isPinned = (p: Pinnable) => ('data' in p ? p.data.pinned : p.pinned) === true;

/**
 * Projects in Garden order: Pinned Projects first, then the rest, each
 * sorted by id. The Garden's list (`/garden`) uses the same order. A new
 * copy; the input is left alone.
 */
export function projectOrder<T extends Pinnable>(projects: readonly T[]): T[] {
  return projects.toSorted((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** What the World generator needs to know about the Projects: how many, and how many are pinned. */
export function gardenCountsOf(projects: readonly Pinnable[]): Pick<ContentCounts, 'projects' | 'pinned'> {
  return { projects: projects.length, pinned: projects.filter(isPinned).length };
}

/**
 * The Projects that get a plant in every World, in Garden order, with the
 * kind each grows as: the first six Pinned Projects as flowers, then the
 * next three Projects (Pinned Projects beyond six first) as trees. Other
 * Projects never take a flower's place.
 */
export function plantedProjects<T extends Pinnable>(projects: readonly T[]): Array<{ project: T; kind: PlantKind }> {
  // Pinned Projects come first in Garden order, so the flowers are its first ones and the trees the next.
  const ordered = projectOrder(projects);
  const { projects: all, pinned } = gardenCountsOf(projects);
  const shown = gardenCounts(all, pinned);
  return ordered.slice(0, shown.flowers + shown.trees).map((project, k) => ({ project, kind: k < shown.flowers ? 'flower' : 'tree' }));
}

/**
 * The World's Garden plants, each paired with its Project: the flowers,
 * then the trees, in Garden order. Projects beyond the Garden's places get
 * no plant; they still appear on the Garden's page.
 */
export function gardenPlants(world: World, projects: readonly Pinnable[]): GardenPlant[] {
  const garden = world.landmarks.find((l) => l.id === 'garden');
  if (!garden) return [];
  const cells = { flower: [...garden.flowers], tree: [...garden.trees] };
  return plantedProjects(projects).flatMap(({ project, kind }) => {
    const cell = cells[kind].shift();
    return cell ? [{ cell, kind, projectId: project.id }] : [];
  });
}
