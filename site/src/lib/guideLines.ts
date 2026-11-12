/**
 * The Guide's lines: what it says and with which face. The lines themselves
 * are content (`guide` in the `pages` collection's front matter); this is
 * the plain logic of saying them. Pure, so it is tested directly.
 */

/** The pixel-eye moods the Guide's screen face can show (`render/guideModel.ts` draws them). */
export const GUIDE_MOODS = ['neutral', 'happy', 'smug', 'surprised', 'sleepy', 'wink'] as const;
export type GuideMood = (typeof GUIDE_MOODS)[number];

/** One speech bubble: the text and the face the Guide makes while saying it. */
export interface GuideLine {
  say: string;
  mood: GuideMood;
}

/** Fill `{seed}` and `{name}` in a line; any other braces stay as they are. */
export function fillLine(text: string, vars: { seed: string; name: string }): string {
  return text.replace(/\{(seed|name)\}/g, (_, key: 'seed' | 'name') => vars[key]);
}

/**
 * One line, chosen by `random` (0 to 1), but never `previous` again while
 * there is another to say.
 */
export function pickLine(lines: readonly GuideLine[], previous: GuideLine | undefined, random: number): GuideLine | undefined {
  const pool = lines.length > 1 ? lines.filter((line) => line !== previous) : lines;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

/** How long a bubble stays up: time to read it at an easy pace, 3 to 10 seconds. */
export function readingMs(text: string): number {
  return Math.round(Math.min(10_000, Math.max(3000, 1200 + text.length * 60)));
}
