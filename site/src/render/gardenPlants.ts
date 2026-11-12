/**
 * The Garden's plants: a flower per Pinned Project in its bed's front two
 * rows and a tree per other Project in its back row (`generateWorld` lays
 * out the cells, `lib/gardenPlants.ts` pairs them with Projects). Each plant
 * is a ⅛-unit structure of the World's Biome (`structures/tree/`,
 * `structures/flower/`); every copy of one structure is drawn by one
 * `InstancedMesh` (`worldMeshes.ts`), so they are not in the World's
 * structure grid. The Garden's fence is its Landmark Variant, drawn into
 * that grid like the other Landmarks (`structureModels.ts`).
 *
 * Pure: no three.js.
 */
import { GARDEN_BED, type BiomeId, type Cell, type PlacedLandmark, type World } from '@/world';
import { variantsOf, type Structure } from '@/structures';
import { structureVoxels, type StructureVoxel } from '@/structures/parse';
import type { PlantKind } from '@/lib/gardenPlants';
import type { ModelExtent } from './landmarkModels';
import type { InstancePlacement } from './structureMeshes';

/** One plant in a World: its structure, its cell and its place among its kind (0 first). */
export interface PlacedPlant {
  kind: PlantKind;
  /** Its place in the Garden's flowers or trees, in Garden order. */
  index: number;
  cell: Cell;
  structure: Structure;
}

/**
 * The structure of a Biome's plant: every tree is the Biome's tree; the
 * flowers take the Biome's flower Variants in turn, so neighbours differ.
 */
export function plantStructure(biome: BiomeId, kind: PlantKind, index: number): Structure {
  const variants = variantsOf(kind, biome);
  const s = variants[index % Math.max(1, variants.length)];
  if (!s) throw new Error(`No ${kind} for the ${biome} Biome`);
  return s;
}

/** Every plant in a World's Garden: the flowers, then the trees. */
export function gardenPlantsOf(world: Pick<World, 'biome' | 'landmarks'>): PlacedPlant[] {
  const garden = world.landmarks.find((l) => l.id === 'garden');
  if (!garden) return [];
  const of = (kind: PlantKind, cells: Cell[]) =>
    cells.map((cell, index) => ({ kind, index, cell, structure: plantStructure(world.biome.id, kind, index) }));
  return [...of('flower', garden.flowers), ...of('tree', garden.trees)];
}

/** Where a plant stands: its footprint's middle on its cell's middle, on the Garden's ground. */
export function plantPlacement(world: Pick<World, 'landmarks'>, plant: Pick<PlacedPlant, 'cell'>): InstancePlacement {
  const garden = world.landmarks.find((l) => l.id === 'garden');
  return { x: plant.cell.x + 0.5, y: garden?.y ?? 0, z: plant.cell.z + 0.5, turns: 0 };
}

/**
 * The box one plant covers, in world units relative to the Garden's model
 * origin (like `landmarkExtent`): its cell, from the ground to its top.
 * Used to size its hotspot and in the Garden's own extent.
 */
export function plantExtent(garden: PlacedLandmark, plant: Pick<PlacedPlant, 'cell' | 'structure'>): ModelExtent {
  const x = plant.cell.x - garden.footprint.origin.x;
  const z = plant.cell.z - garden.footprint.origin.z;
  const s = plant.structure;
  return { min: { x, y: 0, z }, max: { x: x + 1, y: (s.size.y - s.anchor.y) / s.scale, z: z + 1 } };
}

const planted = new Map<BiomeId, Structure>();

/**
 * A Biome's Garden planted full, as one structure for the Model Gallery:
 * its fence, six flowers and three trees, as a World lays them out.
 */
export function plantedGarden(biome: BiomeId): Structure {
  const hit = planted.get(biome);
  if (hit) return hit;
  const fence = variantsOf('garden', biome)[0];
  if (!fence) throw new Error(`No Garden fence for the ${biome} Biome`);
  const plants = [
    ...GARDEN_BED.flowers.map((cell, index) => ({ cell, structure: plantStructure(biome, 'flower', index) })),
    ...GARDEN_BED.trees.map((cell, index) => ({ cell, structure: plantStructure(biome, 'tree', index) })),
  ];
  const size = { ...fence.size, y: Math.max(fence.size.y, ...plants.map((p) => p.structure.size.y)) };
  const palette: StructureVoxel[] = [];
  const idOf = (entry: StructureVoxel) => {
    const i = palette.findIndex((p) => p.role === entry.role && p.part === entry.part);
    if (i !== -1) return i + 1;
    palette.push(entry);
    return palette.length;
  };
  const voxels = new Uint8Array(size.x * size.y * size.z);
  const put = (s: Structure, dx: number, dz: number) => {
    for (const v of structureVoxels(s)) voxels[dx + v.x + size.x * (dz + v.z + size.z * v.y)] = idOf({ role: v.role, part: v.part });
  };
  put(fence, 0, 0);
  for (const { cell, structure } of plants) put(structure, cell.x * fence.scale, cell.z * fence.scale);
  const full: Structure = { ...fence, name: `${fence.name} planted`, size, palette, voxels };
  planted.set(biome, full);
  return full;
}
