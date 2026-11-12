/**
 * What each page says about itself to search engines and link previews:
 * its canonical URL and its Open Graph and Twitter tags. `Base.astro`
 * writes them into `<head>` from the site data module and the page's
 * content (title, description, image).
 *
 * Plain functions over strings, tested without Astro.
 */

/** The picture a link preview shows. */
export interface PageImage {
  /** A path on the site (`/stills/og-world-day.jpg`) or an absolute URL. */
  src: string;
  alt: string;
  width?: number;
  height?: number;
  /** Its media type, e.g. `image/jpeg`. */
  type?: string;
}

export interface PageMetaInput {
  /** The site's origin, e.g. `https://lighthouse.example`. */
  siteUrl: string;
  siteName: string;
  /** Open Graph locale, e.g. `en`. */
  locale: string;
  /** The page's route, e.g. `/services`. */
  path: string;
  title: string;
  description: string;
  image: PageImage;
}

/** One `<meta>` tag: `<meta property|name="key" content="…">`. */
export interface MetaTag {
  attr: 'property' | 'name';
  key: string;
  content: string;
  /** True for the tags that describe the image. */
  image?: boolean;
}

export interface PageMeta {
  canonical: string;
  tags: MetaTag[];
}

/**
 * The canonical URL of a route: on the site's origin, without a query, a
 * hash, `index.html` or a trailing slash (the home page keeps its `/`).
 */
export function canonicalUrl(siteUrl: string, path: string): string {
  const origin = siteUrl.replace(/\/+$/, '');
  const route = path
    .replace(/[?#].*$/, '')
    .replace(/(^|\/)index\.html$/, '/')
    .replace(/\/+$/, '');
  return `${origin}${route.startsWith('/') ? route : `/${route}`}`.replace(/^(https?:\/\/[^/]+)$/, '$1/');
}

/** A site path made absolute on the site's origin; an absolute URL as it is. */
function absolute(siteUrl: string, src: string): string {
  return /^https?:\/\//.test(src) ? src : new URL(src, `${siteUrl.replace(/\/+$/, '')}/`).href;
}

/** A page's canonical URL and its Open Graph and Twitter tags. */
export function pageMeta({ siteUrl, siteName, locale, path, title, description, image }: PageMetaInput): PageMeta {
  const canonical = canonicalUrl(siteUrl, path);
  const imageUrl = absolute(siteUrl, image.src);
  const og = (key: string, content: string, isImage = false): MetaTag => ({ attr: 'property', key, content, ...(isImage && { image: true }) });
  const tw = (key: string, content: string, isImage = false): MetaTag => ({ attr: 'name', key, content, ...(isImage && { image: true }) });
  const tags: MetaTag[] = [
    og('og:type', 'website'),
    og('og:site_name', siteName),
    og('og:locale', locale),
    og('og:title', title),
    og('og:description', description),
    og('og:url', canonical),
    og('og:image', imageUrl, true),
    ...(image.type ? [og('og:image:type', image.type, true)] : []),
    ...(image.width && image.height
      ? [og('og:image:width', String(image.width), true), og('og:image:height', String(image.height), true)]
      : []),
    og('og:image:alt', image.alt, true),
    tw('twitter:card', 'summary_large_image'),
    tw('twitter:title', title),
    tw('twitter:description', description),
    tw('twitter:image', imageUrl, true),
    tw('twitter:image:alt', image.alt, true),
  ];
  return { canonical, tags };
}

/** Text made safe inside XML. */
function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** `sitemap.xml`: every route once, as its canonical URL, in the order given. */
export function sitemapXml(siteUrl: string, paths: readonly string[]): string {
  const urls = [...new Set(paths.map((path) => canonicalUrl(siteUrl, path)))];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

/** `robots.txt`: every crawler may index everything; the sitemap is named. */
export function robotsTxt(siteUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl(siteUrl, '/sitemap.xml')}\n`;
}
