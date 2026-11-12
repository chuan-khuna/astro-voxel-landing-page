/**
 * The shared clock and wind of Ambient Life (ADR 0005): one time uniform
 * and one wind uniform that every Ambient Life material reads, so stopping
 * the clock stops every motion at once (reduced motion, the still tier, a
 * hidden or off-screen World, the Model Gallery, build-time stills).
 *
 * - `time`: seconds of Ambient Life so far. Only `advance` moves it; a clock
 *   never advanced is frozen at 0, so stills are repeatable.
 * - `wind`: the World's wind direction across the ground (x, z), a unit
 *   vector from the Seed (`World.wind`, `world/wind.ts`).
 * - `windAt(clock, position)`: the wind at a world position in the shader,
 *   the direction scaled by its strength there. Gusts roll across the Isles
 *   down the wind: bands of stronger wind that travel with it, so
 *   neighbouring plants sway in turn rather than all at once.
 *
 * The sea's bob (`seaMaterial.ts`) runs on this clock; the Partners' ships
 * sail by `seconds` (`WorldObjects.step`).
 */
import * as THREE from 'three/webgpu';
import { float, max, sin, uniform, vec3 } from 'three/tsl';
import type { Wind } from '@/world';

/** Wind strength between gusts, 0–1 of the strongest. */
export const WIND_CALM = 0.35;
/** World units a gust travels a second, down the wind. */
export const GUST_SPEED = 2.2;
/** World units from one gust's front to the next. */
export const GUST_SPACING = 9;

export interface AmbientClock {
  /** Seconds of Ambient Life so far: the shared time uniform. */
  readonly time: THREE.UniformNode<'float'>;
  /** The wind's direction across the ground (x, z): the shared wind uniform. */
  readonly wind: THREE.UniformNode<'vec2'>;
  /** Seconds so far, on the CPU (what `time` holds). */
  readonly seconds: number;
  /** Run the clock on by `seconds` (it never runs back). */
  advance(seconds: number): void;
  /** Blow the World's wind. */
  setWind(wind: Wind): void;
}

export function createAmbientClock(): AmbientClock {
  const time = uniform(0);
  const wind = uniform(new THREE.Vector2(1, 0));
  return {
    time,
    wind,
    get seconds() {
      return time.value;
    },
    advance(seconds) {
      if (seconds > 0) time.value += seconds;
    },
    setWind({ direction }) {
      wind.value.set(direction.x, direction.z);
    },
  };
}

/**
 * The wind at a world position, in the shader: `vec3(x, 0, z)`, the wind's
 * direction times its strength there (`WIND_CALM` to 1). Two bands of gusts
 * of different spacing roll down the wind, so the gusting never repeats
 * exactly from one front to the next.
 */
export function windAt(clock: AmbientClock, position: THREE.Node<'vec3'>): THREE.Node<'vec3'> {
  const along = position.x.mul(clock.wind.x).add(position.z.mul(clock.wind.y));
  const front = along.sub(clock.time.mul(GUST_SPEED)).mul((2 * Math.PI) / GUST_SPACING);
  const gust = max(float(0), sin(front)).mul(sin(front.mul(0.37).add(1.3)).mul(0.5).add(0.5));
  const strength = gust.mul(1 - WIND_CALM).add(WIND_CALM);
  return vec3(clock.wind.x, 0, clock.wind.y).mul(strength);
}
