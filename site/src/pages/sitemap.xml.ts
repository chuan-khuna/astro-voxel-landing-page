/**
 * `/sitemap.xml`: every page of the site, as canonical URLs, for search
 * engines: each Landmark's route in Story Order, then each Project's page
 * in Garden order (Pinned Projects first, each by id). `robots.txt` points here.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { landmarksInStoryOrder, site } from '@/data/site';
import { projectOrder } from '@/lib/gardenPlants';
import { sitemapXml } from '@/lib/seo';

export const GET: APIRoute = async () => {
  const garden = site.landmarks.find((l) => l.id === 'garden')!;
  const projects = projectOrder(await getCollection('projects'));
  const paths = [...landmarksInStoryOrder.map((l) => l.route), ...projects.map((p) => `${garden.route}/${p.id}`)];
  return new Response(sitemapXml(site.url, paths), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
