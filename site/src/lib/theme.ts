/**
 * The Day and Night theme: which one shows. The visitor's choice is Auto
 * (follow `prefers-color-scheme`), Day or Night, kept in `localStorage`.
 * `<html data-theme>` holds the theme showing and `data-theme-choice` the
 * choice; the CSS tokens and the World follow `data-theme`. Pure, no DOM.
 */
export const THEME_CHOICES = ['auto', 'day', 'night'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = 'day' | 'night';

/** Where the visitor's choice is kept. */
export const THEME_STORAGE_KEY = 'theme';

/** A stored choice, or Auto for nothing stored or anything unknown. */
export function parseThemeChoice(raw: string | null | undefined): ThemeChoice {
  return (THEME_CHOICES as readonly string[]).includes(raw ?? '') ? (raw as ThemeChoice) : 'auto';
}

/** The theme a choice shows: Auto follows the system's dark preference. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'auto') return prefersDark ? 'night' : 'day';
  return choice;
}

/** The toggle's next choice: Auto, Day, Night, then Auto again. */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  return THEME_CHOICES[(THEME_CHOICES.indexOf(choice) + 1) % THEME_CHOICES.length]!;
}

/**
 * The inline `<head>` script that sets `data-theme` and `data-theme-choice`
 * on `<html>` before first paint, so no page ever flashes the wrong theme.
 * It cannot import, so it repeats `parseThemeChoice` and `resolveTheme`;
 * `theme.test.ts` runs it against both.
 */
export const themeBootScript = `(() => {
  let choice = null;
  try { choice = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
  if (choice !== 'day' && choice !== 'night') choice = 'auto';
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement.dataset;
  root.themeChoice = choice;
  root.theme = choice === 'auto' ? (dark ? 'night' : 'day') : choice;
})();`;
