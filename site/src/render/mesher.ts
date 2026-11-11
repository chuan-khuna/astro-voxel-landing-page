/**
 * The mesher: a sparse voxel grid in, chunked triangle buffers out. Pure
 * TypeScript with no three.js, so it can move into a Web Worker later.
 *
 * - Hidden faces are culled: a face is emitted only when the cell in front of
 *   it is empty (in this grid and in `solidOutside`).
 * - Vertex AO is baked into the vertex colours: each face corner is darkened by
 *   how many of the three cells around it (two sides and the corner) are solid.
 * - Same-colour coplanar faces are greedy-merged into larger quads. Faces only
 *   merge when their colour and all four corner AO values match, so merging
 *   never changes the baked AO. The per-voxel look (seams, bevel, jitter) is
 *   drawn by the shader from world position, so merged quads still read as
 *   single voxels.
 */
import type { Rgb } from './palette';

/** Coordinates go from -OFFSET to SPAN - OFFSET - 1 on every axis. */
const OFFSET = 4096;
const SPAN = 8192;

const key = (x: number, y: number, z: number) => x + OFFSET + (y + OFFSET) * SPAN + (z + OFFSET) * SPAN * SPAN;

/**
 * A sparse grid of voxels, each `size` world units wide, holding a colour id
 * (an index into the colour list passed to `meshVoxels`). Voxel (x, y, z)
 * spans world `[x·size, (x+1)·size)` on each axis.
 */
export class VoxelGrid {
  readonly size: number;
  private readonly cells = new Map<number, { x: number; y: number; z: number; colour: number }>();

  constructor(size: number) {
    this.size = size;
  }

  get count(): number {
    return this.cells.size;
  }

  set(x: number, y: number, z: number, colour: number): void {
    this.cells.set(key(x, y, z), { x, y, z, colour });
  }

  delete(x: number, y: number, z: number): void {
    this.cells.delete(key(x, y, z));
  }

  has(x: number, y: number, z: number): boolean {
    return this.cells.has(key(x, y, z));
  }

  get(x: number, y: number, z: number): number | undefined {
    return this.cells.get(key(x, y, z))?.colour;
  }

  /** Fill the half-open box [x0, x1) × [y0, y1) × [z0, z1); `null` clears it. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, colour: number | null): void {
    for (let x = x0; x < x1; x++) {
      for (let y = y0; y < y1; y++) {
        for (let z = z0; z < z1; z++) {
          if (colour === null) this.delete(x, y, z);
          else this.set(x, y, z, colour);
        }
      }
    }
  }

  voxels(): IterableIterator<{ x: number; y: number; z: number; colour: number }> {
    return this.cells.values();
  }
}

export interface MeshOptions {
  /** Linear sRGB per colour id. */
  colours: readonly Rgb[];
  /** 0 = no AO, 1 = fully dark corners. */
  aoStrength: number;
  /** Chunk edge length, in voxels of this grid. */
  chunkSize: number;
  /**
   * Extra solid cells outside this grid, in this grid's voxel coordinates
   * (e.g. terrain under ¼-unit voxels). They hide faces and darken AO but are
   * not meshed.
   */
  solidOutside?: (x: number, y: number, z: number) => boolean;
}

/** One chunk's geometry, in world units. Triangles are counter-clockwise from outside. */
export interface ChunkMesh {
  positions: Float32Array;
  normals: Float32Array;
  colours: Float32Array;
  indices: Uint32Array;
  /** Quads after merging. Each quad is two triangles. */
  quads: number;
}

/** Face corners in (u, w), counter-clockwise when seen from the +axis side. */
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
] as const;

/** Mesh a grid into one `ChunkMesh` per non-empty chunk. */
export function meshVoxels(grid: VoxelGrid, options: MeshOptions): ChunkMesh[] {
  const chunks = new Map<string, { x: number; y: number; z: number }[]>();
  const c = options.chunkSize;
  for (const v of grid.voxels()) {
    const id = `${Math.floor(v.x / c)},${Math.floor(v.y / c)},${Math.floor(v.z / c)}`;
    let list = chunks.get(id);
    if (!list) chunks.set(id, (list = []));
    list.push(v);
  }
  const meshes: ChunkMesh[] = [];
  for (const voxels of chunks.values()) {
    const mesh = meshChunk(grid, voxels, options);
    if (mesh.quads > 0) meshes.push(mesh);
  }
  return meshes;
}

function meshChunk(grid: VoxelGrid, voxels: { x: number; y: number; z: number }[], options: MeshOptions): ChunkMesh {
  const outside = options.solidOutside;
  const solid = (p: number[]) => grid.has(p[0]!, p[1]!, p[2]!) || (outside?.(p[0]!, p[1]!, p[2]!) ?? false);

  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of voxels) {
    const p = [v.x, v.y, v.z];
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, p[i]!);
      hi[i] = Math.max(hi[i]!, p[i]!);
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  let quads = 0;
  const s = grid.size;

  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3;
    const w = (a + 2) % 3;
    const nu = hi[u]! - lo[u]! + 1;
    const nw = hi[w]! - lo[w]! + 1;
    const mask = new Int32Array(nu * nw);
    for (const sign of [1, -1]) {
      for (let d = lo[a]!; d <= hi[a]!; d++) {
        // 1. Mask: one entry per visible face in this slice, 0 for none.
        //    Value = 1 + colour·256 + the four corner AO levels (2 bits each).
        mask.fill(0);
        let any = false;
        for (let iw = 0; iw < nw; iw++) {
          for (let iu = 0; iu < nu; iu++) {
            const p = [0, 0, 0];
            p[a] = d;
            p[u] = lo[u]! + iu;
            p[w] = lo[w]! + iw;
            const colour = grid.get(p[0]!, p[1]!, p[2]!);
            if (colour === undefined) continue;
            const q = [...p];
            q[a] = q[a]! + sign;
            if (solid(q)) continue;
            let aoBits = 0;
            CORNERS.forEach(([cu, cw], k) => {
              const s1 = [...q];
              s1[u] = s1[u]! + (cu ? 1 : -1);
              const s2 = [...q];
              s2[w] = s2[w]! + (cw ? 1 : -1);
              const cc = [...q];
              cc[u] = cc[u]! + (cu ? 1 : -1);
              cc[w] = cc[w]! + (cw ? 1 : -1);
              const o1 = solid(s1) ? 1 : 0;
              const o2 = solid(s2) ? 1 : 0;
              const oc = solid(cc) ? 1 : 0;
              const open = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
              aoBits |= open << (k * 2);
            });
            mask[iw * nu + iu] = 1 + colour * 256 + aoBits;
            any = true;
          }
        }
        if (!any) continue;

        // 2. Greedy merge: grow each face along u, then along w.
        for (let iw = 0; iw < nw; iw++) {
          for (let iu = 0; iu < nu; ) {
            const value = mask[iw * nu + iu]!;
            if (value === 0) {
              iu++;
              continue;
            }
            let width = 1;
            while (iu + width < nu && mask[iw * nu + iu + width] === value) width++;
            let height = 1;
            grow: while (iw + height < nw) {
              for (let k = 0; k < width; k++) if (mask[(iw + height) * nu + iu + k] !== value) break grow;
              height++;
            }
            for (let h = 0; h < height; h++) mask.fill(0, (iw + h) * nu + iu, (iw + h) * nu + iu + width);

            emitQuad(a, u, w, sign, d, lo[u]! + iu, lo[w]! + iw, width, height, value);
            iu += width;
          }
        }
      }
    }
  }

  function emitQuad(
    a: number,
    u: number,
    w: number,
    sign: number,
    d: number,
    u0: number,
    w0: number,
    width: number,
    height: number,
    value: number,
  ) {
    const colourId = Math.floor((value - 1) / 256);
    const aoBits = (value - 1) % 256;
    const rgb = options.colours[colourId] ?? [1, 0, 1];
    const base = positions.length / 3;
    const order = sign > 0 ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const ao: number[] = [];
    for (const k of order) {
      const [cu, cw] = CORNERS[k]!;
      const p = [0, 0, 0];
      p[a] = d + (sign > 0 ? 1 : 0);
      p[u] = u0 + cu * width;
      p[w] = w0 + cw * height;
      positions.push(p[0]! * s, p[1]! * s, p[2]! * s);
      const n = [0, 0, 0];
      n[a] = sign;
      normals.push(n[0]!, n[1]!, n[2]!);
      const open = ((aoBits >> (k * 2)) & 3) / 3;
      ao.push(open);
      const shade = 1 + (open - 1) * options.aoStrength;
      colours.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade);
    }
    // Flip the diagonal so AO interpolates without anisotropy.
    if (ao[0]! + ao[2]! < ao[1]! + ao[3]!) indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    quads++;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colours: new Float32Array(colours),
    indices: new Uint32Array(indices),
    quads,
  };
}

/** Total triangles over a set of chunk meshes. */
export function triangleCount(meshes: readonly ChunkMesh[]): number {
  return meshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
}
