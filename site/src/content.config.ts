import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LANDMARK_IDS } from './world';
import { projectSchema } from './lib/contentSchemas';

/**
 * `pages`: copy that is not a content item of its own: the home hook and
 * each Landmark section's intro copy (Guide Tour lines in a later ticket).
 */
const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    /** The Landmark this copy introduces; absent for the home hook. */
    landmark: z.enum(LANDMARK_IDS).optional(),
    /** Meta description of the section page; the site's default when absent. */
    description: z.string().optional(),
  }),
});

/**
 * `projects`: one MDX file per Project; the body is its case study. The id
 * (the file name) is its URL slug, `/garden/<id>`, and sets its tree's place
 * in the Garden (trees go in order by id).
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: projectSchema,
});

export const collections = { pages, projects };
