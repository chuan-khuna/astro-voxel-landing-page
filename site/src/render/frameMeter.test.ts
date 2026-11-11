import { describe, expect, it } from 'vitest';
import { createFrameMeter } from './frameMeter';

/** Feed frames every `step` ms from `start`, `count` of them; returns the time of the last. */
function frames(meter: ReturnType<typeof createFrameMeter>, start: number, step: number, count: number): number {
  let t = start;
  for (let i = 0; i < count; i++) {
    t = start + i * step;
    meter.frame(t);
  }
  return t;
}

describe('frame meter', () => {
  it('reads idle before any frame', () => {
    expect(createFrameMeter().read(0)).toBe('idle');
  });

  it('measures a steady 60 fps', () => {
    const meter = createFrameMeter();
    const last = frames(meter, 1000, 1000 / 60, 120);
    const reading = meter.read(last + 5);
    expect(reading).not.toBe('idle');
    if (reading === 'idle') return;
    expect(reading.fps).toBeCloseTo(60, 1);
    expect(reading.ms).toBeCloseTo(16.67, 1);
  });

  it('measures a steady 30 fps', () => {
    const meter = createFrameMeter();
    const last = frames(meter, 0, 1000 / 30, 60);
    const reading = meter.read(last);
    expect(reading !== 'idle' && Math.round(reading.fps)).toBe(30);
  });

  it('smooths: one slow frame moves the reading only part of the way', () => {
    const meter = createFrameMeter();
    const last = frames(meter, 0, 16, 60);
    meter.frame(last + 48);
    const reading = meter.read(last + 48);
    if (reading === 'idle') throw new Error('expected a reading');
    expect(reading.ms).toBeGreaterThan(16);
    expect(reading.ms).toBeLessThan(32);
  });

  it('goes idle once frames stop, instead of keeping a stale FPS', () => {
    const meter = createFrameMeter({ idleAfterMs: 500 });
    const last = frames(meter, 0, 16, 60);
    expect(meter.read(last + 400)).not.toBe('idle');
    expect(meter.read(last + 600)).toBe('idle');
  });

  it('reads lone on-demand frames as idle: a gap between them is not a frame time', () => {
    const meter = createFrameMeter();
    meter.frame(0);
    expect(meter.read(1)).toBe('idle');
    meter.frame(2000);
    expect(meter.read(2001)).toBe('idle');
  });

  it('starts afresh after an idle gap: the old rate does not leak into the new one', () => {
    const meter = createFrameMeter();
    const last = frames(meter, 0, 50, 40); // 20 fps
    const next = frames(meter, last + 3000, 1000 / 60, 3);
    const reading = meter.read(next);
    if (reading === 'idle') throw new Error('expected a reading');
    expect(reading.fps).toBeCloseTo(60, 0);
  });
});
