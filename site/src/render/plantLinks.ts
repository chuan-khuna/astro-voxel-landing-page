/**
 * How big a Garden plant's link is on screen. Plants stand side by side in
 * the Garden's bed, and the screen rectangles round their isometric boxes
 * overlap, so a plant's link is only the middle of its plant. With `s` px a
 * world unit, cells side by side sit 0.71·s apart across the screen and
 * cells one behind the other diagonally 0.82·s apart down it; a tree's box
 * centre also stands about 0.65·s above that of the flower in front of it.
 * So every link is 0.7·s wide, a flower's 0.8·s tall and a tree's 2·s tall,
 * and no link covers another plant's (`plantLinks.test.ts` checks a full
 * Garden). Pure.
 */
import type { PlantKind } from '@/lib/gardenPlants';

const LINK: Record<PlantKind, { w: number; h: number }> = {
  flower: { w: 0.7, h: 0.8 },
  tree: { w: 0.7, h: 2 },
};

/** A plant's link size in px, with `pxPerUnit` screen px a world unit. */
export function plantLinkSize(kind: PlantKind, pxPerUnit: number): { w: number; h: number } {
  return { w: LINK[kind].w * pxPerUnit, h: LINK[kind].h * pxPerUnit };
}
