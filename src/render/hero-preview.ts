// Turnable hero in the inventory doll (H1 step 5, docs/tasks/h1-hero.md). A second HeroModel (shared
// geometry and materials) in a small scene with three fixed lights, rendered with the game's
// WebGLRenderer into a render target, tone mapped like the game (OutputPass) and copied into a 2D
// canvas. No second WebGL context; the main canvas is never touched. It draws only while the menu is
// open, and only when something changed or the idle loop's next 20 fps frame is due.
import {
  Color, DirectionalLight, Group, HalfFloatType, HemisphereLight, PerspectiveCamera, Scene, Vector3,
  WebGLRenderTarget, type WebGLRenderer,
} from 'three';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { HeroLook } from '../data/hero-look';
import type { ElementId } from '../data/items';
import { Animator, standClip, type CharacterAssets } from './characters';
import { FIST_CLIP, LeftHandIk } from './hand-ik';
import { HeroModel } from './hero-model';
import type { Materials } from './materials';
import { TWO_HAND_STAND, WeaponRack, type WeaponModel } from './weapons';

/** What the doll shows: the game's look and weapon. */
export interface PreviewState {
  look: HeroLook;
  weapon: WeaponModel;
  element: ElementId | undefined;
}

const IDLE_FPS = 20;
/** Radians per pixel of drag, per second of full stick or held key. */
const DRAG_TURN = 0.012;
const STICK_TURN = 3;
const gripPos = new Vector3();
const gripDir = new Vector3();

export class HeroPreview {
  /** The doll picture; InventoryUi re-attaches this element after each re-render. */
  readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(26, 0.75, 0.1, 20);
  private readonly turn = new Group();
  private readonly body: HeroModel;
  private readonly anim: Animator;
  private readonly rack: WeaponRack;
  private readonly ik: LeftHandIk;
  private readonly output = new OutputPass();
  private sceneTarget: WebGLRenderTarget | null = null;
  private outTarget: WebGLRenderTarget | null = null;
  private pixels = new Uint8Array(0);
  private image: ImageData | null = null;
  private yaw = 0.35;
  private open = false;
  private dirty = true;
  private last = 0;
  private sinceDraw = 0;
  private dragX: number | null = null;
  private keyTurn = 0;
  private clip = '';

  constructor(private readonly renderer: WebGLRenderer, assets: CharacterAssets, materials: Materials, private readonly read: () => PreviewState) {
    this.canvas.className = 'inv-portrait';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Figur drehen');
    this.body = new HeroModel(assets.hero);
    this.turn.add(this.body.model);
    this.scene.add(this.turn);
    this.anim = new Animator(this.body.model, assets.heroClips);
    this.rack = new WeaponRack(materials);
    this.body.model.getObjectByName('hand_r')?.add(this.rack.group);
    this.ik = new LeftHandIk(this.body.model, assets.heroClips.get(FIST_CLIP));
    // Three fixed lights: warm key, cool rim, soft fill (the game's warm/cool split).
    const key = new DirectionalLight(0xffe2bd, 2.6);
    key.position.set(1.5, 2.5, 3);
    const rim = new DirectionalLight(0x9fd6d0, 1.6);
    rim.position.set(-2, 2, -2.5);
    this.scene.add(key, rim, new HemisphereLight(0xdfeeff, 0x3a3020, 1.1));
    // U3: the dark brown of the 2D menu, so the doll sits in the panel.
    this.scene.background = new Color(0x1a130e);
    this.camera.position.set(0, 1.0, 4.4);
    this.camera.lookAt(0, 0.93, 0);
    this.bindInput();
  }

  /** Compiles the preview's shader variants up front, so the first menu open does not hitch. */
  async warm(): Promise<void> {
    this.body.showAll();
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  setOpen(on: boolean): void {
    if (on === this.open) return;
    this.open = on;
    this.dirty = true;
    this.dragX = null;
    this.keyTurn = 0;
    if (on) {
      this.last = performance.now();
      requestAnimationFrame(this.tick);
    }
  }

  /** The look or weapon may have changed (equip, unequip). */
  refresh(): void {
    this.dirty = true;
  }

  private readonly tick = (now: number): void => {
    if (!this.open) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const stick = this.stick();
    if (stick || this.keyTurn) {
      this.yaw += (stick + this.keyTurn) * STICK_TURN * dt;
      this.dirty = true;
    }
    this.sinceDraw += dt;
    if (this.dirty || this.sinceDraw >= 1 / IDLE_FPS) this.draw();
    requestAnimationFrame(this.tick);
  };

  /** Right stick X of the first pad that has one (menus use the left stick and the d-pad). */
  private stick(): number {
    for (const pad of navigator.getGamepads?.() ?? []) {
      const x = pad?.axes[2] ?? 0;
      if (Math.abs(x) > 0.2) return x;
    }
    return 0;
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.dragX = e.clientX;
      c.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    c.addEventListener('pointermove', (e) => {
      if (this.dragX === null) return;
      this.yaw += (e.clientX - this.dragX) * DRAG_TURN;
      this.dragX = e.clientX;
      this.dirty = true;
    });
    const end = (): void => { this.dragX = null; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.style.touchAction = 'none';
    c.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!d) return;
      this.keyTurn = d;
      e.preventDefault();
      e.stopPropagation();
    });
    c.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.keyTurn = 0; });
    c.addEventListener('blur', () => { this.keyTurn = 0; });
  }

  private draw(): void {
    const dt = this.sinceDraw;
    this.sinceDraw = 0;
    this.dirty = false;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * Math.min(1.5, window.devicePixelRatio || 1)));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * Math.min(1.5, window.devicePixelRatio || 1)));
    if (!this.canvas.isConnected || this.canvas.clientWidth === 0) return;
    this.resize(w, h);
    // Pose: the game's look, weapon and standing clip (two-handed stance with the left hand on it).
    const s = this.read();
    this.body.setLook(s.look);
    this.rack.show(s.weapon, s.element);
    const kind = this.rack.kind ?? 'blade';
    const clip = standClip(kind, false, this.rack.twoHanded ? 2 : 1);
    if (clip !== this.clip) { this.anim.loop(clip, this.clip ? 0.2 : 0); this.clip = clip; }
    this.turn.rotation.y = this.yaw;
    this.ik.restore();
    this.anim.update(dt);
    this.scene.updateMatrixWorld(true);
    const stance = TWO_HAND_STAND[kind] && this.rack.twoHanded ? 1 : 0;
    // Two-handed models: the left hand on the shaft as far as it reaches (weight = reach fade).
    if (this.rack.twoHanded && this.rack.leftGrip(gripPos, gripDir, stance)) this.ik.pose(this.ik.aim(gripPos, gripDir, stance));
    this.body.sway(0, 0, this.yaw, dt);
    // Render with the game's renderer into our targets, restore its state, copy the pixels.
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = true;
    r.setRenderTarget(this.sceneTarget);
    r.render(this.scene, this.camera);
    this.output.render(r, this.outTarget!, this.sceneTarget!, 0, false);
    r.readRenderTargetPixels(this.outTarget!, 0, 0, w, h, this.pixels);
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAuto;
    // WebGL rows run bottom-up; ImageData top-down.
    const img = this.image!;
    const row = w * 4;
    for (let y = 0; y < h; y++) img.data.set(this.pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    this.ctx.putImageData(img, 0, 0);
  }

  private resize(w: number, h: number): void {
    if (this.canvas.width === w && this.canvas.height === h && this.sceneTarget) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.sceneTarget?.dispose();
    this.outTarget?.dispose();
    this.sceneTarget = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
    this.outTarget = new WebGLRenderTarget(w, h);
    this.pixels = new Uint8Array(w * h * 4);
    this.image = this.ctx.createImageData(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
