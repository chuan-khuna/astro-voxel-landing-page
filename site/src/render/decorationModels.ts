/**
 * Decoration as structures (ADR 0004): each piece is the structure of its
 * kind in the World's Biome (`structures/<kind>/<biome>-1`), drawn at ⅛
 * unit facing +z and standing on its cell's ground. Every copy of one
 * structure is one `InstancedMesh` (`decoration.ts`).
 *
 * On the reduced render tier (phones, `lib/renderTier.ts`) every other piece
 * is left out; Landmarks are never reduced.
 *
 * Pure: no three.js.
 */
import type { BiomeId, Decoration, DecorationKind, World } from '@/world';
import type { RenderTierName } from '@/lib/renderTier';
import { variantsOf, type Structure } from '@/structures';
import { FACING_TURNS, type InstancePlacement } from './structureMeshes';

/** The structure of a piece of `kind` in a Biome's style. */
export function decorationStructure(biome: BiomeId, kind: DecorationKind): Structure {
  const s = variantsOf(kind, biome)[0];
  if (!s) throw new Error(`No ${kind} Decoration for the ${biome} Biome`);
  return s;
}

/** A piece's footprint middle on its cell's middle, on the cell's ground, turned to its facing. */
export function decorationPlacement(world: Pick<World, 'terrain'>, piece: Decoration): InstancePlacement {
  const { width, heights } = world.terrain;
  return { x: piece.cell.x + 0.5, y: heights[piece.cell.z * width + piece.cell.x]!, z: piece.cell.z + 0.5, turns: FACING_TURNS[piece.facing] };
}

/**
 * The pieces a tier shows, each with its structure: all of them on the full
 * tier; on the reduced tier every other one in placement order (row by row),
 * so the pieces left still cover the whole World.
 */
export function decorationOf(world: Pick<World, 'biome' | 'decoration'>, tier: RenderTierName): Array<{ piece: Decoration; structure: Structure }> {
  const shown = tier === 'full' ? world.decoration : world.decoration.filter((_, i) => i % 2 === 0);
  return shown.map((piece) => ({ piece, structure: decorationStructure(world.biome.id, piece.kind) }));
}
