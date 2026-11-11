/**
 * The site data module: company identity, the default Seed, the Landmark
 * list and the Data Card metrics. All mock data for a fictional company.
 * Edit here; nothing of this is hardcoded anywhere else in the site.
 */
import type { BiomeId, LandmarkId, PlacedLandmarkId } from '../world';

export interface Landmark {
  id: LandmarkId;
  /** Route of the section this Landmark opens. */
  route: string;
  /** Label in the Landmark menu. */
  label: string;
  /** Position in the Story Order, from 1. Fixed; never depends on the Seed. */
  storyOrder: number;
}

/** One company metric for a Data Card: a short figure and what it counts. */
export interface DataCardMetric {
  /** The figure, as shown, e.g. `140+`. */
  value: string;
  /** What it counts, e.g. `pipelines running in production`. */
  label: string;
}

/**
 * Data Card metrics, keyed to the id of the Landmark each card floats beside
 * (a placed Landmark: a card needs a place in the World). A Landmark with no
 * entry has no card. Mock figures for the fictional company.
 */
const dataCards: Partial<Record<PlacedLandmarkId, DataCardMetric>> = {
  station: { value: '140+', label: 'pipelines running in production' },
  house: { value: '12 years', label: 'building data systems' },
  garden: { value: '60+', label: 'projects shipped' },
  dock: { value: '9 in 10', label: 'clients come back for more' },
  mailbox: { value: '1 day', label: 'to answer every email' },
};

const landmarks: Landmark[] = [
  { id: 'overview', route: '/', label: 'Overview', storyOrder: 1 },
  { id: 'station', route: '/services', label: 'Services', storyOrder: 2 },
  { id: 'house', route: '/about', label: 'About', storyOrder: 3 },
  { id: 'house-interior', route: '/about/team', label: 'Team', storyOrder: 4 },
  { id: 'garden', route: '/garden', label: 'Projects', storyOrder: 5 },
  { id: 'dock', route: '/dock', label: 'Clients & Partners', storyOrder: 6 },
  { id: 'mailbox', route: '/contact', label: 'Contact', storyOrder: 7 },
];

export const site = {
  company: {
    name: 'Lighthouse Data',
    tagline: 'We turn raw data into insight, and insight into value. Reproducibly.',
    email: 'hello@lighthouse.example',
    phone: '+1 555 0142',
    address: '12 Harbour Row, Port Meridian',
    socials: [
      { label: 'GitHub', url: 'https://github.com/lighthouse-data-example' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/lighthouse-data-example' },
    ],
  },
  brand: {
    /** Brand colour, OKLCH. Fixed; never changes with the Biome. */
    colour: 'oklch(0.55 0.09 235)',
    /**
     * Font stacks: the pixel-style Jersey faces (self-hosted from Fontsource,
     * loaded in `Base.astro`, `font-display: swap`), then system fallbacks.
     * Jersey has one weight (400), so nothing is set bold.
     */
    fonts: {
      /** Body text: Jersey 20, drawn on a 20px grid. */
      body: '"Jersey 20", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      /** Headings (h1–h3), card titles and the company name: Jersey 15. */
      heading: '"Jersey 15", "Jersey 20", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    },
  },
  seo: {
    title: 'Lighthouse Data: data and AI engineering',
    description: 'A data and AI studio, told as a walk across a small generated World.',
  },
  /** The Seed visitors see first. Also used for an empty or too-long Seed. */
  defaultSeed: 'lighthouse',
  /**
   * The brand's main Biome. The default Seed always gets it, whatever the
   * Seed string is; every other Seed picks its Biome from the Seed.
   */
  brandBiome: 'tropical' satisfies BiomeId as BiomeId,
  /** The Landmark list: id, route, label and Story Order. */
  landmarks,
  /** Data Card metrics, keyed to a Landmark id. */
  dataCards,
};

/** The Landmark list sorted by Story Order. */
export const landmarksInStoryOrder: Landmark[] = site.landmarks.toSorted((a, b) => a.storyOrder - b.storyOrder);
