/**
 * The Clients' boats and the Partners' ships as structures (ADR 0004): each
 * boat or ship is the structure of its kind in the World's Biome
 * (`structures/boat/<biome>-<kind>`, `structures/ship/<biome>-<kind>`; the
 * kind comes from its owner's id, `world/vessels.ts`), drawn at ⅛ unit
 * with its bow towards +z and standing on the sea floor. Every copy of one
 * structure is one `InstancedMesh` (`ships.ts`, `boats.ts`).
 *
 * Pure: no three.js.
 */
import type { BiomeId, Boat, World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
import { FACING_TURNS, type InstancePlacement } from './structureMeshes';
import type { ShipPose } from './shipMotion';

export type VesselKind = 'boat' | 'ship';

/** The structure of a boat or ship of `kind` (from 1) in a Biome's style. */
export function vesselStructure(vessel: VesselKind, biome: BiomeId, kind: number): Structure {
  const s = variantsOf(vessel, biome).find((v) => v.variant === kind);
  if (!s) throw new Error(`No ${vessel} of kind ${kind} for the ${biome} Biome`);
  return s;
}

/** A moored boat: its footprint's middle on its berth cell's middle, on the sea floor, its bow along its facing. */
export function boatPlacement(boat: Pick<Boat, 'cell' | 'facing'>): InstancePlacement {
  return { x: boat.cell.x + 0.5, y: 0, z: boat.cell.z + 0.5, turns: FACING_TURNS[boat.facing] };
}

/** Every boat in a World with its structure. */
export function boatsOf(world: Pick<World, 'biome' | 'boats'>): Array<{ boat: Boat; structure: Structure }> {
  return world.boats.map((boat) => ({ boat, structure: vesselStructure('boat', world.biome.id, boat.kind) }));
}

/**
 * A sailing ship at its pose: its footprint's middle on the path, on the sea
 * floor, its bow along its heading (0 is +x). A quarter turn takes +z to
 * +x, so heading h is 1 − 2h/π quarter turns.
 */
export function shipPlacement(pose: ShipPose): InstancePlacement {
  return { x: pose.x, y: 0, z: pose.z, turns: 1 - (2 * pose.heading) / Math.PI };
}
