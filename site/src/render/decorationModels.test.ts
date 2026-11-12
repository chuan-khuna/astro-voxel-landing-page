import { describe, expect, it } from 'vitest';
import { BIOME_IDS, DECORATION_KINDS, generateWorld } from '@/world';
import { decorationOf, decorationPlacement, decorationStructure } from './decorationModels';

const counts = { projects: 6, clients: 5, partners: 3 };
const seeds = Array.from({ length: 24 }, (_, i) => `decor-${i}`);

describe('decoration models', () => {
  it('takes each piece from its kind in the World’s Biome', () => {
    for (const biome of BIOME_IDS) for (const kind of DECORATION_KINDS) expect(decorationStructure(biome, kind)).toMatchObject({ kind, biome, variant: 1 });
  });

  it('stands each piece in its cell on the ground, turned to its facing', () => {
    const world = generateWorld('harbour', counts);
    const { width, heights } = world.terrain;
    for (const piece of world.decoration) {
      const p = decorationPlacement(world, piece);
      expect(p.x).toBe(piece.cell.x + 0.5);
      expect(p.z).toBe(piece.cell.z + 0.5);
      expect(p.y).toBe(heights[piece.cell.z * width + piece.cell.x]);
      expect(p.turns).toBe({ south: 0, east: 1, north: 2, west: 3 }[piece.facing]);
    }
  });

  it('shows every piece on the full tier', () => {
    for (const seed of seeds) {
      const world = generateWorld(seed, counts);
      expect(decorationOf(world, 'full').map((d) => d.piece), seed).toEqual(world.decoration);
    }
  });

  it('shows about half the pieces on the reduced tier, spread over the World, every lamp, and never one the full tier lacks', () => {
    for (const seed of seeds) {
      const world = generateWorld(seed, counts);
      const reduced = decorationOf(world, 'reduced').map((d) => d.piece);
      const lampsLeft = world.decoration.filter((d, i) => i % 2 === 1 && d.kind === 'lamp').length;
      expect(reduced.length, seed).toBe(Math.ceil(world.decoration.length / 2) + lampsLeft);
      for (const lamp of world.decoration.filter((d) => d.kind === 'lamp')) expect(reduced, seed).toContain(lamp);
      for (const piece of reduced) expect(world.decoration, seed).toContain(piece);
      // Spread: the kept pieces reach as far across the World as all of them do, within a few cells.
      const reach = (pieces: typeof reduced) => Math.max(...pieces.map((d) => d.cell.x)) - Math.min(...pieces.map((d) => d.cell.x));
      expect(reach(reduced), seed).toBeGreaterThanOrEqual(reach(world.decoration) - 6);
    }
  });
});
