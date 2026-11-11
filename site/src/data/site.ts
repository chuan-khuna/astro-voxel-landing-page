/**
 * The site data module: company identity, the default Seed and the Landmark
 * list. All mock data for a fictional company. Edit here; nothing of this is
 * hardcoded anywhere else in the site.
 */
import type { BiomeId, LandmarkId } from '../world';

export interface Landmark {
  id: LandmarkId;
  /** Route of the section this Landmark opens. */
  route: string;
  /** Label in the Landmark menu. */
  label: string;
  /** Position in the Story Order, from 1. Fixed; never depends on the Seed. */
  storyOrder: number;
}

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
    name: 'Lanternfish Data',
    tagline: 'We turn raw data into insight, and insight into value. Reproducibly.',
    email: 'hello@lanternfish.example',
    phone: '+1 555 0142',
    address: '12 Harbour Row, Port Meridian',
    socials: [
      { label: 'GitHub', url: 'https://github.com/lanternfish-data-example' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/company/lanternfish-data-example' },
    ],
  },
  brand: {
    /** Brand colour, OKLCH. Fixed; never changes with the Biome. */
    colour: 'oklch(0.55 0.09 235)',
    font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  seo: {
    title: 'Lanternfish Data: data and AI engineering',
    description: 'A data and AI studio, told as a walk across a small generated World.',
  },
  /** The Seed visitors see first. Also used for an empty or too-long Seed. */
  defaultSeed: 'lanternfish',
  /**
   * The brand's main Biome. The default Seed always gets it, whatever the
   * Seed string is; every other Seed picks its Biome from the Seed.
   */
  brandBiome: 'tropical' satisfies BiomeId as BiomeId,
  /** The Landmark list: id, route, label and Story Order. */
  landmarks,
};

/** The Landmark list sorted by Story Order. */
export const landmarksInStoryOrder: Landmark[] = site.landmarks.toSorted((a, b) => a.storyOrder - b.storyOrder);
