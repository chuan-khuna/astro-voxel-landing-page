/**
 * Data Cards: the page's metric cards (real HTML text inside the World's
 * frame), each laid on the isometric plane over its Landmark with a CSS
 * `matrix3d` from the camera (`placeDataCard`). One shows at a time: the
 * card of the Landmark the camera is near (`nearestDataCard`).
 *
 * `place(camera, state, centre)` re-positions them; call it whenever the camera changes.
 */
import * as THREE from 'three/webgpu';
import type { CameraState } from './cameraMath';
import { dataCardAnchors, nearestDataCard, placeDataCard, type DataCardAnchors } from './dataCardMath';
import { landmarkFocus, type LandmarkFocus } from './landmarkFocus';
import type { PlacedLandmarkId, World } from '@/world';

export interface DataCards {
  /** A new World: new Landmark positions. */
  setWorld(world: World): void;
  /**
   * Show the card of the Landmark the camera is near, laid over it as
   * `camera` sees it. `centre` is where the visitor looks, in CSS px from the
   * frame's centre (y down): the middle of the part a panel leaves free.
   */
  place(camera: THREE.OrthographicCamera, state: CameraState, centre: { x: number; y: number }): void;
}

interface Placed {
  id: PlacedLandmarkId;
  card: HTMLElement;
  anchors: DataCardAnchors;
  focus: LandmarkFocus;
}

/** `cards` are the page's Data Cards, each with `data-card="<placed landmark id>"`. */
export function createDataCards(frame: HTMLElement, cards: HTMLElement[]): DataCards {
  let placed: Placed[] = [];
  const viewProjection = new THREE.Matrix4();

  return {
    setWorld(world) {
      placed = [];
      for (const card of cards) {
        const landmark = world.landmarks.find((l) => l.id === (card.dataset.card as PlacedLandmarkId));
        card.hidden = !landmark;
        card.removeAttribute('data-near');
        if (!landmark) continue;
        placed.push({ id: landmark.id, card, anchors: dataCardAnchors(world, landmark), focus: landmarkFocus(world, landmark.id) });
      }
    },
    place(camera, state, centre) {
      const size = { width: frame.clientWidth, height: frame.clientHeight };
      // CSS px to frame units (world units at zoom 1), y up.
      const k = (camera.top - camera.bottom) / Math.max(1, size.height);
      const shown = nearestDataCard(state, placed, { x: camera.right, y: camera.top }, { x: centre.x * k, y: -centre.y * k });
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      for (const { id, card, anchors } of placed) {
        card.toggleAttribute('data-near', id === shown);
        // A card going away keeps its last place, so it fades out where it was.
        if (id !== shown) continue;
        const m = placeDataCard(viewProjection.elements, size, anchors, { width: card.offsetWidth, height: card.offsetHeight });
        card.style.transform = `matrix3d(${m.map((v) => +v.toFixed(6)).join(',')})`;
      }
    },
  };
}
