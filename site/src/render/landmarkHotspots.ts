/**
 * Landmark hotspots: real links laid over the canvas, one per placed
 * Landmark, sized to the screen rectangle of the Landmark's model (its
 * measured extent, whatever its footprint). They give each Landmark a hover
 * affordance, a pointer cursor and keyboard focus without any GPU picking;
 * the links themselves are rendered by the page.
 *
 * `place(camera)` re-positions them; call it whenever the camera changes.
 * Focusing a hotspot that is off screen moves the camera onto it.
 */
import * as THREE from 'three/webgpu';
import type { GroundPoint } from './cameraMath';
import type { PlacedLandmarkId, World } from '../world';
import { landmarkExtent } from './landmarkModels';

/** Smallest hotspot side, in CSS px, so a far-away Landmark is still easy to hit. */
const MIN_SIZE = 28;

export interface LandmarkHotspots {
  /** A new World: new Landmark positions. */
  setWorld(world: World): void;
  /** Move every hotspot onto its Landmark as `camera` sees it. */
  place(camera: THREE.Camera): void;
  dispose(): void;
}

interface Placed {
  link: HTMLElement;
  box: THREE.Box3;
}

/**
 * `links` are the page's hotspot links, each with `data-hotspot="<landmark id>"`.
 * `centreOn` is called when a hotspot takes focus while off screen.
 */
export function createLandmarkHotspots(
  frame: HTMLElement,
  links: HTMLElement[],
  centreOn: (point: GroundPoint) => void,
): LandmarkHotspots {
  let placed: Placed[] = [];
  const corner = new THREE.Vector3();

  const onFocus = (event: FocusEvent) => {
    const hit = placed.find((p) => p.link === event.target);
    if (!hit) return;
    const rect = hit.link.getBoundingClientRect();
    const view = frame.getBoundingClientRect();
    const visible = rect.right > view.left && rect.left < view.right && rect.bottom > view.top && rect.top < view.bottom;
    if (visible) return;
    const centre = hit.box.getCenter(new THREE.Vector3());
    centreOn({ x: centre.x, z: centre.z });
  };
  for (const link of links) link.addEventListener('focus', onFocus);

  return {
    setWorld(world) {
      placed = [];
      for (const link of links) {
        const landmark = world.landmarks.find((l) => l.id === (link.dataset.hotspot as PlacedLandmarkId));
        if (!landmark) {
          link.hidden = true;
          continue;
        }
        // The model's own extent, so any footprint (one cell or several) is covered.
        const origin = new THREE.Vector3(landmark.cell.x, landmark.y, landmark.cell.z);
        const { min, max } = landmarkExtent(landmark.id, landmark.variant);
        placed.push({
          link,
          box: new THREE.Box3(
            new THREE.Vector3(min.x, min.y, min.z).add(origin),
            new THREE.Vector3(max.x, max.y, max.z).add(origin),
          ),
        });
        link.hidden = false;
      }
    },
    place(camera) {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      for (const { link, box } of placed) {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (let i = 0; i < 8; i++) {
          corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
          corner.project(camera);
          const sx = ((corner.x + 1) / 2) * width;
          const sy = ((1 - corner.y) / 2) * height;
          left = Math.min(left, sx);
          right = Math.max(right, sx);
          top = Math.min(top, sy);
          bottom = Math.max(bottom, sy);
        }
        const w = Math.max(MIN_SIZE, right - left);
        const h = Math.max(MIN_SIZE, bottom - top);
        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        link.style.width = `${w}px`;
        link.style.height = `${h}px`;
        link.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`;
      }
    },
    dispose() {
      for (const link of links) link.removeEventListener('focus', onFocus);
    },
  };
}
