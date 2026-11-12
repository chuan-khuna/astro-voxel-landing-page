import { describe, expect, it } from 'vitest';
import { canonicalUrl, pageMeta, robotsTxt, sitemapXml } from './seo';

const SITE = 'https://lighthouse.example';

describe('canonicalUrl', () => {
  it('puts a route on the site URL, with no trailing slash', () => {
    expect(canonicalUrl(SITE, '/services')).toBe('https://lighthouse.example/services');
    expect(canonicalUrl(SITE, '/about/team/')).toBe('https://lighthouse.example/about/team');
    expect(canonicalUrl(`${SITE}/`, '/garden/tide-forecasting')).toBe('https://lighthouse.example/garden/tide-forecasting');
  });
  it('keeps the home page as the bare site URL with its slash', () => {
    expect(canonicalUrl(SITE, '/')).toBe('https://lighthouse.example/');
    expect(canonicalUrl(SITE, '')).toBe('https://lighthouse.example/');
  });
  it('drops index.html, a query and a hash', () => {
    expect(canonicalUrl(SITE, '/dock/index.html')).toBe('https://lighthouse.example/dock');
    expect(canonicalUrl(SITE, '/garden?seed=1234#x')).toBe('https://lighthouse.example/garden');
  });
});

describe('pageMeta', () => {
  const meta = pageMeta({
    siteUrl: SITE,
    siteName: 'Lighthouse Data',
    locale: 'en',
    path: '/services/',
    title: 'Services · Lighthouse Data',
    description: 'What we build.',
    image: { src: '/stills/og-world-day.jpg', alt: 'The World from above', width: 1200, height: 630, type: 'image/jpeg' },
  });
  const content = (attr: string, key: string) => meta.tags.filter((t) => t.attr === attr && t.key === key).map((t) => t.content);

  it('gives the canonical URL', () => {
    expect(meta.canonical).toBe('https://lighthouse.example/services');
  });
  it('gives the Open Graph tags, with the same title, description and URL', () => {
    expect(content('property', 'og:type')).toEqual(['website']);
    expect(content('property', 'og:site_name')).toEqual(['Lighthouse Data']);
    expect(content('property', 'og:locale')).toEqual(['en']);
    expect(content('property', 'og:title')).toEqual(['Services · Lighthouse Data']);
    expect(content('property', 'og:description')).toEqual(['What we build.']);
    expect(content('property', 'og:url')).toEqual(['https://lighthouse.example/services']);
  });
  it('gives the image as an absolute URL with its size, type and alt text', () => {
    expect(content('property', 'og:image')).toEqual(['https://lighthouse.example/stills/og-world-day.jpg']);
    expect(content('property', 'og:image:width')).toEqual(['1200']);
    expect(content('property', 'og:image:height')).toEqual(['630']);
    expect(content('property', 'og:image:type')).toEqual(['image/jpeg']);
    expect(content('property', 'og:image:alt')).toEqual(['The World from above']);
  });
  it('gives a large-image Twitter card with the same title, description and image', () => {
    expect(content('name', 'twitter:card')).toEqual(['summary_large_image']);
    expect(content('name', 'twitter:title')).toEqual(['Services · Lighthouse Data']);
    expect(content('name', 'twitter:description')).toEqual(['What we build.']);
    expect(content('name', 'twitter:image')).toEqual(['https://lighthouse.example/stills/og-world-day.jpg']);
    expect(content('name', 'twitter:image:alt')).toEqual(['The World from above']);
  });
  it('marks the image tags, so a build without the image can take them out', () => {
    const marked = meta.tags.filter((t) => t.image).map((t) => t.key);
    expect(marked.sort()).toEqual(
      ['og:image', 'og:image:alt', 'og:image:height', 'og:image:type', 'og:image:width', 'twitter:image', 'twitter:image:alt'].sort(),
    );
  });
  it('leaves out the size and type of an image that has none, and keeps an absolute image URL', () => {
    const cover = pageMeta({
      siteUrl: SITE,
      siteName: 'Lighthouse Data',
      locale: 'en',
      path: '/garden/x',
      title: 'X',
      description: 'Y',
      image: { src: 'https://cdn.example/cover.png', alt: 'Cover' },
    });
    const keys = cover.tags.map((t) => t.key);
    expect(keys).not.toContain('og:image:width');
    expect(keys).not.toContain('og:image:type');
    expect(cover.tags.find((t) => t.key === 'og:image')?.content).toBe('https://cdn.example/cover.png');
  });
});

describe('sitemapXml', () => {
  it('lists every route once, as canonical URLs, in the order given', () => {
    expect(sitemapXml(SITE, ['/', '/services/', '/garden/a&b', '/services'])).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '<url><loc>https://lighthouse.example/</loc></url>',
        '<url><loc>https://lighthouse.example/services</loc></url>',
        '<url><loc>https://lighthouse.example/garden/a&amp;b</loc></url>',
        '</urlset>',
        '',
      ].join('\n'),
    );
  });
});

describe('robotsTxt', () => {
  it('lets every crawler in and points at the sitemap', () => {
    expect(robotsTxt(SITE)).toBe('User-agent: *\nAllow: /\n\nSitemap: https://lighthouse.example/sitemap.xml\n');
  });
});
