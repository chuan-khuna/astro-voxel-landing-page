# Content model

Everything the site says comes from two places: the **site data module**
(`site/src/data/site.ts`), for the company's identity and settings, and the
**content collections** (`site/src/content/`), for the copy and the items
it lists. Nothing about identity is hardcoded in pages or components. This
document covers what each holds, its schema, and where each piece shows:
on a page, in the World, and in a page's link preview. Paths below are
under `site/`.

## Site data module

`src/data/site.ts` exports `site` and `landmarksInStoryOrder`:

| Field | What it holds | Where it shows |
|---|---|---|
| `company` | `name`, `tagline`, `email`, `phone`, `address`, `socials` (`label`, `url`) | The name in the top bar, page titles and `og:site_name`; the tagline on the Overview; the contact details on `/contact` (`contactDetails`) |
| `brand` | `colour` (OKLCH, never changes with the Biome) and `fonts` (`body` Jersey 20, `heading` Jersey 15, with fallbacks) | `--brand`, `--font-body`, `--font-heading` on `<body>`; the logo |
| `url` | The published origin, `https://lighthouse.example` (a placeholder) | Astro's `site`; canonical URLs, `og:url`, the OG image URL, the sitemap and `robots.txt` |
| `seo` | `title` and `description` (the defaults, used by the home page), `locale` (`og:locale`; `<html lang>` is its language part) and `imageAlt` (what the World still shows) | `<head>` of every page; the World still's alt text and the OG image's |
| `defaultSeed` | `lighthouse` | The World shown without `?seed=` |
| `brandBiome` | `tropical` | The Biome the default Seed always gets |
| `guide` | `name` (Lumen) | The Guide's button, bubble and lines (`{name}`) |
| `landmarks` | One entry per Landmark: `id`, `route`, `label`, `storyOrder` | The routes, the Landmark menu, the hotspots, the Tour's steps and the sitemap |
| `dataCards` | Metrics keyed to a placed Landmark id: `value`, `label` | One Data Card per entry (see `site-project.md`, "Data Cards") |

`landmarksInStoryOrder` is `landmarks` sorted by Story Order. Landmark ids
are typed against the generator's id lists (`LANDMARK_IDS`,
`PLACED_LANDMARK_IDS`), so a typo fails `astro check`.

## Content collections

Defined in `src/content.config.ts` with Astro's content layer (glob
loaders). The schemas live in `src/lib/contentSchemas.ts`, apart from the
config so Vitest can load them (`contentSchemas.test.ts`). Content is
validated at build time: a mistake fails the build. A file's name is its
id.

| Collection | Format | Schema | One per | Shows |
|---|---|---|---|---|
| `pages` | MDX | inline in `content.config.ts` | Section of the site, plus the home hook | Intro copy, meta title and description, the Guide's and the Tour's lines |
| `projects` | MDX | `projectSchema` | Project | `/garden`, `/garden/<id>`, a tree in the Garden |
| `services` | MDX | `serviceSchema` | Service | `/services` |
| `clients` | YAML | `clientSchema` | Client | `/dock`, a moored boat |
| `partners` | YAML | `partnerSchema` | Partner | `/dock`, a sailing ship |
| `team` | MDX | `teamMemberSchema` | Team Member | `/about/team` |

## Pages

`src/content/pages/` holds the copy that is not an item of its own:
`home.mdx` (the home hook) and one intro per section, found by its
`landmark`: `services.mdx` (station), `about.mdx` (house), `team.mdx`
(house-interior), `garden.mdx`, `dock.mdx`, `contact.mdx` (mailbox). The
build fails if a section of the Landmark list has no entry.

| Field | Type |
|---|---|
| `title` | string: the panel's heading, and the page title as `<title> · <company>` |
| `landmark` | optional Landmark id; absent for the home hook |
| `description` | optional string: the page's meta and OG description (the site's default when absent) |
| `guide` | optional, on `home.mdx` only: the Guide's lines (`guideSchema`; see `site-project.md`, "The Guide") |
| `tour` | optional: this Landmark's Tour lines (`tourLinesSchema`; `home.mdx`'s are the Overview's; see `site-project.md`, "The Tour") |

The body is the intro copy, shown in the section's panel (on the home page,
in the intro card under the tagline).

## Projects

A Project is one MDX file in `src/content/projects/`. Adding a file adds
the Project to the Garden's list, gives it a page and grows a tree (up to
24). The schema (`projectSchema`, validated at build time, so a mistake
fails the build):

| Field | Type |
|---|---|
| `title` | non-empty string |
| `summary` | non-empty string: the list entry and the page's meta and OG description |
| `client` | non-empty string: the Client's name |
| `year` | whole number, 1900–2100 |
| `tags` | list of strings, default none |
| `tree` | optional tree shape hint: `round`, `tall` or `bushy` (not drawn yet; every tree has one shape) |
| `cover` | optional `{ src, alt }`: an image under `public/`, shown on its page and the picture of its link preview (the mock Projects have none) |

**Trees.** The World generator gets only the Project count. It lays out
one tree cell per Project, in order, up to 24. The site takes Projects in
a stable order by id (`treeOrder`), so tree `k` is the `k`-th Project by
id, and a new Project whose id sorts last adds a tree without moving the
others' Projects (it may still change the World's layout; see
`world-generator.md`).

## Services

A Service is one MDX file in `src/content/services/`; adding a file adds it
to the Station's list on `/services`. The schema (`serviceSchema`):

| Field | Type |
|---|---|
| `title` | non-empty string |
| `summary` | non-empty string: one sentence under the title |
| `icon` | `pipeline`, `model`, `chart` or `platform`: a line icon drawn by `ServiceList.astro` |
| `order` | whole number from 1: the place in the list (ties go by id) |

Services do not change the World and have no pages of their own.

## Clients and Partners

A Client is one YAML file in `src/content/clients/`, a Partner one in
`src/content/partners/`; adding a file adds it to `/dock` and a boat or a
ship to the World. Mock data only: fictional names, no real brands or
logos. The schemas (`clientSchema`, `partnerSchema`):

| Collection | Field | Type |
|---|---|---|
| `clients` | `name` | non-empty string |
| `clients` | `industry` | non-empty string |
| `clients` | `logo` | optional `{ src, alt }`: an image under `public/` (initials stand in without one) |
| `partners` | `name` | non-empty string |
| `partners` | `tier` | `strategic`, `technology` or `community` (closest first) |
| `partners` | `logo` | optional `{ src, alt }`, as for Clients |

**Boats and ships.** The World generator gets only the counts. It moors one
boat per Client at the Dock, up to 12 (`MAX_BOATS`), and sails one ship per
Partner (no cap). Clients are taken in order by id, so boat `k` is the
`k`-th Client by id; Clients beyond the cap have no boat but stay on
`/dock`. Every Client's boat is the same kind for now, as is every
Partner's ship. See `world-generator.md` ("Boats", "Ships") and
`rendering-and-shading.md` ("Boats and ships").

## Team

A Team Member is one MDX file in `src/content/team/`; adding a file adds
them to Team (`/about/team`). The body is a short bio. The schema
(`teamMemberSchema`):

| Field | Type |
|---|---|
| `name` | non-empty string |
| `role` | non-empty string |
| `order` | whole number from 1: the place in the list (ties go by id) |
| `avatar` | optional `{ src, alt }`: a portrait under `public/` (initials stand in without one; the mock Team Members have none) |

Team Members do not change the World: the House always has the one
developer.

## What reaches the World

The World generator gets only counts and stable ids from content, never the
copy (`ContentCounts`: `projects`, `clients`, `partners`; see
`world-generator.md`). `WorldPage.astro` counts the collections at build
time. Services and Team Members do not change the World. Items are taken in
order by id (`treeOrder`), so adding one whose id sorts last adds a tree or
a boat without moving the others' items.

## What reaches a page's link preview

`Base.astro` builds every page's `<head>` with `pageMeta` (`src/lib/seo.ts`)
from the site data module and the page's content:

| Page | Title | Description | Image |
|---|---|---|---|
| `/` | `seo.title` | `seo.description` | The OG image (the World still) |
| A section (`/services` …) | `pages` `title` · company name | `pages` `description` | The OG image |
| A Project (`/garden/<id>`) | Project `title` · company name | Project `summary` | Its `cover` if it has one, else the OG image |

The OG image is the build-time still of the default World by Day, cut to
1200×630 (`OG_IMAGE`, `/stills/og-world-day.jpg`), with `seo.imageAlt` as
its alt text. See `site-project.md`, "SEO and link previews".
