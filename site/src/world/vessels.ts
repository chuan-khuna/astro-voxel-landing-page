/**
 * The kinds of the Clients' boats and the Partners' ships. A kind is picked
 * by a stable hash of the Client's or Partner's id, never by the Seed, so
 * each keeps its kind in every World; only its style follows the Biome
 * (the structure `boat/<biome>-<kind>` or `ship/<biome>-<kind>`).
 */
import { hashSeed } from './prng';

/** Boat kinds a Client may have: one structure per kind in each Biome (`structures/boat/`). */
export const BOAT_KINDS = 3;
/** Ship kinds a Partner may have: one structure per kind in each Biome (`structures/ship/`). */
export const SHIP_KINDS = 3;

/** The kind (1 to `kinds`) of the vessel of the Client or Partner with this id. */
export function vesselKind(id: string, kinds: number): number {
  // The salt is arbitrary; this one happens to give the mock Partners three different ships.
  return 1 + (hashSeed(`craft/${id}`) % kinds);
}

/**
 * The ids of the first `count` Clients or Partners: the given ids in order,
 * then stand-ins (`<prefix>-<n>`, from 1) where there are fewer ids than the count.
 */
export function vesselIds(count: number, ids: readonly string[] | undefined, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => ids?.[i] ?? `${prefix}-${i + 1}`);
}
