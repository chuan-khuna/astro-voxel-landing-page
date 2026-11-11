import { describe, expect, it } from 'vitest';
import { projectSchema } from './contentSchemas';

const valid = {
  title: 'Tide tables that forecast themselves',
  summary: 'A forecasting pipeline for a harbour authority.',
  client: 'Port Meridian Authority',
  year: 2024,
  tags: ['forecasting', 'pipelines'],
};

describe('projectSchema', () => {
  it('accepts a Project with the required fields, and the optional tree hint and cover', () => {
    expect(projectSchema.parse(valid)).toEqual(valid);
    const full = { ...valid, tree: 'tall', cover: { src: '/covers/tide.png', alt: 'A tide chart' } };
    expect(projectSchema.parse(full)).toEqual(full);
  });

  it('defaults tags to none', () => {
    const { tags: _, ...noTags } = valid;
    expect(projectSchema.parse(noTags).tags).toEqual([]);
  });

  it('rejects a Project with a missing title, a bad year or an unknown tree hint', () => {
    const { title: _, ...noTitle } = valid;
    expect(projectSchema.safeParse(noTitle).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, year: '2024' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, year: 1899 }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, tree: 'palm-ish' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, summary: '' }).success).toBe(false);
  });
});
