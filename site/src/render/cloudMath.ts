/**
 * Pure math for the clouds (`clouds.ts`) and their shadows
 * (`cloudShadow.ts`): no three.js, so it is tested directly.
 *
 * - `cloudFade(world, zoom)`: how much of the clouds shows at a camera zoom,
 *   1 at the Overview, gone well before any Landmark's close-up (even the
 *   phone Story Scroll's framings, a little further back), easing out on a
 *   log scale of the zoom.
 * - `cloudsShown(total, tier)`: the life tier's share of the clouds.
 * - `cloudShadowDrift(wind, seconds)`: how far the shadows have drifted
 *   down the wind on the shared clock (frozen with it).
 * - `cloudShadowStrength(theme)`: how dark a shadow is: none at Night.
 */
import { PLACED_LANDMARK_IDS, type Wind, type World } from '@/world';
import { LIFE_TIERS, type LifeTierName } from '@/lib/lifeTier';
import { THEME_TOKENS } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { landmarkFocus } from './landmarkFocus';

/** Units a cloud's shadow drifts a second: the middle of the clouds' own speeds (`world/clouds.ts`). */
export const SHADOW_SPEED = 0.3;
/** The clouds are gone at this share of the closest Landmark close-up's zoom (on a log scale), and whole up to `WHOLE` of it. */
const GONE = 0.6;
const WHOLE = 0.1;

/** How much of the clouds shows at `zoom` (1 frames the Overview): 1 whole, 0 gone. */
export function cloudFade(world: World, zoom: number): number {
  const closest = Math.min(...PLACED_LANDMARK_IDS.map((id) => landmarkFocus(world, id).zoom));
  // log(zoom) over log(closest): 0 at the Overview, 1 at the closest close-up.
  const t = closest > 1 ? Math.log(Math.max(1, zoom)) / Math.log(closest) : zoom > 1 ? 1 : 0;
  const k = Math.min(1, Math.max(0, (t - WHOLE) / (GONE - WHOLE)));
  return 1 - k * k * (3 - 2 * k);
}

/** How many of `total` clouds a life tier shows: its share, rounded up. */
export const cloudsShown = (total: number, tier: LifeTierName): number => Math.ceil(total * LIFE_TIERS[tier].share);

/** World units the shadows have drifted down the wind after `seconds` of the shared clock. */
export function cloudShadowDrift({ direction }: Wind, seconds: number): { x: number; z: number } {
  return { x: direction.x * SHADOW_SPEED * seconds, z: direction.z * SHADOW_SPEED * seconds };
}

/** How much a cloud's shadow darkens the ground (0–1): by Day only. */
export const cloudShadowStrength = (theme: Theme): number => THEME_TOKENS[theme].world.cloudShadow;
