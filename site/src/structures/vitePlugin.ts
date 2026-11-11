/**
 * The build-time step for structure files (ADR 0004): a Vite plugin that
 * turns each `*.structure` file into a module whose default export is the
 * parsed `Structure`, its voxels a `Uint8Array` decoded from base64. The
 * browser never parses ASCII.
 *
 * Used by `astro.config.mjs` (for pages and for the World Web Worker's
 * bundle) and `vitest.config.ts`.
 */
import { basename } from 'node:path';
import type { Plugin } from 'vite';
import { parseStructure, type Structure } from './parse';

/** The module source for a parsed structure. */
export function structureModule(structure: Structure): string {
  const { voxels, ...data } = structure;
  const base64 = Buffer.from(voxels).toString('base64');
  return [
    `const voxels = Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0));`,
    `export default { ...${JSON.stringify(data)}, voxels };`,
  ].join('\n');
}

export function structurePlugin(): Plugin {
  return {
    name: 'voxel-structures',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]!;
      if (!file.endsWith('.structure')) return null;
      return { code: structureModule(parseStructure(code, basename(file))), map: null };
    },
  };
}
