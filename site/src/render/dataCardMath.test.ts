import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { generateWorld } from '../world';
import { landmarkFocus } from './landmarkFocus';
import { screenOffsetOf, stateShowing, type CameraLimits, type CameraState } from './cameraMath';
import { dataCardAnchors, dataCardTransform, nearestDataCard, placeDataCard } from './dataCardMath';
import { landmarkExtent } from './landmarkModels';

const counts = { projects: 6, clients: 0, partners: 0 };
const worlds = ['lanternfish', '42', '3'].map((seed) => generateWorld(seed, counts));
const open: CameraLimits = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000, minZoom: 1, maxZoom: 100 };
/** The frame's half size at zoom 1, in frame units: a 16:10 frame. */
const half = (radius: number) => ({ x: radius * 1.6, y: radius });

describe('nearestDataCard', () => {
  const cardsOf = (world: (typeof worlds)[number]) => world.landmarks.map((l) => ({ id: l.id, focus: landmarkFocus(world, l.id) }));
  const centre = { x: 0, y: 0 };

  it('picks the Landmark the camera is on, centred or beside a section panel', () => {
    for (const world of worlds) {
      const frame = half(world.views.overview.radius);
      for (const { id, focus } of cardsOf(world)) {
        const centred = stateShowing(focus.point, focus.zoom, centre, open);
        expect(nearestDataCard(centred, cardsOf(world), frame, centre), `${world.seed} ${id}`).toBe(id);
        // A side panel over the right 42% puts the Landmark in the middle of the rest:
        // that is where the visitor looks, even if a neighbour is nearer the frame's centre.
        const free = { x: -0.42 * frame.x, y: 0 };
        const besidePanel = stateShowing(focus.point, focus.zoom, free, open);
        expect(nearestDataCard(besidePanel, cardsOf(world), frame, free), `${world.seed} ${id} beside a panel`).toBe(id);
      }
    }
  });

  it('picks none at the Overview, however central a Landmark', () => {
    for (const world of worlds) {
      const frame = half(world.views.overview.radius);
      for (const { id, focus } of cardsOf(world)) {
        const overview = stateShowing(focus.point, 1, centre, open);
        expect(nearestDataCard(overview, cardsOf(world), frame, centre), `${world.seed} ${id}`).toBeNull();
      }
    }
  });

  it('never picks a Landmark at or past the edge of the frame', () => {
    for (const world of worlds) {
      const frame = half(world.views.overview.radius);
      for (const { id, focus } of cardsOf(world)) {
        const atEdge = stateShowing(focus.point, focus.zoom, { x: 0.9 * frame.x, y: 0 }, open);
        expect(nearestDataCard(atEdge, cardsOf(world), frame, centre), `${world.seed} ${id} at the edge`).not.toBe(id);
        const below = stateShowing(focus.point, focus.zoom, { x: 0, y: -0.9 * frame.y }, open);
        expect(nearestDataCard(below, cardsOf(world), frame, centre), `${world.seed} ${id} below`).not.toBe(id);
      }
    }
  });

  it('never picks a Landmark when zoomed well out from its own close-up', () => {
    const world = worlds[0]!;
    const frame = half(world.views.overview.radius);
    const focus = landmarkFocus(world, 'station');
    const farther = stateShowing(focus.point, focus.zoom * 0.5, centre, open);
    expect(nearestDataCard(farther, cardsOf(world), frame, centre)).not.toBe('station');
  });
});

describe('dataCardTransform', () => {
  const frame = { width: 1000, height: 625 };
  const card = { width: 180, height: 64 };
  const anchor = { x: 21, y: 3.5, z: 14 };

  /** A real three.js isometric camera, framed like the site's, looking at `target` on the ground. */
  function camera(target: { x: number; z: number }, zoom: number) {
    const halfHeight = 12;
    const aspect = frame.width / frame.height;
    const c = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 1000);
    const t = new THREE.Vector3(target.x, 0, target.z);
    c.position.copy(t).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), 100);
    c.lookAt(t);
    c.zoom = zoom;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    return c;
  }
  const viewProjection = (c: THREE.Camera) => new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse).elements;
  /** A world point in frame px (y down), as the hotspots place things. */
  const px = (c: THREE.Camera, p: { x: number; y: number; z: number }) => {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(c);
    return { x: ((v.x + 1) / 2) * frame.width, y: ((1 - v.y) / 2) * frame.height };
  };
  /** Where CSS puts a point (u, v) of the card under `matrix3d(m)` with origin 0 0. */
  const cssPoint = (m: number[], u: number, v: number) => {
    const w = m[3]! * u + m[7]! * v + m[15]!;
    return { x: (m[0]! * u + m[4]! * v + m[12]!) / w, y: (m[1]! * u + m[5]! * v + m[13]!) / w };
  };

  for (const zoom of [1.5, 4]) {
    it(`stands the card on its anchor, the middle of its bottom edge (zoom ${zoom})`, () => {
      const c = camera({ x: 19, z: 12 }, zoom);
      const m = dataCardTransform(viewProjection(c), frame, anchor, card);
      const at = cssPoint(m, card.width / 2, card.height);
      const expected = px(c, anchor);
      expect(at.x).toBeCloseTo(expected.x, 4);
      expect(at.y).toBeCloseTo(expected.y, 4);
    });

    it(`lays the card on the isometric plane: upright, its text rising 30° to the right (zoom ${zoom})`, () => {
      const c = camera({ x: 19, z: 12 }, zoom);
      const m = dataCardTransform(viewProjection(c), frame, anchor, card);
      const topLeft = cssPoint(m, 0, 0);
      const topRight = cssPoint(m, card.width, 0);
      const bottomLeft = cssPoint(m, 0, card.height);
      // The baseline runs along the World's −z axis: right and up the screen at 30°.
      const angle = Math.atan2(-(topRight.y - topLeft.y), topRight.x - topLeft.x);
      expect(angle).toBeCloseTo(Math.PI / 6, 6);
      // The sides stay vertical, top above bottom.
      expect(bottomLeft.x).toBeCloseTo(topLeft.x, 6);
      expect(bottomLeft.y).toBeGreaterThan(topLeft.y);
      // The card's plane is the World's: its corners are World points, upright and along −z.
      const up = px(c, { x: anchor.x, y: anchor.y + 1, z: anchor.z });
      const along = px(c, { x: anchor.x, y: anchor.y, z: anchor.z - 1 });
      const base = px(c, anchor);
      const cross = (along.x - base.x) * (up.y - base.y) - (along.y - base.y) * (up.x - base.x);
      const cardCross = (topRight.x - topLeft.x) * (topLeft.y - bottomLeft.y) - (topRight.y - topLeft.y) * (topLeft.x - bottomLeft.x);
      expect(Math.sign(cardCross)).toBe(Math.sign(cross));
    });

    it(`keeps the card's text at its own size on screen, so it stays crisp and readable (zoom ${zoom})`, () => {
      const c = camera({ x: 19, z: 12 }, zoom);
      const m = dataCardTransform(viewProjection(c), frame, anchor, card);
      const topLeft = cssPoint(m, 0, 0);
      const topRight = cssPoint(m, card.width, 0);
      const bottomLeft = cssPoint(m, 0, card.height);
      expect(Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y)).toBeCloseTo(card.width, 4);
      expect(bottomLeft.y - topLeft.y).toBeCloseTo(card.height, 4);
    });
  }

  it('flattens the card onto the screen (depth passes through, so the matrix stays invertible and CSS draws it)', () => {
    const c = camera({ x: 19, z: 12 }, 2);
    const m = dataCardTransform(viewProjection(c), frame, anchor, card);
    expect([m[2], m[6], m[10], m[14]]).toEqual([0, 0, 1, 0]);
  });
});

describe('dataCardAnchors', () => {
  /** Screen height of a World point (frame units, up); any camera state gives the same order. */
  const height = (p: { x: number; y: number; z: number }) => screenOffsetOf({ target: { x: 0, z: 0 }, zoom: 1 }, p).y;
  const corners = (l: (typeof worlds)[number]['landmarks'][number]) => {
    const { min, max } = landmarkExtent(l);
    const o = l.footprint.origin;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
      x: o.x + (i & 1 ? max.x : min.x),
      y: l.y + (i & 2 ? max.y : min.y),
      z: o.z + (i & 4 ? max.z : min.z),
    }));
  };

  it('stand over and under the middle of the footprint, just clear of everything the model draws on screen', () => {
    for (const world of worlds) {
      for (const l of world.landmarks) {
        const { origin, width, depth } = l.footprint;
        const { above, below } = dataCardAnchors(l);
        for (const a of [above, below]) {
          expect(a.x, `${world.seed} ${l.id}`).toBe(origin.x + width / 2);
          expect(a.z, `${world.seed} ${l.id}`).toBe(origin.z + depth / 2);
        }
        const top = Math.max(...corners(l).map(height));
        const bottom = Math.min(...corners(l).map(height));
        expect(height(above), `${world.seed} ${l.id} above`).toBeGreaterThan(top);
        expect(height(above), `${world.seed} ${l.id} above`).toBeLessThan(top + 1);
        expect(height(below), `${world.seed} ${l.id} below`).toBeLessThan(bottom);
        expect(height(below), `${world.seed} ${l.id} below`).toBeGreaterThan(bottom - 1);
      }
    }
  });
});

describe('placeDataCard', () => {
  const frame = { width: 1000, height: 625 };
  const card = { width: 180, height: 64 };
  const world = worlds[0]!;
  const station = world.landmarks.find((l) => l.id === 'station')!;
  const anchors = dataCardAnchors(station);
  const focus = landmarkFocus(world, 'station');
  const halfHeight = world.views.overview.radius;

  function camera(state: CameraState) {
    const aspect = frame.width / frame.height;
    const c = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 1000);
    const t = new THREE.Vector3(state.target.x, 0, state.target.z);
    c.position.copy(t).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), 100);
    c.lookAt(t);
    c.zoom = state.zoom;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    return new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse).elements;
  }
  const cssPoint = (m: number[], u: number, v: number) => ({ x: m[0]! * u + m[4]! * v + m[12]!, y: m[1]! * u + m[5]! * v + m[13]! });

  it('puts the card above its Landmark when there is room', () => {
    // The Station in the lower half of the frame.
    const vp = camera(stateShowing(focus.point, focus.zoom, { x: 0, y: -0.5 * halfHeight }, open));
    expect(placeDataCard(vp, frame, anchors, card)).toEqual(dataCardTransform(vp, frame, anchors.above, card, 'bottom'));
  });

  it('hangs the card under its Landmark when the top of the frame would cut it off', () => {
    // The Station just under the top edge of the frame.
    const vp = camera(stateShowing(focus.point, focus.zoom, { x: 0, y: 0.8 * halfHeight }, open));
    const m = placeDataCard(vp, frame, anchors, card);
    expect(m).toEqual(dataCardTransform(vp, frame, anchors.below, card, 'top'));
    // Its highest corner (the top right: the text rises to the right) is inside the frame.
    expect(cssPoint(m, card.width, 0).y).toBeGreaterThanOrEqual(0);
  });

  it('hangs a card from the middle of its top edge', () => {
    const vp = camera(stateShowing(focus.point, focus.zoom, { x: 0, y: 0 }, open));
    const fromBelow = dataCardTransform(vp, frame, anchors.below, card, 'top');
    const standing = dataCardTransform(vp, frame, anchors.below, card, 'bottom');
    const hung = cssPoint(fromBelow, card.width / 2, 0);
    const stood = cssPoint(standing, card.width / 2, card.height);
    expect(hung.x).toBeCloseTo(stood.x, 6);
    expect(hung.y).toBeCloseTo(stood.y, 6);
  });
});
