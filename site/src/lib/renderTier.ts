/**
 * The render tier: how much the World spends on looks on this device. Small
 * touch devices (phones) get the reduced tier, everything else the full one.
 * A tier only changes how the World is drawn, never what is in it: every
 * Landmark, plant, boat, ship and buoy is there in both.
 *
 * Plain functions over a device description; no DOM.
 */

export type RenderTierName = 'full' | 'reduced';

/** What the World costs to draw on this device. */
export interface RenderTier {
  name: RenderTierName;
  /** Multisample antialiasing. */
  antialias: boolean;
  /** The sun's (or moon's) shadow map, px each side. */
  shadowMapSize: number;
  /** Frames a second for frames that only ambient motion asks for (ships, the Guide idling, the developer); 0: every frame. Camera moves always get every frame. */
  ambientFps: number;
}

/** The device, as the browser describes it. */
export interface Device {
  /** A touch screen is the main pointer (`(pointer: coarse)`). */
  coarsePointer: boolean;
  /** The screen's size in CSS px (`screen.width`, `screen.height`). */
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
}

/** A touch device whose screen's shorter side is below this many CSS px is a phone: the reduced tier. */
export const PHONE_SHORT_SIDE = 600;

const TIERS: Record<RenderTierName, RenderTier> = {
  full: { name: 'full', antialias: true, shadowMapSize: 2048, ambientFps: 0 },
  reduced: { name: 'reduced', antialias: false, shadowMapSize: 1024, ambientFps: 30 },
};

/** The tier for a device; `override` (`?tier=full` or `?tier=reduced`) picks one, for measuring. */
export function renderTier(device: Device, override?: string | null): RenderTier {
  if (override === 'full' || override === 'reduced') return TIERS[override];
  const phone = device.coarsePointer && Math.min(device.screenWidth, device.screenHeight) < PHONE_SHORT_SIDE;
  return TIERS[phone ? 'reduced' : 'full'];
}

/** The device-pixel-ratio cap: 1.5 on touch devices (phones and tablets), 2 elsewhere. */
export function pixelRatio(device: Device): number {
  return Math.min(device.devicePixelRatio, device.coarsePointer ? 1.5 : 2);
}

/** Slack under the frame interval, ms: a frame a little early (rAF jitter) still counts as due. */
const FRAME_SLACK_MS = 4;

/**
 * Is a frame that only ambient motion asks for due at `now`? `last` is the
 * time of the last frame rendered (0: none since the World was still), and
 * `fps` the tier's `ambientFps` (0: every frame).
 */
export function ambientFrameDue(now: number, last: number, fps: number): boolean {
  if (fps <= 0 || last === 0) return true;
  return now - last >= 1000 / fps - FRAME_SLACK_MS;
}
