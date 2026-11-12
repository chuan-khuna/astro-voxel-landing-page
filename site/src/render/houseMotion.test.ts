import { describe, expect, it } from 'vitest';
import { ROOF_LIFT, developerPose, openingStep, roofLift } from './houseMotion';

describe('roofLift', () => {
  it('sits on the House when shut and ROOF_LIFT above it when open', () => {
    expect(roofLift(0)).toBe(0);
    expect(roofLift(1)).toBeCloseTo(ROOF_LIFT);
  });

  it('rises smoothly: never down, never past the top, eased at both ends', () => {
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const lift = roofLift(i / 100);
      expect(lift).toBeGreaterThanOrEqual(last);
      expect(lift).toBeLessThanOrEqual(ROOF_LIFT + 1e-9);
      last = lift;
    }
    expect(roofLift(0.05)).toBeLessThan(ROOF_LIFT * 0.05);
    expect(roofLift(0.95)).toBeGreaterThan(ROOF_LIFT * 0.95);
  });

  it('holds still outside 0–1', () => {
    expect(roofLift(-1)).toBe(0);
    expect(roofLift(2)).toBeCloseTo(ROOF_LIFT);
  });
});

describe('openingStep', () => {
  it('moves the opening towards open or shut over `ms`, and stops there', () => {
    expect(openingStep(0, 1, 100, 400)).toBeCloseTo(0.25);
    expect(openingStep(0.9, 1, 200, 400)).toBe(1);
    expect(openingStep(1, 0, 100, 400)).toBeCloseTo(0.75);
    expect(openingStep(0.1, 0, 200, 400)).toBe(0);
  });

  it('stops part-way when the target is part-way (the lid led by the scroll)', () => {
    expect(openingStep(0, 0.4, 100, 100)).toBeCloseTo(0.4);
    expect(openingStep(1, 0.4, 100, 400)).toBeCloseTo(0.75);
  });

  it('cuts when there is no time to move in (reduced motion)', () => {
    expect(openingStep(0, 1, 16, 0)).toBe(1);
    expect(openingStep(1, 0, 16, 0)).toBe(0);
  });
});

describe('developerPose', () => {
  const times = Array.from({ length: 2000 }, (_, i) => i * 0.01);

  it('types: each hand taps up and down, by at most a third of a ¼ voxel, and never both at once', () => {
    for (const t of times) {
      const { leftHand, rightHand } = developerPose(t);
      for (const hand of [leftHand, rightHand]) {
        expect(hand.y).toBeGreaterThanOrEqual(0);
        expect(hand.y).toBeLessThanOrEqual(1 / 16); // one Interior voxel
      }
      expect(leftHand.y > 0 && rightHand.y > 0, `t=${t}`).toBe(false);
    }
    expect(times.some((t) => developerPose(t).leftHand.y > 0.04)).toBe(true);
    expect(times.some((t) => developerPose(t).rightHand.y > 0.04)).toBe(true);
  });

  it('pauses now and then to read the screen: hands still, head nodding', () => {
    const still = times.filter((t) => developerPose(t).leftHand.y === 0 && developerPose(t).rightHand.y === 0);
    expect(still.length).toBeGreaterThan(times.length * 0.15);
    const nods = times.map((t) => developerPose(t).head.y);
    expect(Math.max(...nods)).toBeGreaterThan(0);
    for (const y of nods) expect(Math.abs(y)).toBeLessThanOrEqual(1 / 16);
  });

  it('moves smoothly: no part jumps between frames at 60 fps', () => {
    for (let t = 0; t < 20; t += 1 / 60) {
      const a = developerPose(t);
      const b = developerPose(t + 1 / 60);
      for (const part of ['head', 'leftHand', 'rightHand'] as const) expect(Math.abs(b[part].y - a[part].y)).toBeLessThan(0.03);
    }
  });

  it('is the rest pose at time 0, as shown under reduced motion', () => {
    expect(developerPose(0)).toEqual({ head: { y: 0 }, leftHand: { y: 0 }, rightHand: { y: 0 } });
  });
});
