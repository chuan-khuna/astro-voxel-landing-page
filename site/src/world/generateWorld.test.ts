import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateWorld, type ContentCounts } from './index';

const counts: ContentCounts = { projects: 6, clients: 5, partners: 3 };
const PLACED = ['station', 'house', 'garden', 'dock', 'mailbox'];
const sampledSeeds = Array.from({ length: 200 }, (_, i) => `seed-${i * 7919}`);

describe('generateWorld', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives a deep-equal World for the same Seed and content counts', () => {
    expect(generateWorld('harbour', counts)).toEqual(generateWorld('harbour', counts));
    expect(generateWorld('12345', counts)).toEqual(generateWorld('12345', counts));
  });

  it('never uses Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    expect(() => generateWorld('harbour', counts)).not.toThrow();
  });

  it('gives different Worlds for different Seeds', () => {
    const worlds = ['a', 'b', 'c', 'd', 'e'].map((s) => JSON.stringify({ ...generateWorld(s, counts), seed: '' }));
    expect(new Set(worlds).size).toBeGreaterThan(1);
  });

  it('places each of the five placed Landmarks exactly once, for every sampled Seed', () => {
    for (const seed of sampledSeeds) {
      const ids = generateWorld(seed, counts).landmarks.map((l) => l.id);
      expect(ids.toSorted(), seed).toEqual(PLACED.toSorted());
    }
  });

  it('puts every placed Landmark on land of the Isle it names', () => {
    for (const seed of sampledSeeds) {
      const { terrain, landmarks } = generateWorld(seed, counts);
      for (const l of landmarks) {
        const i = l.cell.z * terrain.width + l.cell.x;
        expect(terrain.isle[i], `${seed} ${l.id}`).toBe(l.isle);
        expect(terrain.heights[i], `${seed} ${l.id}`).toBeGreaterThan(0);
        expect(l.y).toBe(terrain.heights[i]);
      }
    }
  });

  it('never stacks two placed Landmarks on one cell', () => {
    for (const seed of sampledSeeds) {
      const cells = generateWorld(seed, counts).landmarks.map((l) => `${l.cell.x},${l.cell.z}`);
      expect(new Set(cells).size, seed).toBe(cells.length);
    }
  });

  it('defines the two derived views, Overview and House Interior', () => {
    for (const seed of sampledSeeds) {
      const { views, landmarks } = generateWorld(seed, counts);
      expect(views.overview.radius).toBeGreaterThan(0);
      expect(views['house-interior'].radius).toBeGreaterThan(0);
      const house = landmarks.find((l) => l.id === 'house')!;
      // House Interior is derived from the House's position.
      expect(Math.floor(views['house-interior'].target.x)).toBe(house.cell.x);
      expect(Math.floor(views['house-interior'].target.z)).toBe(house.cell.z);
    }
  });

  it('frames every Landmark inside the Overview', () => {
    for (const seed of sampledSeeds) {
      const { views, landmarks } = generateWorld(seed, counts);
      const { target, radius } = views.overview;
      for (const l of landmarks) {
        expect(Math.abs(l.cell.x + 0.5 - target.x), `${seed} ${l.id}`).toBeLessThanOrEqual(radius);
        expect(Math.abs(l.cell.z + 0.5 - target.z), `${seed} ${l.id}`).toBeLessThanOrEqual(radius);
      }
    }
  });

  it('generates one flat Isle surrounded by sea', () => {
    const { isles, terrain } = generateWorld('harbour', counts);
    expect(isles).toHaveLength(1);
    const landHeights = new Set(terrain.heights.filter((h) => h > 0));
    expect(landHeights.size).toBe(1);
    // The grid's outer ring is sea.
    for (let x = 0; x < terrain.width; x++) {
      expect(terrain.isle[x]).toBe(-1);
      expect(terrain.isle[(terrain.depth - 1) * terrain.width + x]).toBe(-1);
    }
  });

  it('handles content counts of zero and large counts', () => {
    for (const c of [
      { projects: 0, clients: 0, partners: 0 },
      { projects: 500, clients: 500, partners: 500 },
    ]) {
      expect(generateWorld('harbour', c).landmarks).toHaveLength(5);
    }
  });
});
