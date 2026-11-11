import { describe, expect, it } from 'vitest';
import { landmarkForPath, routeView } from './landmarkRoutes';
import { site } from '../data/site';

describe('landmarkForPath', () => {
  it('maps each Landmark route to its Landmark', () => {
    expect(landmarkForPath('/')).toBe('overview');
    expect(landmarkForPath('/services')).toBe('station');
    expect(landmarkForPath('/about')).toBe('house');
    expect(landmarkForPath('/about/team')).toBe('house-interior');
    expect(landmarkForPath('/garden')).toBe('garden');
    expect(landmarkForPath('/dock')).toBe('dock');
    expect(landmarkForPath('/contact')).toBe('mailbox');
  });

  it('ignores a trailing slash and index.html, as static hosts serve them', () => {
    expect(landmarkForPath('/about/')).toBe('house');
    expect(landmarkForPath('/about/team/')).toBe('house-interior');
    expect(landmarkForPath('/contact/index.html')).toBe('mailbox');
    expect(landmarkForPath('/index.html')).toBe('overview');
  });

  it('maps a page below a section to that section, e.g. one Project in the Garden', () => {
    expect(landmarkForPath('/garden/tide-forecasting')).toBe('garden');
  });

  it('has no Landmark for an unknown route', () => {
    expect(landmarkForPath('/careers')).toBeNull();
    expect(landmarkForPath('/aboutus')).toBeNull();
  });

  it('follows the Landmark list in the site data module', () => {
    for (const landmark of site.landmarks) expect(landmarkForPath(landmark.route)).toBe(landmark.id);
  });
});

describe('routeView', () => {
  it('opens the House on About and Team: the roof lifts and the camera looks into the room', () => {
    expect(routeView('house')).toEqual({ focus: 'house-interior', interior: true });
    expect(routeView('house-interior')).toEqual({ focus: 'house-interior', interior: true });
  });

  it('keeps the House shut everywhere else, the camera on the route\'s own Landmark', () => {
    for (const id of ['overview', 'station', 'garden', 'dock', 'mailbox'] as const) {
      expect(routeView(id)).toEqual({ focus: id, interior: false });
    }
  });
});
