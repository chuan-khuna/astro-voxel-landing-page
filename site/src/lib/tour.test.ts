import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/data/site';
import { tourAfter, tourStage, tourSteps } from './tour';

const landmarks: Landmark[] = [
  { id: 'station', route: '/services', label: 'Services', storyOrder: 2 },
  { id: 'overview', route: '/', label: 'Overview', storyOrder: 1 },
  { id: 'house', route: '/about', label: 'About', storyOrder: 3 },
];
const line = (say: string) => ({ say, mood: 'neutral' as const });

describe('tourSteps', () => {
  it('walks the Landmarks in Story Order, each with its page’s Tour lines; the home page’s are the Overview’s', () => {
    const steps = tourSteps(landmarks, [
      { landmark: 'house', tour: [line('A house.'), line('With a lid.')] },
      { tour: [line('The whole World.')] },
      { landmark: 'station', tour: [line('Data comes in here.')] },
    ]);
    expect(steps).toEqual([
      { landmark: 'overview', label: 'Overview', route: '/', lines: [line('The whole World.')] },
      { landmark: 'station', label: 'Services', route: '/services', lines: [line('Data comes in here.')] },
      { landmark: 'house', label: 'About', route: '/about', lines: [line('A house.'), line('With a lid.')] },
    ]);
  });

  it('fails when a Landmark has no Tour lines, so a missing line fails the build', () => {
    expect(() => tourSteps(landmarks, [{ tour: [line('World.')] }, { landmark: 'station', tour: [] }])).toThrow(/station/);
  });
});

describe('tourAfter', () => {
  it('starts at the first step whatever came before', () => {
    expect(tourAfter(null, 'start', 7)).toEqual({ step: 0 });
    expect(tourAfter({ step: 4 }, 'start', 7)).toEqual({ step: 0 });
  });

  it('goes on with next and back with previous', () => {
    expect(tourAfter({ step: 2 }, 'next', 7)).toEqual({ step: 3 });
    expect(tourAfter({ step: 2 }, 'previous', 7)).toEqual({ step: 1 });
  });

  it('stays at the first step on previous, and ends after the last on next', () => {
    expect(tourAfter({ step: 0 }, 'previous', 7)).toEqual({ step: 0 });
    expect(tourAfter({ step: 6 }, 'next', 7)).toBeNull();
  });

  it('ends on exit at any step, and nothing but start begins it', () => {
    expect(tourAfter({ step: 3 }, 'exit', 7)).toBeNull();
    expect(tourAfter(null, 'next', 7)).toBeNull();
    expect(tourAfter(null, 'previous', 7)).toBeNull();
  });
});

describe('tourStage', () => {
  it('shows the House shut from outside, then opens it for the House Interior', () => {
    expect(tourStage('house')).toEqual({ focus: 'house', interior: false, guideAt: 'house' });
    expect(tourStage('house-interior')).toEqual({ focus: 'house-interior', interior: true, guideAt: 'house' });
  });

  it('keeps the Guide by the Station for the Overview, and beside every other placed Landmark', () => {
    expect(tourStage('overview')).toEqual({ focus: 'overview', interior: false, guideAt: 'station' });
    expect(tourStage('dock')).toEqual({ focus: 'dock', interior: false, guideAt: 'dock' });
    expect(tourStage('mailbox')).toEqual({ focus: 'mailbox', interior: false, guideAt: 'mailbox' });
  });
});
