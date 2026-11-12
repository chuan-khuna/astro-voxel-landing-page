/**
 * The sea as a 1-unit voxel layer (the `TERRAIN` tier), pure: no three.js.
 *
 * Every sea cell of the grid, and of a ring `SEA_RING` cells wide round it,
 * is one water voxel whose top sits at `SEA_LEVEL` (the voxel runs from
 * `SEA_LEVEL - 1` up). Beyond the ring a flat frame of water reaches
 * `SEA_SPAN` times the grid, so the sea fills the frame at any aspect ratio.
 *
 * Only faces that can show are built: each voxel's top, and short skirts on
 * its +x and +z sides (the sides the camera sees) where the neighbour is
 * water too, so a voxel bobbing above its neighbour shows a side and never
 * a gap. Faces against land, and the voxels' undersides, are never seen.
 *
 * Each vertex carries its voxel's cell and whether it bobs (`cells`), and
 * the voxel's shade (`shades`): how deep (0 shallow, 1 deep, by distance
 * from the coast), its opacity (translucent over the shallows, opaque out
 * at sea) and its swell (how much it bobs: 1, fading to 0 across the ring's
 * outer cells so the voxels meet the flat frame flush). The bob itself is
 * computed in the shader (`seaMaterial.ts`).
 *
 * The sea floor is y = 0 (boats, buoys and the jetty's posts stand on it):
 * under every translucent voxel a seabed tile shows through the water.
 */
import type { World } from '@/world';
import { coastDistance as coastDistanceOf } from '@/world/coast';

/** The top of the water at rest, in world units above the sea floor (y = 0). */
export const SEA_LEVEL = 0.15;
/** Cells of water voxels round the terrain grid on every side. */
export const SEA_RING = 8;
/** The flat water beyond the ring reaches this many times the grid's size. */
export const SEA_SPAN = 6;
/** How far a voxel rises above (and sinks below) the sea level as it bobs, in world units. */
export const SEA_BOB = 0.04;
/** Where a skirt ends: below the lowest a neighbour's top can sink, above the sea floor. */
export const SKIRT_BOTTOM = SEA_LEVEL - 2.5 * SEA_BOB;
/** Water this far from the coast (cells, centre to centre) or further is the Biome's deep water. */
export const DEEP_REACH = 6;
/** Water this far from the coast or further is opaque. */
export const CLEAR_REACH = 3;
/** The opacity of the water beside the coast. */
export const SHALLOW_OPACITY = 0.7;
/** The coast's distance stops counting this far out (units): no surf reaches it. */
export const COAST_FAR = 8;
/** Cells over which the swell fades out towards the ring's outer edge. */
const SWELL_FADE = 4;

/** Plain typed arrays for one mesh: every 4 vertices are one quad (two triangles). */
export interface SeaMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** Per vertex: the voxel's cell x and z, and 1 if the vertex bobs with it (0 if it stays put). */
  cells: Float32Array;
  /** Per vertex: the voxel's deep (0–1), opacity (0–1) and swell (0–1). */
  shades: Float32Array;
  /**
   * Per vertex, the same for all four of a voxel's: the distance from the
   * coastline (units) at its corners (x, z), (x + 1, z), (x, z + 1),
   * (x + 1, z + 1), which the surf runs in along (`surf.ts`).
   */
  coast: Float32Array;
  /** Per vertex, likewise: 1 where surf may break at each corner, 0 by the jetty or a moored boat. */
  calm: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

export interface SeaModel {
  /** The water: voxel tops and skirts, and the flat frame beyond the ring. */
  water: SeaMesh;
  /** The sea floor (y = 0) under every translucent water voxel, one tile each, carrying the shade of the water above it. */
  seabed: SeaMesh;
}

/** How a water voxel looks: how deep (0 shallow, 1 deep), its opacity, and how much it bobs (0–1). */
export interface SeaShade {
  deep: number;
  opacity: number;
  swell: number;
}

/** A water voxel's shade from its distance to the nearest land cell (cells, centre to centre) and to the ring's outer edge. */
export function seaShade(coast: number, edge: number): SeaShade {
  const clamp = (t: number) => Math.min(1, Math.max(0, t));
  const deep = clamp((coast - 1) / (DEEP_REACH - 1));
  const opacity = SHALLOW_OPACITY + (1 - SHALLOW_OPACITY) * clamp((coast - 1) / (CLEAR_REACH - 1));
  return { deep, opacity, swell: clamp(edge / SWELL_FADE) };
}

/**
 * Distance from each cell of the grid plus its ring to the nearest land
 * cell, centre to centre (`world/coast.ts`). Indexed
 * `(z + SEA_RING) * w + (x + SEA_RING)`; Infinity with no land at all.
 */
export function coastDistance(world: World): { w: number; d: number; distance: Float32Array } {
  return coastDistanceOf(world.terrain, SEA_RING);
}

/** A voxel's surf data: the coast's distance and the calm at its four corners. */
interface Surf {
  coast: readonly number[];
  calm: readonly number[];
}
const OPEN_SEA: Surf = { coast: [COAST_FAR, COAST_FAR, COAST_FAR, COAST_FAR], calm: [1, 1, 1, 1] };

/** Collects quads into a `SeaMesh`. */
class QuadBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly cells: number[] = [];
  private readonly shades: number[] = [];
  private readonly coast: number[] = [];
  private readonly calm: number[] = [];
  private quads = 0;

  /** Four corners counter-clockwise seen from the side `normal` points to; `lifts` says which corners bob. */
  quad(
    corners: readonly (readonly [number, number, number])[],
    normal: readonly [number, number, number],
    cell: readonly [number, number],
    lifts: readonly number[],
    shade: SeaShade,
    surf: Surf = OPEN_SEA,
  ): void {
    corners.forEach((c, k) => {
      this.positions.push(c[0], c[1], c[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.cells.push(cell[0], cell[1], lifts[k]!);
      this.shades.push(shade.deep, shade.opacity, shade.swell);
      this.coast.push(...surf.coast);
      this.calm.push(...surf.calm);
    });
    this.quads++;
  }

  build(): SeaMesh {
    const indices = new Uint32Array(this.quads * 6);
    for (let q = 0; q < this.quads; q++) {
      const v = q * 4;
      indices.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
    }
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      cells: new Float32Array(this.cells),
      shades: new Float32Array(this.shades),
      coast: new Float32Array(this.coast),
      calm: new Float32Array(this.calm),
      indices,
      triangles: this.quads * 2,
    };
  }
}

/** The World's sea: its water voxels, the flat water beyond them and the seabed under the shallows. */
export function seaModel(world: World): SeaModel {
  const { width, depth } = world.terrain;
  const { w, d, distance } = coastDistance(world);
  const water = new QuadBuilder();
  const seabed = new QuadBuilder();
  const y = SEA_LEVEL;
  const flat: SeaShade = { deep: 1, opacity: 1, swell: 0 };

  // The surf's data. A cell's distance (centre to the nearest land cell's centre, out to COAST_FAR); beyond the ring, far.
  const far = (gx: number, gz: number) => (gx >= 0 && gz >= 0 && gx < w && gz < d ? Math.min(COAST_FAR, distance[gz * w + gx]!) : COAST_FAR);
  // A corner's distance from the coastline: the mean of the four cells round it, less half a cell (so a land cell's edge is 0).
  const coastAt = (gx: number, gz: number) => Math.max(0, (far(gx - 1, gz - 1) + far(gx, gz - 1) + far(gx - 1, gz) + far(gx, gz)) / 4 - 0.5);
  // The jetty's posts and the boats' hulls stand in the water: no corner of a cell round them breaks.
  const still = new Set([...world.landmarks.flatMap((l) => l.jetty), ...world.boats.map((b) => b.cell)].map((c) => `${c.x},${c.z}`));
  const calmAt = (x: number, z: number) => (still.has(`${x - 1},${z - 1}`) || still.has(`${x},${z - 1}`) || still.has(`${x - 1},${z}`) || still.has(`${x},${z}`) ? 0 : 1);

  const isWater = (gx: number, gz: number) => gx >= 0 && gz >= 0 && gx < w && gz < d && distance[gz * w + gx]! > 0;
  for (let gz = 0; gz < d; gz++) {
    for (let gx = 0; gx < w; gx++) {
      if (!isWater(gx, gz)) continue;
      const x = gx - SEA_RING;
      const z = gz - SEA_RING;
      const edge = Math.min(gx, gz, w - 1 - gx, d - 1 - gz);
      const shade = seaShade(distance[gz * w + gx]!, edge);
      const cell = [x, z] as const;
      const surf: Surf = {
        coast: [coastAt(gx, gz), coastAt(gx + 1, gz), coastAt(gx, gz + 1), coastAt(gx + 1, gz + 1)],
        calm: [calmAt(x, z), calmAt(x + 1, z), calmAt(x, z + 1), calmAt(x + 1, z + 1)],
      };
      // Top, counter-clockwise from above.
      water.quad([[x, y, z], [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z]], [0, 1, 0], cell, [1, 1, 1, 1], shade, surf);
      // Skirts on the sides the camera sees, where the neighbour is water too.
      if (isWater(gx + 1, gz)) {
        water.quad(
          [[x + 1, SKIRT_BOTTOM, z + 1], [x + 1, SKIRT_BOTTOM, z], [x + 1, y, z], [x + 1, y, z + 1]],
          [1, 0, 0],
          cell,
          [0, 0, 1, 1],
          shade,
        );
      }
      if (isWater(gx, gz + 1)) {
        water.quad(
          [[x, SKIRT_BOTTOM, z + 1], [x + 1, SKIRT_BOTTOM, z + 1], [x + 1, y, z + 1], [x, y, z + 1]],
          [0, 0, 1],
          cell,
          [0, 0, 1, 1],
          shade,
        );
      }
      if (shade.opacity < 1) {
        seabed.quad([[x, 0, z], [x, 0, z + 1], [x + 1, 0, z + 1], [x + 1, 0, z]], [0, 1, 0], cell, [0, 0, 0, 0], shade);
      }
    }
  }

  // The flat water beyond the ring: four strips framing it, out to SEA_SPAN times the grid round its middle.
  const cx = width / 2;
  const cz = depth / 2;
  const x0 = cx - (width * SEA_SPAN) / 2;
  const x1 = cx + (width * SEA_SPAN) / 2;
  const z0 = cz - (depth * SEA_SPAN) / 2;
  const z1 = cz + (depth * SEA_SPAN) / 2;
  const ix0 = -SEA_RING;
  const ix1 = width + SEA_RING;
  const iz0 = -SEA_RING;
  const iz1 = depth + SEA_RING;
  const strip = (ax: number, az: number, bx: number, bz: number) =>
    water.quad([[ax, y, az], [ax, y, bz], [bx, y, bz], [bx, y, az]], [0, 1, 0], [ax, az], [0, 0, 0, 0], flat);
  strip(x0, z0, x1, iz0); // north
  strip(x0, iz1, x1, z1); // south
  strip(x0, iz0, ix0, iz1); // west
  strip(ix1, iz0, x1, iz1); // east

  return { water: water.build(), seabed: seabed.build() };
}
