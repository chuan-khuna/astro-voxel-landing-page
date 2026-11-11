/**
 * World data to voxel grids, ready for the mesher. Pure (no three.js).
 *
 * - `terrain`: 1-unit voxels. Every land column from y = 0 up to its height;
 *   the top voxel takes the surface (or path) colour, buried voxels their
 *   stratum's colour, so cliffs show layered bands.
 * - `detail`: ¼-unit voxels (`GROUND_DETAIL`) for what is built on the
 *   terrain and not yet a structure: bridge decks, stairs, the Dock's deck
 *   and jetty (`landmarkModels.ts`) and the buoys. The Clients' boats are
 *   instanced structures (`boats.ts`), not in any grid.
 * - `structure`: ⅛-unit voxels (`STRUCTURE`) for placed structures
 *   (`structureModels.ts`): the House's base, the Station, the Mailbox and
 *   the Dock's things; and the House Interior's room at ⅛ unit
 *   (`interiorModel.ts`), seen while the lid lifts.
 *
 * The grids index one shared colour list. See `voxelTiers.ts` for the tiers.
 */
import { houseYard, type BiomeColourRole, type Oklch, type PlacedLandmark, type World } from '@/world';
import { buildLandmark } from './landmarkModels';
import { drawBuoy } from './buoyModel';
import { meshVoxels, VoxelGrid, type ChunkMesh } from './mesher';
import { FIXED_COLOURS, LOOK, oklchToLinear, shiftLightness, type FixedColour, type Rgb } from './palette';
import { drawStructures } from './structureModels';
import { drawWorldRoom } from './interiorModel';
import { GROUND_DETAIL, STRUCTURE } from './voxelTiers';

/** A colour list that hands out one id per distinct colour. */
export class ColourTable {
  readonly colours: Rgb[] = [];
  private readonly ids = new Map<string, number>();

  id(colour: Oklch): number {
    const k = `${colour.l},${colour.c},${colour.h}`;
    let id = this.ids.get(k);
    if (id === undefined) {
      id = this.colours.length;
      this.colours.push(oklchToLinear(colour));
      this.ids.set(k, id);
    }
    return id;
  }
}

/** Colour ids for a World: its Biome's roles plus the fixed colours. */
export interface WorldColours {
  table: ColourTable;
  biome: (role: BiomeColourRole, dl?: number) => number;
  fixed: (name: FixedColour, dl?: number) => number;
}

export interface WorldVoxels {
  terrain: VoxelGrid;
  detail: VoxelGrid;
  structure: VoxelGrid;
  colours: Rgb[];
  /** Is the terrain solid at this world point? */
  terrainSolid: (x: number, y: number, z: number) => boolean;
}

export function worldColours(world: Pick<World, 'biome'>): WorldColours {
  const table = new ColourTable();
  return {
    table,
    biome: (role, dl = 0) => table.id(shiftLightness(world.biome.colours[role], dl)),
    fixed: (name, dl = 0) => table.id(shiftLightness(FIXED_COLOURS[name], dl)),
  };
}

/** Terrain chunks are 16 × 16 × 16 terrain voxels; detail and structure chunks cover the same 16-unit cube. */
const CHUNK_UNITS = 16;

/** A World's voxel grids as chunk meshes: plain typed arrays, safe to post from a Web Worker. */
export interface MeshedWorld {
  terrain: ChunkMesh[];
  detail: ChunkMesh[];
  structure: ChunkMesh[];
  /** Voxel size of the terrain, detail and structure grids, in world units. */
  voxelSizes: [number, number, number];
}

/** Mesh a World's voxel grids into chunk meshes (world units). No GPU work. */
export function meshWorld(world: World): MeshedWorld {
  const voxels = worldToVoxels(world);
  const terrain = meshVoxels(voxels.terrain, {
    colours: voxels.colours,
    aoStrength: LOOK.aoStrength,
    chunkSize: CHUNK_UNITS,
    solidOutside: (_x, y) => y < 0,
  });
  const s = 1 / GROUND_DETAIL;
  const detail = meshVoxels(voxels.detail, {
    colours: voxels.colours,
    aoStrength: LOOK.aoStrength,
    chunkSize: CHUNK_UNITS * GROUND_DETAIL,
    solidOutside: (x, y, z) => voxels.terrainSolid((x + 0.5) * s, (y + 0.5) * s, (z + 0.5) * s),
  });
  // Structures stand on the terrain and beside ¼-unit detail: both hide their faces and darken their AO.
  const e = 1 / STRUCTURE;
  const ratio = STRUCTURE / GROUND_DETAIL;
  const structure = meshVoxels(voxels.structure, {
    colours: voxels.colours,
    aoStrength: LOOK.aoStrength,
    chunkSize: CHUNK_UNITS * STRUCTURE,
    solidOutside: (x, y, z) =>
      voxels.terrainSolid((x + 0.5) * e, (y + 0.5) * e, (z + 0.5) * e) ||
      voxels.detail.has(Math.floor(x / ratio), Math.floor(y / ratio), Math.floor(z / ratio)),
  });
  return { terrain, detail, structure, voxelSizes: [voxels.terrain.size, voxels.detail.size, voxels.structure.size] };
}

export function worldToVoxels(world: World): WorldVoxels {
  const { width, depth, heights, isle, surface } = world.terrain;
  const colours = worldColours(world);
  const pathCells = new Set(world.paths.flatMap((p) => p.cells.map((c) => c.z * width + c.x)));
  // The path runs on through the House's front yard to its door.
  const house = world.landmarks.find((l) => l.id === 'house');
  if (house) {
    const door = houseYard(house).door;
    pathCells.add(door.z * width + door.x);
  }

  const terrain = new VoxelGrid(1);
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const i = z * width + x;
      if (isle[i] === -1) continue;
      const h = heights[i]!;
      const kind = surface[i]!;
      const top = colours.biome(pathCells.has(i) ? 'path' : kind === 'sea' ? 'sand' : kind);
      for (let y = 0; y < h; y++) {
        terrain.set(x, y, z, y === h - 1 ? top : colours.biome(world.strata[y] ?? 'rock'));
      }
    }
  }

  const terrainSolid = (x: number, y: number, z: number) => {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (y < 0) return true; // the sea floor: never seen, so faces against it are culled
    if (cx < 0 || cz < 0 || cx >= width || cz >= depth) return false;
    return y < heights[cz * width + cx]!;
  };

  const detail = new VoxelGrid(1 / GROUND_DETAIL);
  drawDetail(world, detail, colours);

  const structure = new VoxelGrid(1 / STRUCTURE);
  drawStructures(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));
  drawWorldRoom(world, colours, (x, y, z, colour) => structure.set(x, y, z, colour));

  return { terrain, detail, structure, colours: colours.table.colours, terrainSolid };
}

/** What `drawDetail` has just drawn: a group of parts, or one Landmark. */
export type DetailPart = { kind: 'bridges' | 'stairs' | 'buoys' } | { kind: 'landmark'; landmark: PlacedLandmark };

/**
 * Draw everything built on the terrain into the ¼-unit detail grid: bridge
 * decks, stairs, the Landmark models and the buoys, in that order. `drawn`
 * is told after each part (the render stats overlay counts voxels by kind
 * this way).
 */
export function drawDetail(world: World, grid: VoxelGrid, colours: WorldColours, drawn?: (part: DetailPart) => void): void {
  addBridges(world, grid, colours);
  drawn?.({ kind: 'bridges' });
  addStairs(world, grid, colours);
  drawn?.({ kind: 'stairs' });
  for (const landmark of world.landmarks) {
    buildLandmark(landmark, grid, colours);
    drawn?.({ kind: 'landmark', landmark });
  }
  for (const buoy of world.buoys) drawBuoy(buoy, grid, colours);
  drawn?.({ kind: 'buoys' });
}

/** A plank deck per bridge cell, one ¼ voxel thick, its top level with both ends. */
function addBridges(world: World, grid: VoxelGrid, colours: WorldColours): void {
  const plank = colours.biome('bridge');
  const plankDark = colours.biome('bridge', -0.05);
  for (const bridge of world.bridges) {
    const first = bridge.cells[0];
    const last = bridge.cells[bridge.cells.length - 1];
    if (!first || !last) continue;
    // Planks run across the bridge, so alternate colour along its length.
    const alongX = first.z === last.z;
    const y = bridge.y * GROUND_DETAIL - 1;
    for (const cell of bridge.cells) {
      for (let i = 0; i < GROUND_DETAIL; i++) {
        for (let k = 0; k < GROUND_DETAIL; k++) {
          const x = cell.x * GROUND_DETAIL + i;
          const z = cell.z * GROUND_DETAIL + k;
          const along = alongX ? x : z;
          grid.set(x, y, z, along % 2 === 0 ? plank : plankDark);
        }
      }
    }
  }
}

/** Three ¼-voxel steps on the lower cell, rising towards the higher cell. */
function addStairs(world: World, grid: VoxelGrid, colours: WorldColours): void {
  const colour = colours.biome('path', -0.06);
  for (const stair of world.stairs) {
    const x0 = stair.cell.x * GROUND_DETAIL;
    const z0 = stair.cell.z * GROUND_DETAIL;
    const y0 = stair.y * GROUND_DETAIL;
    for (let i = 0; i < GROUND_DETAIL; i++) {
      for (let k = 0; k < GROUND_DETAIL; k++) {
        // `rise` counts ¼ cells from the low side: 0 at the low edge, 3 at the high edge.
        const rise =
          stair.facing === 'east' ? i : stair.facing === 'west' ? GROUND_DETAIL - 1 - i : stair.facing === 'south' ? k : GROUND_DETAIL - 1 - k;
        for (let y = 0; y < rise; y++) grid.set(x0 + i, y0 + y, z0 + k, colour);
      }
    }
  }
}
