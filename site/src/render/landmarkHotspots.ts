/**
 * Landmark hotspots: real links laid over the canvas, one per placed
 * Landmark, sized to the screen rectangle of the Landmark's model (its
 * measured extent, which covers its whole footprint). They give each Landmark a hover
 * affordance, a pointer cursor and keyboard focus without any GPU picking;
 * the links themselves are rendered by the page.
 *
 * The developer inside the House has a link too (`data-hotspot="house-interior"`,
 * to Team), shown only while the House is open (`setInterior`), over the
 * developer in the House Interior's room (`interior.ts`).
 *
 * `place(camera)` re-positions them; call it whenever the camera changes.
 * Focusing a hotspot that is off screen moves the camera onto it.
 */
import * as THREE from 'three/webgpu';
import type { GroundPoint } from './cameraMath';
import type { PlacedLandmarkId, World } from '@/world';
import { landmarkExtent, treeExtent } from './landmarkModels';
import { gardenTrees } from '@/lib/gardenTrees';

/** Smallest hotspot side, in CSS px, so a far-away Landmark is still easy to hit. */
const MIN_SIZE = 28;
/** A tree's link narrower than this, in CSS px, does not take the pointer. */
const MIN_TREE_SIZE = 12;
/** A tree's link size, in screen px per world unit; see `place`. */
const TREE_LINK = { w: 0.7, h: 0.8 };

export interface LandmarkHotspots {
  /** A new World: new Landmark positions, and the box round the developer in its House (world units). */
  setWorld(world: World, developer: THREE.Box3 | null): void;
  /** Show the developer's link while the House is open; hide it while it is shut. */
  setInterior(open: boolean): void;
  /** Move every hotspot onto its Landmark as `camera` sees it. */
  place(camera: THREE.Camera): void;
  dispose(): void;
}

interface Placed {
  link: HTMLElement;
  box: THREE.Box3;
  /** A Garden tree's link (one per Project), rather than a whole Landmark's. */
  tree: boolean;
  /** The developer's link, inside the House: shown only while it is open. */
  interior: boolean;
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
  let open = false;
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
    setWorld(world, developer) {
      placed = [];
      const projectIds = links.flatMap((link) => (link.dataset.project ? [link.dataset.project] : []));
      const trees = new Map(gardenTrees(world, projectIds).map((t) => [t.projectId, t.cell]));
      for (const link of links) {
        if (link.dataset.hotspot === 'house-interior') {
          if (!developer) continue;
          placed.push({ link, box: developer.clone(), tree: false, interior: true });
          link.hidden = !open;
          continue;
        }
        const landmark = world.landmarks.find((l) => l.id === (link.dataset.hotspot as PlacedLandmarkId));
        const project = link.dataset.project;
        const tree = project === undefined ? undefined : trees.get(project);
        if (!landmark || (project !== undefined && !tree)) {
          link.hidden = true;
          continue;
        }
        // The model's own extent, which always covers the whole footprint (and the Dock's jetty);
        // a tree's link covers just its tree.
        const cell = landmark.footprint.origin;
        const origin = new THREE.Vector3(cell.x, landmark.y, cell.z);
        const { min, max } = tree ? treeExtent(landmark, tree) : landmarkExtent(world, landmark);
        placed.push({
          link,
          box: new THREE.Box3(
            new THREE.Vector3(min.x, min.y, min.z).add(origin),
            new THREE.Vector3(max.x, max.y, max.z).add(origin),
          ),
          tree: tree !== undefined,
          interior: false,
        });
        link.hidden = false;
      }
    },
    setInterior(next) {
      open = next;
      for (const p of placed) if (p.interior) p.link.hidden = !open;
    },
    place(camera) {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      for (const { link, box, tree, interior } of placed) {
        if (interior && !open) continue;
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
        let w = Math.max(MIN_SIZE, right - left);
        let h = Math.max(MIN_SIZE, bottom - top);
        if (tree) {
          // Trees stand side by side, and the screen rectangles round their isometric
          // boxes overlap, so a tree's link is only the middle of its tree: with `s` px per
          // world unit (a 1×1 box is √2·s wide), neighbouring trees sit 0.71·s apart
          // across or 0.82·s apart down, so a 0.7·s × 0.8·s link never covers another tree's.
          // One too small to aim at leaves the pointer to the Garden's own link; it
          // still takes keyboard focus.
          const s = (right - left) / Math.SQRT2;
          w = TREE_LINK.w * s;
          h = TREE_LINK.h * s;
          link.toggleAttribute('data-small', w < MIN_TREE_SIZE);
        }
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
