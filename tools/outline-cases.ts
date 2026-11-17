// Browser-only rendering regression fixture. Never imported by the game or production build.
import { BoxGeometry, CapsuleGeometry, Color, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera,
  Scene, type Sphere, WebGLRenderer, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { HeroOutline } from '../src/render/hero-outline';
import { BatchSet } from '../src/render/batch';
import { HERO_LAYER } from '../src/render/layers';

export function runCases(): Array<{ name: string; scale: number; changedPixels: number; expected: boolean }> {
  const results = [];
  const renderer = new WebGLRenderer({ antialias: false });
  renderer.setSize(256, 256);
  renderer.setClearColor(0x101820);
  const cases = [
    { name: 'behind building', x: 0, z: 2, large: true, expected: true },
    { name: 'beside building', x: 3.4, z: 2, large: true, expected: false },
    { name: 'in front of building', x: 0, z: -2, large: true, expected: false },
    { name: 'behind crate', x: 0, z: 2, large: false, expected: false },
    { name: 'behind tree', x: 0, z: 2, large: false, expected: false },
    { name: 'behind enemy', x: 0, z: 2, large: false, expected: false },
    { name: 'behind lamp', x: 0, z: 2, large: false, expected: false },
    // R1: weapons are on the hero layer (PR #18). The hero stands beside the building; only the
    // weapon reaches behind it, which the skip test must not miss (sphere around hero and weapon).
    { name: 'hammer behind building', x: 2.6, z: 2, large: true, expected: true, weapon: { length: 1.1, head: 0.28 } },
    { name: 'spear behind building', x: 3.1, z: 2, large: true, expected: true, weapon: { length: 2.0, head: 0.06 } },
  ] as Array<{ name: string; x: number; z: number; large: boolean; expected: boolean; weapon?: { length: number; head: number } }>;
  for (const scale of [1, 0.75]) for (const c of cases) {
    const scene = new Scene();
    scene.background = new Color(0x101820);
    const camera = new PerspectiveCamera(40, 1, 0.5, 30);
    camera.position.set(0, 2, 8); camera.lookAt(0, 1, 0);
    const hero = new Mesh(new CapsuleGeometry(0.35, 0.8, 4, 8), new MeshBasicMaterial({ color: 0x2463a5 }));
    hero.position.y = 1;
    hero.layers.enable(HERO_LAYER);
    scene.add(hero);
    let weapon: Mesh | null = null;
    if (c.weapon) {
      // Held out to the hero's side toward the building (-x), shaft plus head; the building stands at x 0.
      const { length, head } = c.weapon;
      weapon = new Mesh(new BoxGeometry(length, 0.05, 0.05), new MeshBasicMaterial({ color: 0x8a6a40 }));
      weapon.position.set(c.x - 0.3 - length / 2, 1.1, 0);
      const tip = new Mesh(new BoxGeometry(head, head, head), weapon.material);
      tip.position.x = -length / 2;
      weapon.add(tip);
      for (const o of [weapon, tip]) o.layers.enable(HERO_LAYER);
      scene.add(weapon);
      hero.position.x = c.x;
    }
    // Same opaque material and geometry for positive and negative cases: classification alone differs.
    const batches = new BatchSet(), wall = new BoxGeometry(2.5, 3, 0.5);
    const material = new MeshBasicMaterial({ color: 0x555555 });
    const build = (): void => batches.of(material).add(wall, c.weapon ? new Matrix4().makeTranslation(0, 1.5, c.z) : new Matrix4().makeTranslation(c.x, 1.5, c.z));
    if (c.large) batches.captureOccluder(build); else build();
    const beautyMeshes = batches.meshes();
    scene.add(...beautyMeshes);
    const mask = batches.occluderMesh();
    if (mask) scene.add(mask);
    const composer = new EffectComposer(renderer, new WebGLRenderTarget(256, 256));
    composer.renderToScreen = false;
    composer.addPass(new RenderPass(scene, camera));
    // Same bounds rule as the game (renderer.ts): a 2.7 m sphere around the hero.
    const outline = new HeroOutline(scene, camera, (out: Sphere) => out.set(out.center.set(hero.position.x, hero.position.y + 0.1, hero.position.z), 2.7));
    composer.addPass(outline);
    outline.resizeMasks(256, 256, 1, scale);
    outline.enabled = false;
    composer.render();
    const before = new Uint8Array(256 * 256 * 4), after = new Uint8Array(before.length);
    renderer.readRenderTargetPixels(composer.readBuffer, 0, 0, 256, 256, before);
    const savedLayers = camera.layers.mask;
    outline.prepare(renderer);
    if (camera.layers.mask !== savedLayers || scene.overrideMaterial !== null) throw new Error('Render state leaked');
    outline.enabled = true;
    composer.render();
    renderer.readRenderTargetPixels(composer.readBuffer, 0, 0, 256, 256, after);
    let changedPixels = 0;
    for (let i = 0; i < before.length; i += 4) if (Math.abs(after[i]! - before[i]!) + Math.abs(after[i + 1]! - before[i + 1]!) + Math.abs(after[i + 2]! - before[i + 2]!) > 3) changedPixels++;
    results.push({ name: c.name, scale, changedPixels, expected: c.expected });
    outline.dispose(); composer.dispose();
    hero.geometry.dispose(); (hero.material as MeshBasicMaterial).dispose();
    if (weapon) { weapon.geometry.dispose(); (weapon.material as MeshBasicMaterial).dispose(); }
    wall.dispose(); material.dispose();
    for (const mesh of beautyMeshes) mesh.geometry.dispose();
    mask?.geometry.dispose();
  }
  renderer.dispose();
  return results;
}
