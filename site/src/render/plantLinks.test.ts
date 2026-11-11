import { describe, expect, it } from 'vitest';
import { BIOME_IDS, GARDEN_BED } from '@/world';
import { plantLinkSize } from './plantLinks';
import { plantStructure } from './gardenPlants';

/** The fixed isometric camera, looking along −(1, 1, 1): a point's screen position at 1 px per unit (y down). */
const screen = (p: { x: number; y: number; z: number }) => ({ x: (p.x - p.z) / Math.SQRT2, y: (p.x - 2 * p.y + p.z) / Math.sqrt(6) });

describe('plantLinkSize', () => {
  it('keeps a full Garden\'s plant links apart, in every Biome', () => {
    for (const biome of BIOME_IDS) {
      const plants = [
        ...GARDEN_BED.flowers.map((cell, i) => ({ cell, kind: 'flower' as const, s: plantStructure(biome, 'flower', i) })),
        ...GARDEN_BED.trees.map((cell, i) => ({ cell, kind: 'tree' as const, s: plantStructure(biome, 'tree', i) })),
      ];
      // A link is centred on its plant's box: its cell, from the ground to its top.
      const rects = plants.map(({ cell, kind, s }) => {
        const centre = screen({ x: cell.x + 0.5, y: (s.size.y - s.anchor.y) / s.scale / 2, z: cell.z + 0.5 });
        return { ...centre, ...plantLinkSize(kind, 1) };
      });
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 1e-9 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1e-9;
          expect(apart, `${biome} ${plants[i]!.kind} ${i} and ${plants[j]!.kind} ${j}`).toBe(true);
        }
      }
    }
  });

  it('gives a tree a taller link than a flower, as tall trees are easier to aim at', () => {
    expect(plantLinkSize('tree', 10).h).toBeGreaterThan(plantLinkSize('flower', 10).h);
    expect(plantLinkSize('tree', 10).w).toBe(plantLinkSize('flower', 10).w);
  });
});
