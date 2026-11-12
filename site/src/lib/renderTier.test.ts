import { describe, expect, it } from 'vitest';
import { ambientFrameDue, pixelRatio, renderTier } from './renderTier';

const phone = { coarsePointer: true, screenWidth: 393, screenHeight: 852, devicePixelRatio: 3 };
const tablet = { coarsePointer: true, screenWidth: 1024, screenHeight: 1366, devicePixelRatio: 2 };
const laptop = { coarsePointer: false, screenWidth: 1920, screenHeight: 1080, devicePixelRatio: 1.25 };

describe('renderTier', () => {
  it('gives a phone the reduced tier', () => {
    expect(renderTier(phone).name).toBe('reduced');
  });
  it('gives a desktop and a tablet the full tier', () => {
    expect(renderTier(laptop).name).toBe('full');
    expect(renderTier(tablet).name).toBe('full');
  });
});

describe('the reduced tier', () => {
  it('draws without MSAA, with a smaller shadow map, and ambient motion at 30 fps', () => {
    expect(renderTier(phone)).toMatchObject({ antialias: false, shadowMapSize: 1024, ambientFps: 30 });
  });
  it('the full tier draws everything at full rate', () => {
    expect(renderTier(laptop)).toMatchObject({ antialias: true, shadowMapSize: 2048, ambientFps: 0 });
  });
});

describe('?tier override', () => {
  it('picks a tier on any device, for measuring', () => {
    expect(renderTier(phone, 'full').name).toBe('full');
    expect(renderTier(laptop, 'reduced').name).toBe('reduced');
  });
  it('ignores anything else', () => {
    expect(renderTier(phone, 'low').name).toBe('reduced');
    expect(renderTier(laptop, null).name).toBe('full');
  });
});

describe('pixelRatio', () => {
  it('caps at 1.5 on touch devices and 2 elsewhere', () => {
    expect(pixelRatio(phone)).toBe(1.5);
    expect(pixelRatio(tablet)).toBe(1.5);
    expect(pixelRatio({ ...laptop, devicePixelRatio: 3 })).toBe(2);
  });
  it('never raises a lower device ratio', () => {
    expect(pixelRatio(laptop)).toBe(1.25);
    expect(pixelRatio({ ...phone, devicePixelRatio: 1 })).toBe(1);
  });
});

describe('ambientFrameDue', () => {
  it('lets every frame through at ambientFps 0 (the full tier)', () => {
    expect(ambientFrameDue(1016.7, 1000, 0)).toBe(true);
  });
  it('at 30 fps on a 60 Hz screen, skips every other frame', () => {
    expect(ambientFrameDue(1016.7, 1000, 30)).toBe(false);
    expect(ambientFrameDue(1033.3, 1000, 30)).toBe(true);
  });
  it('at 30 fps on a 120 Hz screen, renders one frame in four', () => {
    expect(ambientFrameDue(1025, 1000, 30)).toBe(false);
    expect(ambientFrameDue(1033.3, 1000, 30)).toBe(true);
  });
  it('lets the first frame after a still spell through', () => {
    expect(ambientFrameDue(5000, 0, 30)).toBe(true);
  });
});
