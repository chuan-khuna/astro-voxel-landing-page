/**
 * The Story Scroll: how a phone reads the site. Below 48rem, with the World
 * live, every section stands on the page in Story Order after the intro
 * (`WorldPage.astro` renders them all), each a window of World and then its
 * card, and the page scrolls over the fixed World. The camera follows the
 * scroll: it holds at a section's Landmark while its card is read and glides
 * to the next as the next window of World scrolls in (`render/storyMath.ts`),
 * damped so even a flick moves it calmly (`dampState`). It never pulls out to
 * the Overview: the intro frames the Station, a little further back.
 *
 * - The House's lid follows the same scroll: it lifts as About scrolls in
 *   and comes down as Projects does.
 * - The URL follows the section in view (`history.replaceState`), and so do
 *   the page title and the menu's current link. A link to a section on the
 *   page (the menu, a Landmark's link in the World, About's link to Team)
 *   scrolls to it and adds a history entry; Back and Forward scroll back.
 *   A link to another page (a Project, a new Seed) goes through the router,
 *   which swaps the page: the scroll is kept and glides to the new route.
 * - The World takes no pan or zoom input: a swipe or the wheel scrolls the page.
 * - Only the Data Card of the section's own Landmark shows, once the camera
 *   holds there, and neither it nor the Guide's bubble shows under a card.
 * - Reduced motion: no glide; the camera and the lid cut as each section
 *   takes over.
 *
 * Wider than that it is off, and the page is the full-screen World with one
 * panel; crossing the width turns it on or off (`onToggle`).
 */
import type { WorldView } from '@/render/mountWorld';
import type { ScreenOffset } from '@/render/freeArea';
import { dampState, type CameraState } from '@/render/cameraMath';
import { sectionInView, storyFraming, storyOpening, storyPosition, type StoryStop } from '@/render/storyMath';
import { routeView, sameRoute } from '@/lib/landmarkRoutes';
import { seedFromUrl } from '@/lib/seedUrl';
import type { LandmarkId, PlacedLandmarkId } from '@/world';

/** The phone width the Story Scroll is on below: the site's phone breakpoint. */
export const STORY_MEDIA = '(max-width: 47.99rem)';
/** How quickly the camera catches up with the scroll: the time constant of its damping, ms. */
const DAMP_MS = 320;
/** The lid moves at most at the rate of a full lift over this long, so it too lags the scroll a little. */
const ROOF_MS = 800;
/**
 * Each section's framing on a phone, as a share of its Landmark's close-up
 * zoom (1 when not listed). The intro frames the Station a little further
 * back than Services does, so scrolling on moves in; the Garden comes
 * closer, as close as the camera may come, so its plants' links are bigger to tap.
 */
const STORY_ZOOM: Partial<Record<LandmarkId, number>> = { overview: 0.8, garden: 2.5 };

interface Item {
  el: HTMLElement;
  /** The card after the section's window of World. */
  card: HTMLElement | null;
  route: string;
  landmark: LandmarkId;
  /** The page title while it is in view. */
  title: string;
}

export interface StoryScrollOptions {
  /** The World view once mounted, else null. */
  view: () => WorldView | null;
  /** The World's frame (persisted): Data Cards and the Guide's bubble live in it. */
  frame: HTMLElement;
  reducedMotion: MediaQueryList;
  /** The Story Scroll came on (the window narrowed to a phone's) or went off. */
  onToggle: (on: boolean) => void;
  /** Another section came into view; the URL already says which. */
  onSection: () => void;
}

export interface StoryScroll {
  /** Whether the Story Scroll is on: phone width and the World live. */
  readonly on: boolean;
  /** A World is in (the first, or a new Seed's): frame the section in view at once. */
  worldShown(): void;
  /** A new page is in (the router swapped it): keep the scroll and glide to the route's section. */
  afterSwap(): void;
}

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function createStoryScroll(options: StoryScrollOptions): StoryScroll {
  const { frame, reducedMotion } = options;
  const media = window.matchMedia(STORY_MEDIA);
  let on = media.matches;
  const active = () => on && document.documentElement.dataset.world !== undefined;
  const reduced = () => reducedMotion.matches;
  /** The Landmarks with a Data Card. */
  const cardIds = new Set([...frame.querySelectorAll<HTMLElement>('[data-card]')].map((c) => c.dataset.card));

  let items: Item[] = [];
  let stops: StoryStop[] = [];
  let framings: CameraState[] = [];
  let openings: number[] = [];
  /** Where a section's Landmark is framed: the middle of its window of World below the top bar (CSS px from the frame's centre, y down). */
  let at: ScreenOffset = { x: 0, y: 0 };
  /** The top bar's bottom, CSS px from the frame's top. */
  let barBottom = 0;
  /** The section in view, whose route the URL shows. */
  let shown = -1;
  /** Where the camera is heading; the damping loop chases it. */
  let target: CameraState | null = null;
  let loop = 0;
  let last = 0;
  /** The scroll before the router swapped the page. */
  let savedY = 0;
  /** A section the page was put at at once (a deep link, a swap), held there as late layout (fonts) shifts it until the visitor scrolls. */
  let pinned: number | null = null;
  /** A section the page is gliding to (a link, Back or Forward): the URL waits for it, rather than naming each section passed. */
  let heading: number | null = null;
  /** A pass over the cards is booked for the next frame. */
  let clearing = 0;
  /** Hearing the World's frames: the Data Card and the Guide's bubble keep out from under the cards. */
  let hearing: WorldView | null = null;

  const read = () => {
    items = [...document.querySelectorAll<HTMLElement>('[data-story-item]')].map((el) => ({
      el,
      card: el.querySelector<HTMLElement>('[data-story-card]'),
      route: el.dataset.route ?? '/',
      landmark: (el.dataset.landmark ?? 'overview') as LandmarkId,
      title: el.dataset.title ?? document.title,
    }));
    observeStory();
  };

  /** Each section's stop on the page, where its Landmark is framed, and its framing and opening in the World on show. */
  const measure = () => {
    const height = window.innerHeight;
    stops = items.map(({ el, card }) => {
      const anchor = el.getBoundingClientRect().top + window.scrollY;
      const end = (card ?? el).getBoundingClientRect().bottom + window.scrollY;
      return { anchor, leave: Math.max(anchor, end - height) };
    });
    const first = items[0];
    const windowHeight = first?.card ? first.card.getBoundingClientRect().top - first.el.getBoundingClientRect().top : height / 2;
    const bar = document.querySelector('.hud-bar')?.getBoundingClientRect().bottom ?? 0;
    const box = frame.getBoundingClientRect();
    barBottom = Math.max(0, bar - box.top);
    at = { x: 0, y: (bar + windowHeight) / 2 - (box.top + box.height / 2) };
    const view = options.view();
    if (!view) return;
    view.setViewCentre(at);
    framings = items.map(({ landmark }) =>
      view.focusState(landmark === 'overview' ? 'station' : routeView(landmark).focus, at, STORY_ZOOM[landmark] ?? 1),
    );
    openings = items.map(({ landmark }) => (routeView(landmark).interior ? 1 : 0));
  };

  const indexOfRoute = (path: string) => items.findIndex((item) => sameRoute(item.route, path));

  /** The section in view changed: the URL, the title and the menu follow it. */
  const showSection = (index: number) => {
    shown = index;
    const item = items[index];
    if (!item) return;
    const url = new URL(location.href);
    if (!sameRoute(url.pathname, item.route)) {
      url.pathname = item.route;
      // Keep the router's state (its history index and scroll) on the entry.
      history.replaceState(history.state, '', url);
    }
    document.title = item.title;
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.landmark-menu a[data-landmark]')) {
      if (link.dataset.landmark === item.landmark) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    options.onSection();
  };

  /** Keep the shown Data Card and the Guide's bubble out from under the cards over the World. */
  const keepClear = () => {
    const covers = active()
      ? [...document.querySelectorAll<HTMLElement>('[data-covers-world]')].map((c) => c.getBoundingClientRect()).filter((r) => r.height > 0)
      : [];
    for (const el of frame.querySelectorAll<HTMLElement>('.data-card[data-near], .guide-bubble')) {
      const box = el.getBoundingClientRect();
      el.toggleAttribute('data-covered', covers.some((c) => overlaps(box, c)));
    }
  };

  /** Chase the target, a frame at a time, until the camera lands on it. */
  const tick = (now: number) => {
    loop = 0;
    const view = options.view();
    if (!view || !target || !active()) return;
    const dt = Math.max(0, Math.min(100, now - last));
    last = now;
    const next = dampState(view.camera.state, target, dt, reduced() ? 0 : DAMP_MS);
    view.camera.jumpTo(next);
    if (next !== target) loop = requestAnimationFrame(tick);
  };

  /** Follow the scroll: the section in view, and where the camera and the lid head (`cut`: there at once). */
  const follow = (cut: boolean) => {
    if (!active() || items.length === 0) return;
    const position = storyPosition(window.scrollY, stops);
    const index = sectionInView(position);
    // Gliding to a section: the URL names it once it is there, not each section on the way.
    if (heading === index) heading = null;
    if (index !== shown && heading === null) showSection(index);
    if (!clearing) {
      clearing = requestAnimationFrame(() => {
        clearing = 0;
        keepClear();
      });
    }
    const view = options.view();
    if (!view || framings.length !== items.length) return;
    target = storyFraming(position, framings, reduced());
    view.setOpening(storyOpening(position, openings, reduced()), cut || reduced() ? 0 : ROOF_MS);
    // Only the section's own Landmark's card, and only once the camera holds there.
    const landmark = items[index]!.landmark;
    const held = position.from === position.to;
    // Below the top bar: a card that would stand under it hangs below its Landmark instead.
    view.setDataCardFocus(held && cardIds.has(landmark) ? (landmark as PlacedLandmarkId) : null, barBottom);
    if (cut) {
      cancelAnimationFrame(loop);
      loop = 0;
      view.camera.jumpTo(target);
    } else if (!loop) {
      last = performance.now();
      loop = requestAnimationFrame(tick);
    }
  };

  const scrollToItem = (index: number, smooth: boolean) => {
    const stop = stops[index];
    if (!stop) return;
    const glide = smooth && !reduced();
    // An instant move is held against late layout shifts; a glide is not (a jump would cut it short).
    pinned = glide ? null : index;
    heading = glide && sectionInView(storyPosition(window.scrollY, stops)) !== index ? index : null;
    window.scrollTo({ top: stop.anchor, behavior: glide ? 'smooth' : 'instant' });
  };

  /** Read and measure the page, and put the scroll at the route's section. */
  const startHere = () => {
    read();
    measure();
    const index = indexOfRoute(location.pathname);
    shown = -1;
    if (index >= 0) scrollToItem(index, false);
  };

  // The story's size changes (fonts, pictures, a resize): measure again, and stay at a section the page was sent to.
  let observed: Element | null = null;
  const resizes = new ResizeObserver(() => {
    if (!active()) return;
    measure();
    if (pinned !== null) scrollToItem(pinned, false);
    follow(false);
  });
  function observeStory() {
    const story = document.querySelector('[data-story]');
    if (story === observed) return;
    if (observed) resizes.unobserve(observed);
    observed = story;
    if (story) resizes.observe(story);
  }
  window.addEventListener('resize', () => active() && measure());
  // The visitor scrolls on their own: no section holds the page any more.
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
    window.addEventListener(
      type,
      () => {
        pinned = null;
        heading = null;
      },
      { passive: true, capture: true },
    );
  }
  window.addEventListener('scroll', () => follow(false), { passive: true });

  // A link to a section on the page scrolls to it, with a history entry of its own.
  document.addEventListener(
    'click',
    (event) => {
      if (!active() || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin) return;
      // Another Seed is another World: the router loads it.
      if (seedFromUrl(url) !== seedFromUrl(new URL(location.href))) return;
      const index = indexOfRoute(url.pathname);
      if (index < 0) return;
      event.preventDefault();
      document.querySelector<HTMLElement>(':popover-open')?.hidePopover();
      const next = new URL(location.href);
      next.pathname = url.pathname;
      next.hash = '';
      // No state: the router leaves Back and Forward between these entries to us.
      if (next.href !== location.href) history.pushState(null, '', next);
      measure();
      scrollToItem(index, true);
      items[index]?.card?.focus({ preventScroll: true });
    },
    true,
  );
  // Back or Forward to an entry of ours (no router state): scroll to its section.
  window.addEventListener('popstate', (event) => {
    if (!active() || event.state !== null) return;
    measure();
    const index = indexOfRoute(location.pathname);
    if (index >= 0) scrollToItem(index, true);
  });
  // The router is about to swap the page: remember the scroll, which it resets.
  document.addEventListener('astro:before-swap', () => {
    savedY = window.scrollY;
  });

  /** After the next frame: the World's canvas has taken its new size (its ResizeObserver), so framings are measured on it. */
  const afterResize = (then: () => void) => requestAnimationFrame(() => requestAnimationFrame(then));

  media.addEventListener('change', () => {
    if (media.matches === on) return;
    on = media.matches;
    const view = options.view();
    view?.camera.setInput(!on);
    if (on) {
      startHere();
      afterResize(() => {
        if (!on) return;
        measure();
        if (pinned !== null) scrollToItem(pinned, false);
        follow(true);
      });
    } else {
      cancelAnimationFrame(loop);
      loop = 0;
      target = null;
      pinned = null;
      view?.setDataCardFocus(undefined);
      keepClear();
    }
    afterResize(() => options.onToggle(on));
  });

  if (active()) startHere();

  return {
    get on() {
      return active();
    },
    worldShown() {
      const view = options.view();
      if (!view) return;
      view.camera.setInput(!active());
      if (hearing !== view) {
        hearing = view;
        view.onFrame(() => active() && keepClear());
      }
      if (!active()) return;
      read();
      measure();
      if (pinned !== null) scrollToItem(pinned, false);
      follow(true);
    },
    afterSwap() {
      if (!active()) return;
      // The router scrolled to the top: put the page back where it was, then glide to the route's section.
      window.scrollTo({ top: savedY, behavior: 'instant' });
      read();
      measure();
      shown = -1;
      const index = indexOfRoute(location.pathname);
      if (index >= 0 && sectionInView(storyPosition(window.scrollY, stops)) !== index) scrollToItem(index, true);
      follow(false);
    },
  };
}
