/**
 * The World Web Worker: generates a World and meshes it off the main thread,
 * so rolling a Seed never freezes the page. Mesh buffers are transferred, not
 * copied. See `worldSource.ts` for the main-thread side.
 */
import { generateWorld } from '@/world';
import { meshWorld } from './worldVoxels';
import type { WorldRequest, WorldResponse } from './worldSource';

self.onmessage = (event: MessageEvent<WorldRequest>) => {
  const { id, seed, counts } = event.data;
  let response: WorldResponse;
  const transfer: Transferable[] = [];
  try {
    const started = performance.now();
    const world = generateWorld(seed, counts);
    const generateMs = performance.now() - started;
    const meshed = meshWorld(world);
    for (const chunk of [...meshed.terrain, ...meshed.detail]) {
      transfer.push(chunk.positions.buffer, chunk.normals.buffer, chunk.colours.buffer, chunk.indices.buffer);
    }
    response = { id, world, meshed, ms: performance.now() - started, generateMs };
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response, { transfer });
};
