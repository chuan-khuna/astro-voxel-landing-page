/**
 * Schemas of the content collections, apart from `content.config.ts` so
 * they can be tested without Astro. Content is validated against them at
 * build time; a mistake fails the build.
 */
import { z } from 'astro/zod';

/** Tree shapes a Project can hint at. The Garden draws one shape for now. */
export const TREE_HINTS = ['round', 'tall', 'bushy'] as const;

/** A Project: one piece of past work, shown as one tree in the Garden. The MDX body is its case study. */
export const projectSchema = z.object({
  title: z.string().min(1),
  /** One or two sentences for the Garden's list and the page's meta description. */
  summary: z.string().min(1),
  /** The Client it was for, by name. */
  client: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  tags: z.array(z.string().min(1)).default([]),
  /** Which tree shape it would like in the Garden. */
  tree: z.enum(TREE_HINTS).optional(),
  /** A cover image under `public/`, with its alt text. */
  cover: z.object({ src: z.string().min(1), alt: z.string() }).optional(),
});

export type ProjectData = z.infer<typeof projectSchema>;

/** Icons a Service can show at the Station (drawn by `ServiceList.astro`). */
export const SERVICE_ICONS = ['pipeline', 'model', 'chart', 'platform'] as const;

/** A Service: a capability the company sells, shown at the Station. The MDX body says more. */
export const serviceSchema = z.object({
  title: z.string().min(1),
  /** One sentence under the title. */
  summary: z.string().min(1),
  icon: z.enum(SERVICE_ICONS),
  /** Position in the Station's list, from 1. */
  order: z.number().int().min(1),
});

export type ServiceData = z.infer<typeof serviceSchema>;

/** A logo image under `public/`, with its alt text. */
const logoSchema = z.object({ src: z.string().min(1), alt: z.string() });

/**
 * A Client: an organisation that has hired the company, shown as one boat
 * moored at the Dock. Without a logo, the Dock's page shows its initials.
 */
export const clientSchema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  logo: logoSchema.optional(),
});

export type ClientData = z.infer<typeof clientSchema>;

/** How close an alliance a Partner is, closest first. */
export const PARTNER_TIERS = ['strategic', 'technology', 'community'] as const;

/**
 * A Partner: a technology vendor the company is allied with, shown as one
 * larger ship sailing between the Isles. Never a Client.
 */
export const partnerSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(PARTNER_TIERS),
  logo: logoSchema.optional(),
});

export type PartnerData = z.infer<typeof partnerSchema>;
