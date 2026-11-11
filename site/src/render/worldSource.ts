/**
 * Main-thread side of the World Web Worker: asks the worker for a Seed's
 * World plus its chunk meshes, and caches the result per Seed (and content
 * counts), so going back to an earlier Seed is instant.
 *
 * If a Worker cannot start, it generates on the main thread instead.
 */
import { generateWorld, type ContentCounts, type World } from '@/world';
import { meshWorld, type MeshedWorld } from './worldVoxels';

export interface WorldRequest {
  id: number;
  seed: string;
  counts: ContentCounts;
}

export type WorldResponse =
  | { id: number; world: World; meshed: MeshedWorld; ms: number; generateMs: number; error?: undefined }
  | { id: number; error: string };

export interface LoadedWorld {
  world: World;
  meshed: MeshedWorld;
  /** Time to generate and mesh, in ms (worker time; 0 when served from the cache). */
  ms: number;
  /** Time to generate alone, in ms, when the World was built (kept on a cache hit). */
  generateMs: number;
}

/** Worlds kept in the cache; the oldest is dropped beyond this. */
const CACHE_SIZE = 16;

export interface WorldSource {
  load(seed: string, counts: ContentCounts): Promise<LoadedWorld>;
  dispose(): void;
}

export function createWorldSource(): WorldSource {
  const cache = new Map<string, Promise<LoadedWorld>>();
  const pending = new Map<number, { resolve: (w: LoadedWorld) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorldResponse>) => {
      const response = event.data;
      const request = pending.get(response.id);
      if (!request) return;
      pending.delete(response.id);
      if (response.error !== undefined) request.reject(new Error(response.error));
      else request.resolve({ world: response.world, meshed: response.meshed, ms: response.ms, generateMs: response.generateMs });
    };
    worker.onerror = (event) => {
      for (const request of pending.values()) request.reject(new Error(`World worker failed: ${event.message}`));
      pending.clear();
    };
  } catch {
    worker = null;
  }

  const build = (seed: string, counts: ContentCounts): Promise<LoadedWorld> => {
    if (!worker) {
      const started = performance.now();
      const world = generateWorld(seed, counts);
      const generateMs = performance.now() - started;
      return Promise.resolve({ world, meshed: meshWorld(world), ms: performance.now() - started, generateMs });
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, seed, counts } satisfies WorldRequest);
    });
  };

  return {
    load(seed, counts) {
      const key = `${seed}\u0000${JSON.stringify(counts)}`;
      const hit = cache.get(key);
      if (hit) {
        // Refresh its place in the cache, and report no build time.
        cache.delete(key);
        cache.set(key, hit);
        return hit.then((loaded) => ({ ...loaded, ms: 0 }));
      }
      const loading = build(seed, counts);
      cache.set(key, loading);
      loading.catch(() => cache.delete(key));
      while (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
      return loading;
    },
    dispose() {
      worker?.terminate();
      cache.clear();
    },
  };
}
