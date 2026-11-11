import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, nextThemeChoice, parseThemeChoice, resolveTheme, themeBootScript } from './theme';

describe('resolveTheme', () => {
  it('follows the system preference in Auto', () => {
    expect(resolveTheme('auto', false)).toBe('day');
    expect(resolveTheme('auto', true)).toBe('night');
  });
  it('lets Day and Night override the system preference', () => {
    expect(resolveTheme('day', true)).toBe('day');
    expect(resolveTheme('night', false)).toBe('night');
  });
});

describe('parseThemeChoice', () => {
  it('reads a stored choice', () => {
    expect(parseThemeChoice('day')).toBe('day');
    expect(parseThemeChoice('night')).toBe('night');
    expect(parseThemeChoice('auto')).toBe('auto');
  });
  it('treats nothing stored, or anything else, as Auto', () => {
    expect(parseThemeChoice(null)).toBe('auto');
    expect(parseThemeChoice('dark')).toBe('auto');
  });
});

describe('nextThemeChoice', () => {
  it('cycles Auto, Day, Night and back to Auto', () => {
    expect(nextThemeChoice('auto')).toBe('day');
    expect(nextThemeChoice('day')).toBe('night');
    expect(nextThemeChoice('night')).toBe('auto');
  });
});

/** Run the boot script against a fake page, as the browser runs it in <head> before first paint. */
function boot(stored: string | null | Error, prefersDark: boolean) {
  const dataset: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => {
      if (stored instanceof Error) throw stored;
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const matchMedia = (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && prefersDark });
  const document = { documentElement: { dataset } };
  new Function('document', 'localStorage', 'matchMedia', themeBootScript)(document, localStorage, matchMedia);
  return dataset;
}

describe('themeBootScript', () => {
  it('sets the theme and the choice on <html> from storage and the system preference', () => {
    expect(boot(null, true)).toEqual({ theme: 'night', themeChoice: 'auto' });
    expect(boot(null, false)).toEqual({ theme: 'day', themeChoice: 'auto' });
    expect(boot('day', true)).toEqual({ theme: 'day', themeChoice: 'day' });
    expect(boot('night', false)).toEqual({ theme: 'night', themeChoice: 'night' });
  });
  it('falls back to Auto when storage is blocked', () => {
    expect(boot(new Error('SecurityError'), true)).toEqual({ theme: 'night', themeChoice: 'auto' });
  });
});
