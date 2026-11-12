/**
 * Every predefined voxel structure (ADR 0004), parsed at build time from the
 * `*.structure` files beside this module (see `parse.ts` for the format).
 */
import type { BiomeId } from '@/world/types';
import type { Structure } from './parse';

const modules = import.meta.glob<Structure>('./**/*.structure', { eager: true, import: 'default' });

/** Every structure, by file path (`./house/tropical-1.structure`). */
export const STRUCTURE_FILES: Readonly<Record<string, Structure>> = modules;

/** Every structure, sorted by kind, Biome and Variant. */
export const STRUCTURES: readonly Structure[] = Object.values(modules).toSorted(
  (a, b) => a.kind.localeCompare(b.kind) || (a.biome ?? '').localeCompare(b.biome ?? '') || a.variant - b.variant,
);

/** The Variants of one kind of structure in a Biome, in Variant order. */
export function variantsOf(kind: string, biome: BiomeId): Structure[] {
  return STRUCTURES.filter((s) => s.kind === kind && (s.biome === biome || s.biome === null));
}

export type { Structure } from './parse';
