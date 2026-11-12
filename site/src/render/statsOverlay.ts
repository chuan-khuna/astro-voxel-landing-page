/**
 * The render stats overlay, for developers (ticket 20): a toggle beside the
 * dice and a small card at the top right, below the Landmark menu, with
 * FPS, frame time, triangles, draw calls, the backend, the render tier, the Ambient Life tier, the World's build
 * time and retries, its Seed and Biome, and its voxels by kind.
 *
 * Loaded only when stats are available (`lib/renderStats.ts`: `astro dev`,
 * or `?stats` in the URL); ordinary visitors never load this module. It
 * never asks for a frame: it hears about frames that render anyway
 * (`WorldView.onFrame`) and rewrites its text at most 4 times a second.
 * Voxels are counted once per World shown, and only while the card is on.
 */
// Inline, not a page stylesheet: Astro would put an imported stylesheet on every page.
import css from './statsOverlay.css?inline';
import type { World } from '@/world';
import type { FrameInfo, WorldView } from './mountWorld';
import { createFrameMeter } from './frameMeter';
import { countVoxels, VOXEL_KINDS, type VoxelCounts, type VoxelKind } from './voxelCounts';
import { parseStatsOn, STATS_PARAM, STATS_STORAGE_KEY } from '@/lib/renderStats';

/** How often the card's text is rewritten, ms (4 times a second). */
const UPDATE_MS = 250;
/** Space between the card and what it sits below or beside, px. */
const GAP = 8;

const KIND_LABELS: Record<VoxelKind, string> = {
  terrain: 'terrain',
  landmarks: 'Landmarks',
  plants: 'plants',
  decoration: 'Decoration',
  houseRoom: 'House room',
  boats: 'boats',
  ships: 'ships',
  buoys: 'buoys',
  bridges: 'bridges',
  stairs: 'stairs',
};

/** The World on show and how long it took to build. */
export interface ShownWorld {
  world: World;
  /** Generate time, ms, when it was built. */
  generateMs: number;
  /** Whether it came from the cache this time. */
  cached: boolean;
}

export interface StatsOverlay {
  /** A World is on show in `view` (call again for every new Seed). */
  show(shown: ShownWorld, view: WorldView): void;
}

export interface StatsOverlayElements {
  /** The dice, in the bottom-left dice and Seed card (persisted): the toggle goes right after it. */
  dice: HTMLElement;
  /** The World's frame (persisted): the card goes in it, so it never covers a panel. */
  frame: HTMLElement;
}

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STATS_STORAGE_KEY);
  } catch {
    return null;
  }
};
const store = (on: boolean) => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // No storage (private window, blocked site data): the toggle still works for this page.
  }
};

const fmt = (n: number) => n.toLocaleString('en-GB');
const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function createStatsOverlay({ dice, frame }: StatsOverlayElements): StatsOverlay {
  // With `?stats` in the URL the visitor asked for stats: on unless turned off before. In dev: off unless turned on.
  let on = parseStatsOn(readStored(), new URL(location.href).searchParams.has(STATS_PARAM));

  // In the persisted frame, so the router keeps it across pages.
  const style = document.createElement('style');
  style.textContent = css;
  frame.append(style);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'stats-toggle';
  toggle.setAttribute('aria-label', 'Render stats');
  toggle.title = 'Render stats';
  toggle.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
  dice.after(toggle);

  const card = document.createElement('div');
  card.className = 'stats-card';
  card.setAttribute('aria-label', 'Render stats');
  card.setAttribute('role', 'group');
  frame.append(card);

  const meter = createFrameMeter();
  let lastFrame: FrameInfo | null = null;
  let shown: ShownWorld | null = null;
  let view: WorldView | null = null;
  let stopListening: (() => void) | null = null;
  /** Voxel counts of the World on show; counted once per World, when the card is on. */
  let counted: { world: World; counts: VoxelCounts } | null = null;
  let timer = 0;

  const row = (label: string, value: string, cls = '') => `<dt>${label}</dt><dd${cls ? ` class="${cls}"` : ''}>${value}</dd>`;

  const render = () => {
    const reading = meter.read(performance.now());
    const rows: string[] = [];
    rows.push(
      reading === 'idle'
        ? row('FPS', 'idle', 'stats-idle')
        : row('FPS', `${reading.fps.toFixed(0)} <span class="stats-dim">${reading.ms.toFixed(1)} ms</span>`),
    );
    rows.push(row('triangles', lastFrame ? fmt(lastFrame.triangles) : '–'));
    rows.push(row('draw calls', lastFrame ? fmt(lastFrame.drawCalls) : '–'));
    rows.push(row('backend', view ? (view.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2') : '–'));
    rows.push(row('tier', view ? view.tier : '–'));
    rows.push(row('life', view ? view.lifeTier : '–'));
    if (shown) {
      const { world } = shown;
      rows.push(row('Seed', escape(world.seed)));
      rows.push(row('Biome', world.biome.id));
      rows.push(row('generate', `${shown.generateMs.toFixed(1)} ms${shown.cached ? ' <span class="stats-dim">cached</span>' : ''}`));
      rows.push(row('retries', String(world.attempts - 1)));
    }
    if (counted) {
      const { counts } = counted;
      rows.push(row('voxels', fmt(counts.total), 'stats-total'));
      for (const kind of VOXEL_KINDS) if (counts[kind] > 0) rows.push(row(KIND_LABELS[kind], fmt(counts[kind]), 'stats-kind'));
    }
    card.innerHTML = `<dl>${rows.join('')}</dl>`;
    place();
  };

  /** Top right, below the Landmark menu bar; left of a side panel; never down over a sheet or the dice card. */
  const place = () => {
    const tools = document.querySelector('.hud-tools')?.getBoundingClientRect();
    if (!tools) return;
    const top = tools.bottom + GAP;
    let right = Math.max(0, window.innerWidth - tools.right);
    const panel = document.querySelector('[data-panel]')?.getBoundingClientRect();
    // A side panel (desktop) starts beside the card: sit to its left. A bottom sheet (phones) is handled below.
    if (panel && panel.top < top + 40 && panel.left > window.innerWidth / 2) right = window.innerWidth - panel.left + GAP;
    card.style.top = `${top}px`;
    card.style.right = `${right}px`;
    const box = card.getBoundingClientRect();
    let bottom = window.innerHeight - GAP;
    for (const cover of document.querySelectorAll<HTMLElement>('[data-covers-world]')) {
      const r = cover.getBoundingClientRect();
      if (r.top >= top && r.left < box.right && r.right > box.left) bottom = Math.min(bottom, r.top - GAP);
    }
    card.style.maxHeight = `${Math.max(0, bottom - top)}px`;
    // Rows that do not fit are left out whole, not cut in half.
    const limit = card.getBoundingClientRect().bottom - 4;
    for (const cell of card.querySelectorAll<HTMLElement>('dt, dd')) cell.style.visibility = cell.getBoundingClientRect().bottom > limit ? 'hidden' : '';
  };

  const countIfNeeded = () => {
    if (on && shown && counted?.world !== shown.world) counted = { world: shown.world, counts: countVoxels(shown.world) };
  };

  const apply = () => {
    toggle.setAttribute('aria-pressed', String(on));
    card.hidden = !on;
    window.clearInterval(timer);
    if (on) {
      countIfNeeded();
      render();
      timer = window.setInterval(render, UPDATE_MS);
    }
  };

  toggle.addEventListener('click', () => {
    on = !on;
    store(on);
    apply();
  });
  window.addEventListener('resize', () => {
    if (on) place();
  });
  apply();

  return {
    show(next, nextView) {
      shown = next;
      if (nextView !== view) {
        stopListening?.();
        view = nextView;
        stopListening = view.onFrame((info) => {
          meter.frame(info.now);
          lastFrame = info;
        });
      }
      if (on) {
        countIfNeeded();
        render();
      }
    },
  };
}
