/**
 * The outline round the voxel model a link over the canvas stands for
 * (hovered, focused from the keyboard, or the page now open; which ones is
 * `outlineTargets.ts`). The links stay invisible boxes that take the
 * clicks; the outline follows the model's own silhouette.
 *
 * It is pixelated, to fit the voxels: the screen is cut into square blocks
 * `BLOCK` CSS px a side (whole device px), and a block is in the model's
 * silhouette or not. The blocks just outside it are the outline, in the
 * theme's bright `outline` colour; the blocks just outside those are its
 * dark `outlineEdge`, so it reads on light ground and dark alike (sand,
 * snow, grass, ash and the sea, by Day and at Night). Hard edges, no blur.
 * The colours are `WorldTokens.outline` and `.outlineEdge` (`data/theme.ts`).
 *
 * While nothing is outlined and nothing blooms (by Day, or at Night below
 * the full life tier) the World renders as it always has, straight to the
 * canvas: no extra pass, no extra cost. While something is outlined:
 *
 * 1. the model's mask proxies (`outlineModels.ts`) render flat white into a
 *    mask one texel a block, with no depth from the rest of the World, so
 *    terrain or a building in front never hides the outline (a Landmark is
 *    never hidden by terrain, in the isometric view or here);
 * 2. the World renders through a `RenderPipeline` whose one pass is the
 *    scene, and the outline is laid over its tone-mapped colour, each
 *    pixel looking up its block and the two rings of blocks round it in
 *    the mask (25 nearest taps of a texture a block a texel).
 *
 * The mask pass draws only the outlined model's triangles, into a mask
 * `BLOCK`² times smaller than the canvas; the scene pass is what the
 * renderer does anyway for tone mapping. Both are skipped while nothing is
 * outlined or blooming.
 *
 * At Night at the full life tier the same pipeline also blooms what glows
 * (`setBloom`, polish ticket 16): the scene pass writes its emissive (the
 * Light Sources' flames and lamp glass, the lit windows, the fireflies) to
 * a second target, `BloomNode` blurs it and it is added to the scene's
 * colour before tone mapping, so nothing else blooms; the outline, if any,
 * goes over that (an empty mask when nothing is outlined). The HTML over the
 * canvas never blurs.
 */
import * as THREE from 'three/webgpu';
import { Fn, emissive, float, floor, max, mix, mrt, output, pass, renderOutput, screenUV, texture, uniform, vec2, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { THEME_TOKENS } from '@/data/theme';
import type { Theme } from '@/lib/theme';
import { oklchToLinear } from './palette';
import type { OutlineProxy } from './outlineModels';
import { outlineKey, outlinedKeys, type OutlineLinkState } from './outlineTargets';

/** The bloom round glowing parts at Night: how strong and how wide (`BloomNode`'s strength and radius). */
const BLOOM = { strength: 0.9, radius: 0.45 } as const;

/** A block of the pixelated outline, in CSS px (rounded to whole device px): the width of its bright ring, and of its dark edge. */
export const BLOCK = 3;

/** The blocks round a block, by ring: the eight touching it, then the sixteen round those. */
const ringOffsets = (r: number) => {
  const out: Array<readonly [number, number]> = [];
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.max(Math.abs(x), Math.abs(y)) === r) out.push([x, y]);
  return out;
};

export interface Outline {
  /** Outline these models' proxies (none: render the World as it is). */
  set(proxies: readonly OutlineProxy[]): void;
  /** Bloom the glowing parts (the full life tier at Night, polish ticket 16), or not. */
  setBloom(on: boolean): void;
  /** The outline's colours for the theme. */
  setTheme(theme: Theme): void;
  /** Render one frame of the World, outlined or not. */
  render(): void;
  dispose(): void;
}

/** sRGB-encoded (display) values of a linear colour, for mixing after tone mapping. */
const display = (linear: readonly [number, number, number]) => {
  const c = new THREE.Color().setRGB(...linear, THREE.LinearSRGBColorSpace);
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out, THREE.SRGBColorSpace);
  return new THREE.Vector3(out.r, out.g, out.b);
};

export function createOutline(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera): Outline {
  const maskScene = new THREE.Scene();
  // One texel a block, read texel by texel: hard block edges.
  const mask = new THREE.RenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  const colour = uniform(new THREE.Vector3(1, 1, 1));
  const edgeColour = uniform(new THREE.Vector3(0, 0, 0));
  const blocks = uniform(new THREE.Vector2(1, 1));
  const maskTexture = texture(mask.texture);
  /** The outline laid over the World's tone-mapped colour `world`. */
  const overlay = (world: THREE.Node<'vec4'>) =>
    Fn(() => {
      const block = floor(screenUV.mul(blocks));
      const at = (x: number, y: number) => maskTexture.sample(block.add(vec2(x + 0.5, y + 0.5)).div(blocks)).a;
      const ring = (r: number) => {
        const near = float(0).toVar();
        for (const [x, y] of ringOffsets(r)) near.assign(max(near, at(x, y)));
        return near;
      };
      const outside = at(0, 0).oneMinus();
      const first = ring(1).mul(outside);
      const second = ring(2).mul(outside).mul(first.oneMinus());
      return mix(mix(world, vec4(edgeColour, 1), second), vec4(colour, 1), first);
    })();
  const pipelines: { plain: THREE.RenderPipeline | null; bloom: THREE.RenderPipeline | null } = { plain: null, bloom: null };
  /**
   * The pipeline for an outlined or blooming frame, built the first time it
   * is needed: a World never hovered and never at Night never compiles one.
   * Plain: the scene tone-mapped as the renderer would, then the outline in
   * display colour over it. Bloom: the scene's colour and its emissive parts
   * (`mrt`) apart, the emissive blurred (`bloom`) and added to the colour
   * before tone mapping, so only what glows blooms; then the outline.
   */
  const pipelineFor = (glow: boolean) => {
    const key = glow ? 'bloom' : 'plain';
    const built = pipelines[key];
    if (built) return built;
    const pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputColorTransform = false;
    if (glow) {
      const scenePass = pass(scene, camera);
      scenePass.setMRT(mrt({ output, emissive }));
      const glowing = bloom(scenePass.getTextureNode('emissive'), BLOOM.strength, BLOOM.radius, 0);
      pipeline.outputNode = overlay(renderOutput(scenePass.getTextureNode('output').add(glowing)));
    } else {
      // The scene's pass is made outside the overlay's `Fn`, so it renders (and sizes its target) every frame.
      pipeline.outputNode = overlay(renderOutput(pass(scene, camera)));
    }
    pipelines[key] = pipeline;
    return pipeline;
  };
  let bloomOn = false;
  let proxies: readonly OutlineProxy[] = [];
  const size = new THREE.Vector2();
  const clear = new THREE.Color();

  return {
    set(next) {
      for (const p of proxies) if (!next.includes(p)) maskScene.remove(p.object);
      for (const p of next) if (!proxies.includes(p)) maskScene.add(p.object);
      proxies = next;
    },
    setTheme(theme) {
      const tokens = THEME_TOKENS[theme].world;
      colour.value.copy(display(oklchToLinear(tokens.outline)));
      edgeColour.value.copy(display(oklchToLinear(tokens.outlineEdge)));
    },
    setBloom(on) {
      bloomOn = on;
    },
    render() {
      if (proxies.length === 0 && !bloomOn) {
        renderer.render(scene, camera);
        return;
      }
      // With nothing outlined the mask renders empty: it clears.
      for (const p of proxies) p.sync();
      renderer.getDrawingBufferSize(size);
      const side = Math.max(1, Math.round(BLOCK * renderer.getPixelRatio()));
      blocks.value.set(Math.max(1, Math.floor(size.x / side)), Math.max(1, Math.floor(size.y / side)));
      mask.setSize(blocks.value.x, blocks.value.y);
      const target = renderer.getRenderTarget();
      renderer.getClearColor(clear);
      const alpha = renderer.getClearAlpha();
      renderer.setRenderTarget(mask);
      renderer.setClearColor(0x000000, 0);
      renderer.render(maskScene, camera);
      renderer.setRenderTarget(target);
      renderer.setClearColor(clear, alpha);
      pipelineFor(bloomOn).render();
    },
    dispose() {
      maskScene.clear();
      mask.dispose();
      pipelines.plain?.dispose();
      pipelines.bloom?.dispose();
    },
  };
}

/**
 * Watch the links over the canvas (the hotspots and the Guide's button) and
 * report the keys of the models to outline whenever they change: a link
 * under a mouse or pen, focused from the keyboard, or `aria-current`.
 * Returns a function that stops watching.
 */
export function watchOutlineLinks(links: readonly HTMLElement[], onChange: (keys: string[]) => void): () => void {
  const states = new Map<HTMLElement, OutlineLinkState>(
    links.map((link) => [link, { key: outlineKey(link.dataset), hidden: link.hidden !== false, hovered: false, focusVisible: false, current: false }]),
  );
  let shown = '';
  const update = () => {
    for (const [link, state] of states) {
      // A link hidden under the pointer gets no `pointerleave`: it is not hovered when it shows again.
      if (link.hidden !== false) state.hovered = false;
      state.hidden = link.hidden !== false;
      state.current = link.getAttribute('aria-current') === 'page';
    }
    const keys = outlinedKeys([...states.values()]);
    if (keys.join(' ') === shown) return;
    shown = keys.join(' ');
    onChange(keys);
  };
  const on = (event: Event) => {
    const link = event.currentTarget as HTMLElement;
    const state = states.get(link);
    if (!state) return;
    if (event.type === 'pointerenter') state.hovered = (event as PointerEvent).pointerType !== 'touch';
    else if (event.type === 'pointerleave') state.hovered = false;
    else if (event.type === 'focus') state.focusVisible = link.matches(':focus-visible');
    else if (event.type === 'blur') state.focusVisible = false;
    update();
  };
  const types = ['pointerenter', 'pointerleave', 'focus', 'blur'] as const;
  for (const link of links) for (const type of types) link.addEventListener(type, on);
  const observer = new MutationObserver(update);
  for (const link of links) observer.observe(link, { attributes: true, attributeFilter: ['aria-current', 'hidden'] });
  update();
  return () => {
    observer.disconnect();
    for (const link of links) for (const type of types) link.removeEventListener(type, on);
  };
}
