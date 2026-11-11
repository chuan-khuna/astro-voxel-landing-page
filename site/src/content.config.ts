import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LANDMARK_IDS } from './world';

/**
 * `pages`: copy that is not a content item of its own — the home hook now;
 * Landmark intro copy and Guide Tour lines in later tickets.
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    /** The Landmark this copy introduces; absent for the home hook. */
    landmark: z.enum(LANDMARK_IDS).optional(),
  }),
});

export const collections = { pages };
