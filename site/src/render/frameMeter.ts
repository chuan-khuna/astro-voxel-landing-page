/**
 * Frames per second for the render stats overlay, measured only from frames
 * that render anyway. Pure: the caller passes each frame's timestamp
 * (`requestAnimationFrame` time, ms) and reads when it likes.
 *
 * The World renders on demand, so frames come in bursts (ships sailing, the
 * House opening, a drag) with idle gaps between. A gap longer than
 * `maxGapMs` is not a frame time: it ends the burst, and the next burst
 * starts its average afresh. With no frame for `idleAfterMs`, or no
 * interval measured yet in this burst (a lone on-demand frame), the
 * reading is `'idle'`, never a stale or zero FPS.
 */
export interface FrameReading {
  /** Frames per second, smoothed. */
  fps: number;
  /** Time between frames, ms, smoothed. */
  ms: number;
}

export interface FrameMeter {
  /** A frame rendered at `now` (ms). */
  frame(now: number): void;
  /** The smoothed rate at `now`, or `'idle'` when nothing is rendering. */
  read(now: number): FrameReading | 'idle';
}

export interface FrameMeterOptions {
  /** No frame for this long reads as idle. */
  idleAfterMs?: number;
  /** A longer gap between two frames ends the burst instead of counting as a frame time. */
  maxGapMs?: number;
  /** How far each new frame time moves the average (exponential smoothing, 0–1). */
  smoothing?: number;
}

export function createFrameMeter({ idleAfterMs = 500, maxGapMs = 250, smoothing = 0.1 }: FrameMeterOptions = {}): FrameMeter {
  let last: number | null = null;
  /** Smoothed time between frames in this burst; null until the burst has two frames. */
  let average: number | null = null;
  return {
    frame(now) {
      const gap = last === null ? Infinity : now - last;
      if (gap > maxGapMs || gap <= 0) average = null;
      else average = average === null ? gap : average + (gap - average) * smoothing;
      last = now;
    },
    read(now) {
      if (last === null || average === null || now - last > idleAfterMs) return 'idle';
      return { fps: 1000 / average, ms: average };
    },
  };
}
