import { describe, expect, it } from 'vitest';
import { outlineKey, outlinedKeys } from './outlineTargets';

describe('outlineKey', () => {
  it('names the model a link over the World stands for', () => {
    expect(outlineKey({ hotspot: 'station' })).toBe('landmark:station');
    expect(outlineKey({ hotspot: 'garden', project: 'harbour-app' })).toBe('plant:harbour-app');
    expect(outlineKey({ hotspot: 'house-interior', developer: '' })).toBe('developer');
    expect(outlineKey({ guide: '' })).toBe('guide');
  });
});

describe('outlinedKeys', () => {
  const link = (key: string, state: Partial<{ hidden: boolean; hovered: boolean; focusVisible: boolean; current: boolean }> = {}) => ({
    key,
    hidden: false,
    hovered: false,
    focusVisible: false,
    current: false,
    ...state,
  });

  it('outlines nothing while no link is hovered, focused or current', () => {
    expect(outlinedKeys([link('landmark:station'), link('plant:a')])).toEqual([]);
  });

  it('outlines the model under the pointer, the one focused from the keyboard and the open page\'s', () => {
    const keys = outlinedKeys([
      link('landmark:station', { hovered: true }),
      link('landmark:dock'),
      link('plant:a', { current: true }),
      link('guide', { focusVisible: true }),
    ]);
    expect(keys).toEqual(['landmark:station', 'plant:a', 'guide']);
  });

  it('never outlines a hidden link\'s model (the developer while the House is shut)', () => {
    expect(outlinedKeys([link('developer', { hidden: true, current: true, hovered: true })])).toEqual([]);
  });

  it('names each model once', () => {
    expect(outlinedKeys([link('plant:a', { hovered: true, current: true }), link('plant:a', { focusVisible: true })])).toEqual(['plant:a']);
  });
});
