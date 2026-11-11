import { describe, expect, it } from 'vitest';
import { fillLine, pickLine, readingMs } from './guideLines';

describe('fillLine', () => {
  it('fills in the Seed and the Guide name, and leaves unknown braces alone', () => {
    expect(fillLine('Seed {seed}. I am {name}. {nope}', { seed: '4821', name: 'Lumen' })).toBe('Seed 4821. I am Lumen. {nope}');
  });
});

describe('pickLine', () => {
  const lines = [
    { say: 'one', mood: 'neutral' as const },
    { say: 'two', mood: 'happy' as const },
    { say: 'three', mood: 'smug' as const },
  ];

  it('picks by the random number', () => {
    expect(pickLine(lines, undefined, 0)?.say).toBe('one');
    expect(pickLine(lines, undefined, 0.99)?.say).toBe('three');
  });

  it('never says the same line twice in a row when there is another', () => {
    for (const r of [0, 0.3, 0.5, 0.7, 0.99]) expect(pickLine(lines, lines[1], r)?.say).not.toBe('two');
    expect(pickLine([lines[0]!], lines[0], 0.5)?.say).toBe('one');
  });

  it('has nothing to say with no lines', () => {
    expect(pickLine([], undefined, 0.5)).toBeUndefined();
  });
});

describe('readingMs', () => {
  it('gives a short line a few seconds and a long one longer, within bounds', () => {
    expect(readingMs('Hi.')).toBe(3000);
    expect(readingMs('x'.repeat(100))).toBeGreaterThan(readingMs('x'.repeat(50)));
    expect(readingMs('x'.repeat(1000))).toBe(10000);
  });
});
