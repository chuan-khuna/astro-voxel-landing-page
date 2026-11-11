/** `/robots.txt`: every crawler may index the whole site; it names the sitemap. */
import type { APIRoute } from 'astro';
import { site } from '@/data/site';
import { robotsTxt } from '@/lib/seo';

export const GET: APIRoute = () => new Response(robotsTxt(site.url), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
