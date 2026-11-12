/**
 * The camera's sight line from a ground point: the occlusion check shared by
 * Landmark placement (`landmarks.ts`) and Decoration (`decoration.ts`).
 *
 * The fixed isometric camera looks along −(1, 1, 1), so the ray from a
 * point runs towards (1, 1, 1): it climbs one unit per unit of x (and of
 * z). A column hides the point if the ray enters it below the column's top.
 */

/** Ground points checked for occlusion per cell edge: a ¼-cell grid. */
export const SAMPLES_PER_CELL = 4;

/**
 * Visit each column the ray from ground point (`px`, `pz`) passes through
 * within `reach` units of travel, with `enter`, how far the ray has climbed
 * when it enters that column. Only columns on the diagonal band ahead can
 * hold the ray. `visit` returns true to stop; so does this, if it stopped.
 */
export function forEachRayColumn(px: number, pz: number, reach: number, visit: (cx: number, cz: number, enter: number) => boolean): boolean {
  const fx = Math.floor(px);
  const fz = Math.floor(pz);
  for (let s = 0; s <= reach; s++) {
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const cx = fx + s + a;
        const cz = fz + s + b;
        // When the ray is inside this column: t in [enter, leave).
        const enter = Math.max(cx - px, cz - pz, 0);
        const leave = Math.min(cx + 1 - px, cz + 1 - pz);
        if (enter >= leave) continue;
        if (visit(cx, cz, enter)) return true;
      }
    }
  }
  return false;
}

/**
 * How high anything may stand over each cell and leave every Landmark in
 * view: for each column, the lowest height (absolute, in units) at which a
 * Landmark's sight line enters it, from every point of its ground on the
 * ¼-cell grid; Infinity where none passes. `top` is the highest anything
 * placed will reach. Shared by Decoration and particles.
 */
export function sightClearance(
  terrain: { width: number; depth: number },
  landmarks: ReadonlyArray<{ y: number; cells: ReadonlyArray<{ x: number; z: number }> }>,
  top: number,
): Float64Array {
  const { width, depth } = terrain;
  const clearance = new Float64Array(width * depth).fill(Infinity);
  for (const landmark of landmarks) {
    const reach = top - landmark.y + 2;
    for (const c of landmark.cells) {
      for (let i = 0; i <= SAMPLES_PER_CELL; i++) {
        for (let k = 0; k <= SAMPLES_PER_CELL; k++) {
          forEachRayColumn(c.x + i / SAMPLES_PER_CELL, c.z + k / SAMPLES_PER_CELL, reach, (cx, cz, enter) => {
            if (cx >= 0 && cz >= 0 && cx < width && cz < depth) {
              const i = cz * width + cx;
              clearance[i] = Math.min(clearance[i]!, landmark.y + enter);
            }
            return false;
          });
        }
      }
    }
  }
  return clearance;
}
