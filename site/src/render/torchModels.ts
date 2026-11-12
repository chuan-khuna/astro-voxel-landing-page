/**
 * Torches as structures (polish ticket 16): each torch is its Biome's torch
 * Variant (`structures/torch/<biome>-<variant>`), standing on its cell's
 * middle, on its ground (or the Dock's deck on the jetty's end), facing
 * south. `torches.ts` draws them; `lightSources.ts` puts their light at the
 * same place. Pure: no three.js.
 */
import type { TorchVariant, World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
import type { InstancePlacement } from './instancePlacement';

/** The torch structure of a Variant in a Biome. */
export function torchStructure(world: Pick<World, 'biome'>, variant: TorchVariant): Structure {
  const s = variantsOf('torch', world.biome.id).find((v) => v.variant === variant);
  if (!s) throw new Error(`No torch Variant ${variant} for the ${world.biome.id} Biome`);
  return s;
}

/** A torch's placement as an instanced structure: its cell's middle, on its ground (or the jetty's deck). */
export const torchPlacement = (torch: World['torches'][number]): InstancePlacement => ({ x: torch.cell.x + 0.5, y: torch.y, z: torch.cell.z + 0.5, turns: 0 });

