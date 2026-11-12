/**
 * Which voxel models the World outlines (`outline.ts`): the model of every
 * link over the canvas that is hovered, focused from the keyboard, or the
 * page now open (`aria-current`, set on a Project's plant and on the
 * developer). The links stay invisible boxes that take the clicks; the
 * outline follows the model's own shape.
 *
 * A model is named by a key: `landmark:<id>` for a whole Landmark,
 * `plant:<project id>` for a Garden plant, `developer` for the developer in
 * the open House and `guide` for the Guide.
 *
 * Pure: no DOM, no three.js.
 */

/** A link's data attributes (its `dataset`) that say which model it stands for. */
export interface OutlineLinkData {
  hotspot?: string;
  project?: string;
  developer?: string;
  guide?: string;
}

/** The key of the model a link stands for. */
export function outlineKey(data: OutlineLinkData): string {
  if (data.guide !== undefined) return 'guide';
  if (data.developer !== undefined) return 'developer';
  if (data.project !== undefined) return `plant:${data.project}`;
  return `landmark:${data.hotspot ?? ''}`;
}

/** What a link over the World is doing now. */
export interface OutlineLinkState {
  /** Its model's key (`outlineKey`). */
  key: string;
  /** Hidden links (the developer's while the House is shut) outline nothing. */
  hidden: boolean;
  /** Under a mouse or pen (not a touch). */
  hovered: boolean;
  /** Focused from the keyboard (`:focus-visible`). */
  focusVisible: boolean;
  /** The page now open (`aria-current="page"`). */
  current: boolean;
}

/** The keys of the models to outline, in the links' order, each once. */
export function outlinedKeys(links: readonly OutlineLinkState[]): string[] {
  const keys = new Set<string>();
  for (const l of links) if (!l.hidden && (l.hovered || l.focusVisible || l.current)) keys.add(l.key);
  return [...keys];
}
