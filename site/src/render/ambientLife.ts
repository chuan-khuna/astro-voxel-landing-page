/**
 * Ambient Life's runtime state (ADR 0005): the shared clock and wind
 * (`ambientClock.ts`), the tier (`lib/lifeTier.ts`) and whether the World is
 * seen at all. `mountWorld`'s render loop asks it two things each frame:
 *
 * - `seen()`: the tab is shown (`visibilitychange`), the canvas is on screen
 *   (an `IntersectionObserver`) and the visitor has not asked for reduced
 *   motion. One-off animations (the Guide assembling) play only then.
 * - `alive()`: seen, and the tier on show moves (not still). Then the World
 *   renders continuously and the clock runs; otherwise it renders on demand
 *   and the clock is frozen where it stands.
 *
 * `frame(gapMs)` feeds each continuous frame's time to the tier watch; a
 * drop shows on `canvas.dataset.life`. Any change that may start or stop the
 * loop (the tab shown or hidden, the canvas scrolled on or off screen,
 * reduced motion turned on or off) calls `onChange`.
 */
import { createAmbientClock, type AmbientClock } from './ambientClock';
import { LIFE_TIERS, createLifeTierWatch, lifeTierShown, startingLifeTier, type LifeTierName } from '@/lib/lifeTier';
import type { RenderTier } from '@/lib/renderTier';

export interface AmbientLife {
  readonly clock: AmbientClock;
  /** The tier on show: still under reduced motion, else the watch's. */
  tier(): LifeTierName;
  /** The World can be seen and motion is allowed. */
  seen(): boolean;
  /** Seen, and the tier moves: render continuously and run the clock. */
  alive(): boolean;
  /** Frames a second for frames only Ambient Life asks for (0: every frame): the stricter of the render tier's and the life tier's. */
  ambientFps(): number;
  /** A continuous frame rendered `gapMs` after the one before it. */
  frame(gapMs: number): void;
  dispose(): void;
}

export function createAmbientLife(options: {
  canvas: HTMLCanvasElement;
  render: RenderTier;
  /** `?life=full|reduced|still`: start at that tier and never drop (for measuring). */
  override?: string | null;
  onChange: () => void;
}): AmbientLife {
  const { canvas, render, override, onChange } = options;
  const start = startingLifeTier(render.name, override);
  // A valid override is a tier name, and pins it.
  const watch = createLifeTierWatch(start, { pinned: start === override });
  const clock = createAmbientClock();
  const query = '(prefers-reduced-motion: reduce)';
  const reducedMotion = window.matchMedia(query);
  // Heard on a list of its own: Chromium fires no `change` on a list whose `matches` was read after
  // the change and before the event, and the render loop reads `reducedMotion` every frame.
  const motionChanges = window.matchMedia(query);
  let onScreen = true;

  const tier = () => lifeTierShown(watch.tier, reducedMotion.matches);
  const seen = () => onScreen && document.visibilityState === 'visible' && !reducedMotion.matches;
  const showTier = () => {
    canvas.dataset.life = tier();
  };
  const changed = () => {
    showTier();
    onChange();
  };
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry || entry.isIntersecting === onScreen) return;
    onScreen = entry.isIntersecting;
    changed();
  });
  observer.observe(canvas);
  motionChanges.addEventListener('change', changed);
  document.addEventListener('visibilitychange', changed);
  showTier();

  return {
    clock,
    tier,
    seen,
    alive: () => seen() && LIFE_TIERS[tier()].moves,
    ambientFps: () => {
      // 0 is no cap: the stricter of two caps is the lower one that is not 0.
      const device = render.ambientFps;
      const life = LIFE_TIERS[tier()].ambientFps;
      return device === 0 ? life : life === 0 ? device : Math.min(device, life);
    },
    frame: (gapMs) => {
      const before = watch.tier;
      if (watch.frame(gapMs) !== before) showTier();
    },
    dispose: () => {
      observer.disconnect();
      motionChanges.removeEventListener('change', changed);
      document.removeEventListener('visibilitychange', changed);
    },
  };
}
