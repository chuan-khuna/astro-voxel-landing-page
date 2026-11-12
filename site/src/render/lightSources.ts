/**
 * A World's Light Sources (polish ticket 16): everything that throws block
 * light at Night, with where its light is, how far it reaches and how
 * strong it is. Pure: no three.js, so the World Web Worker can bake it
 * (`blockLight.ts`), and the halos (`halos.ts`) sit on the same points.
 *
 * - Structures that declare a `light:` (`structures/parse.ts`): the torches
 *   (`world.torches`), the Decoration's lamps, the Station's lighthouse, a
 *   Dock's lanterns and the House Interior's lamp or fire. Their light is
 *   the middle of their `flame` and `glow` voxels (`lightCentre`).
 * - The House's lit windows: one source in each cell in front of the lid's
 *   window glass (the front walls, which face out).
 * - The buoys' lamps.
 *
 * Fireflies only glow, and a boat's or ship's lamp moves: neither throws
 * block light.
 */
import type { World } from '@/world';
import type { Structure } from '@/structures';
import { lightCentre } from '@/structures/parse';
import { buoyLamp } from './buoyModel';
import { decorationOf, decorationPlacement } from './decorationModels';
import { furnishedRoom, interiorPlacement } from './interiorModel';
import { instanceMatrix, structurePivot, transformPoint, type InstancePlacement } from './instancePlacement';
import { houseWindowFaces, landmarkPlacement, landmarkStructure, serviceStructure, servicePlacement, turned, type StructurePlacement } from './structureModels';
import { INTERIOR, STRUCTURE } from './voxelTiers';
import { torchPlacement, torchStructure } from './torchModels';

/** Whose light colour a source throws: a torch's (the Biome's `torchLight`), a lit window's or a buoy's lamp's. */
export type LightColour = 'torch' | 'window' | 'buoy';

export interface LightSource {
  /** Where its light is, in world units. */
  x: number;
  y: number;
  z: number;
  /** Cells its block light reaches (its level at its own cell). */
  reach: number;
  /** Its brightness at its own cell, 0–1. */
  strength: number;
  colour: LightColour;
  /** A flame flickers; a lamp's glass, a window or a buoy shines steady. */
  flickers: boolean;
  /** Where in its flicker it is, 0–1, so no two flames waver in step. */
  phase: number;
  /** Inside the House (its room's lamp or fire): no halo shows it through the walls (`halos.ts`). */
  inside: boolean;
}

/** A lit window's light, and a buoy's: dimmer and shorter than a torch's. */
const WINDOW = { reach: 3, strength: 0.55 } as const;
const BUOY = { reach: 3, strength: 0.6 } as const;

/** A flame flickers: any `flame` voxel makes the structure's light flicker. */
const flickers = (s: Structure) => s.palette.some((p) => p.role === 'flame');

export function lightSources(world: World): LightSource[] {
  const out: Array<Omit<LightSource, 'phase' | 'inside'> & { inside?: boolean }> = [];
  const add = (s: Structure, at: { x: number; y: number; z: number }, inside = false) => {
    if (s.light) out.push({ ...at, ...s.light, colour: 'torch', flickers: flickers(s), inside });
  };

  // Structures in the World's grid, placed whole voxels and mirrored to their door.
  const placed = (s: Structure, at: StructurePlacement) => {
    const centre = lightCentre(s);
    if (!centre || !s.light) return;
    const p = turned(s, centre, at.facing);
    add(s, { x: (at.x + p.x) / STRUCTURE, y: (at.y + p.y) / STRUCTURE, z: (at.z + p.z) / STRUCTURE });
  };
  for (const landmark of world.landmarks) {
    placed(landmarkStructure(world, landmark), landmarkPlacement(world, landmark));
    for (const service of landmark.services) placed(serviceStructure(world.biome.id, service.kind), servicePlacement(landmark, service));
  }

  // Instanced structures: the Decoration's lamps (every one, on every tier) and the torches.
  const instanced = (s: Structure, placement: InstancePlacement) => {
    const centre = lightCentre(s);
    if (!centre || !s.light) return;
    const local = { x: centre.x / s.scale, y: centre.y / s.scale, z: centre.z / s.scale };
    add(s, transformPoint(instanceMatrix(placement, structurePivot(s)), local));
  };
  for (const { piece, structure } of decorationOf(world, 'full')) instanced(structure, decorationPlacement(world, piece));
  for (const torch of world.torches) instanced(torchStructure(world, torch.variant), torchPlacement(torch));

  // The House Interior's lamp or fire, at 1/16 unit.
  if (world.landmarks.some((l) => l.id === 'house')) {
    const room = furnishedRoom(world.biome.id);
    const centre = lightCentre(room);
    const at = interiorPlacement(world);
    if (centre) add(room, { x: (at.x + centre.x) / INTERIOR, y: (at.y + centre.y) / INTERIOR, z: (at.z + centre.z) / INTERIOR }, true);
  }

  // The House's lit windows: a source in each cell the lid's glass looks out on.
  const cells = new Map<string, { x: number; y: number; z: number }>();
  for (const face of houseWindowFaces(world)) {
    if (face.part !== 'lid') continue;
    const x = Math.floor((face.x + (face.facing === '+x' ? 1.5 : 0.5)) / STRUCTURE);
    const y = Math.floor((face.y + 0.5) / STRUCTURE);
    const z = Math.floor((face.z + (face.facing === '+z' ? 1.5 : 0.5)) / STRUCTURE);
    cells.set(`${x},${y},${z}`, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  }
  for (const at of cells.values()) out.push({ ...at, ...WINDOW, colour: 'window', flickers: false });

  for (const buoy of world.buoys) {
    const { min, max } = buoyLamp(buoy);
    out.push({ x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2, ...BUOY, colour: 'buoy', flickers: false });
  }

  // Each out of step with the others: the golden ratio spreads the phases evenly.
  return out.map((s, i) => ({ ...s, inside: s.inside ?? false, phase: (i * 0.618034) % 1 }));
}
