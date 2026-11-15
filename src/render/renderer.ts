// Ties the scene together: world, characters, effects, camera, post-processing.
// The sim knows nothing about this file; it reads sim state and events and draws them.
import {
  ACESFilmicToneMapping, BackSide, BufferAttribute, Color, FogExp2, Mesh, MeshBasicMaterial, PCFShadowMap, PMREMGenerator, PointLight, Scene,
  SphereGeometry, Vector3,
  WebGLRenderer, type Texture,
} from 'three';
import { HIT_FEEL } from '../data/combat';
import { lerp } from '../sim/math';
import type { Sim, SimEvent } from '../sim/types';
import { FollowCamera } from './camera';
import { EnemyView, HeroView, loadCharacters, type CharacterAssets } from './characters';
import { HitDebug, PerfStats } from './debug';
import { Fx } from './fx';
import type { Look } from './looks';
import { Materials } from './materials';
import { Post } from './post';
import type { Profile } from './profile';
import { buildWorld, type World } from './world';
import { buildMapWorld } from './map-world';
import { cutout } from './cutout';
import { groundY, setGround } from './ground';
import { heightAt } from '../data/map';
import { COURTYARD } from '../data/courtyard';
import type { Lot, MapDef } from '../data/map';
import type { Prop } from '../data/courtyard';

export interface RendererOptions {
  profile: Profile;
  look: Look;
  debugHit: boolean;
  debugFlow: boolean;
  /** ?cam=distance,pitch for close-up checks. */
  cam?: { distance: number; pitch: number };
  /** Expedition map; the gate 1 courtyard when left out. */
  map?: { def: MapDef; lots: Lot[]; props: Prop[] };
}

const NIGHT = 0x0b1a1d;

/** Small night-sky environment for reflections on metal, glass and puddles: teal above, warm lamps low down. */
function nightEnvironment(renderer: WebGLRenderer): Texture {
  const env = new Scene();
  const sky = new SphereGeometry(50, 24, 12);
  const colors: number[] = [];
  const pos = sky.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 50;
    const t = Math.max(0, h);
    colors.push(0.03 + 0.1 * t, 0.07 + 0.2 * t, 0.08 + 0.22 * t);
  }
  sky.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  env.add(new Mesh(sky, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  const lamp = new SphereGeometry(4, 8, 6);
  for (const [x, y, z, c] of [[-30, 6, -30, 0xffa040], [35, 8, -20, 0xff9a3a], [20, 5, 38, 0xffb060], [-40, 30, 20, 0x9fd6dc]] as Array<[number, number, number, number]>) {
    const m = new Mesh(lamp, new MeshBasicMaterial({ color: new Color(c).multiplyScalar(c === 0x9fd6dc ? 2 : 2.2) }));
    m.position.set(x, y, z);
    env.add(m);
  }
  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}
const tmp = new Vector3();
const tmpScreen = new Vector3();

export class GameRenderer {
  readonly perf = new PerfStats();
  private readonly scene = new Scene();
  private readonly cam: FollowCamera;
  private readonly post: Post;
  private readonly fx: Fx;
  private readonly hero: HeroView;
  private readonly views = new Map<number, EnemyView>();
  private readonly pool: EnemyView[] = [];
  private readonly debug: HitDebug | null;
  /** Soft fill that travels with the hero so the fight reads against the dark ground. */
  private readonly heroLight = new PointLight(0xffe2bd, 9, 7, 1.4);
  private time = 0;
  private height = 720;

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly world: World,
    private readonly assets: CharacterAssets,
    materials: Materials,
    private readonly opts: RendererOptions,
  ) {
    const Y = COURTYARD.yard;
    const B = opts.map?.def.bounds;
    this.cam = new FollowCamera(
      opts.cam,
      B ? { minX: B.minX + 12, maxX: B.maxX - 12, minZ: B.minZ + 6, maxZ: B.maxZ - 14 } : { minX: Y.minX + 4, maxX: Y.maxX - 4, minZ: Y.minZ + 1.5, maxZ: Y.maxZ - 4 },
    );
    cutout.on.value = opts.map ? 1 : 0;
    const def = opts.map?.def;
    setGround(def ? (x, z) => heightAt(def, x, z) : () => 0);
    this.scene.background = new Color(NIGHT);
    this.scene.fog = new FogExp2(NIGHT, 0.017);
    this.scene.environment = nightEnvironment(renderer);
    this.scene.environmentIntensity = 0.55;
    this.scene.add(world.group);
    this.hero = new HeroView(assets, materials);
    this.scene.add(this.hero.root, this.heroLight);
    const start = opts.map?.def.start;
    const mistBox = start ? { minX: start.x - 22, maxX: start.x + 22, minZ: start.z - 18, maxZ: start.z + 14 } : COURTYARD.yard;
    this.fx = new Fx(world.fires, { embers: opts.profile.embers, blobShadows: !opts.profile.enemyShadows, mistBox });
    this.scene.add(this.fx.group);
    this.debug = opts.debugHit || opts.debugFlow ? new HitDebug(opts.debugFlow) : null;
    if (this.debug) this.scene.add(this.debug.lines);
    this.post = new Post(renderer, this.scene, this.cam.camera, opts.profile, opts.look);
    this.resize();
  }

  static async create(canvas: HTMLCanvasElement, opts: RendererOptions): Promise<GameRenderer> {
    const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.info.autoReset = false;
    const materials = new Materials(opts.look, opts.profile);
    const world = opts.map ? buildMapWorld(materials, opts.map.def, opts.map.lots, opts.map.props) : buildWorld(materials);
    const assets = await loadCharacters(materials);
    return new GameRenderer(renderer, world, assets, materials, opts);
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.opts.profile.maxDpr);
    this.height = h * dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, dpr);
    this.cam.setAspect(w / h);
  }

  /**
   * Call when the sim is replaced (start and restart). A new sim reuses enemy ids, so every
   * enemy view goes back to the pool and is assigned again; the camera snaps to the hero.
   */
  reset(sim: Sim): void {
    for (const view of this.views.values()) {
      view.root.visible = false;
      this.pool.push(view);
    }
    this.views.clear();
    this.cam.snap(sim.player.x, sim.player.z, groundY(sim.player.x, sim.player.z));
    this.world.follow?.(sim.player.x, sim.player.z);
  }

  /** Ground point under a pointer position, for mouse aim. */
  groundPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    const p = this.cam.groundPoint((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, tmp);
    return p ? { x: p.x, z: p.z } : null;
  }

  onEvent(ev: SimEvent, sim: Sim): void {
    switch (ev.type) {
      case 'hit': {
        this.views.get(ev.id)?.hit();
        const feel = HIT_FEEL[ev.weight];
        this.fx.sparks(ev.x, groundY(ev.x, ev.z) + 1.15, ev.z, ev.dx, ev.dz, ev.weight === 'heavy');
        this.cam.shake(ev.dx, ev.dz, feel.shake * (ev.killed ? 1.5 : 1));
        if (ev.killed) this.fx.puff(ev.x, ev.z, 5);
        break;
      }
      case 'playerHit':
        this.cam.shake(ev.dx, ev.dz, 0.2);
        this.fx.puff(ev.x, ev.z, 4, 0.6);
        break;
      case 'dodge':
        this.fx.puff(sim.player.x, sim.player.z, 7);
        break;
      default:
        break;
    }
  }

  /** CSS-pixel screen position of a world point (may lie off screen). */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    const v = tmpScreen.set(x, y, z).project(this.cam.camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  render(sim: Sim, alpha: number, dt: number): void {
    this.time += dt;
    const frozen = sim.hitstop > 0;
    const p = sim.player;
    this.world.update(this.time);
    this.hero.update(p, alpha, dt, frozen);

    // Enemy views follow the sim list; bodies that left go back to the pool.
    const seen = new Set<number>();
    const profile = this.opts.profile;
    for (const e of sim.enemies) {
      seen.add(e.id);
      let view = this.views.get(e.id);
      if (!view) {
        view = this.pool.pop() ?? new EnemyView(this.assets, profile.enemyShadows);
        if (!view.root.parent) this.scene.add(view.root);
        view.assign(e);
        this.views.set(e.id, view);
      }
      let skip = 0;
      if (profile.animHalfRateFrom > 0) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        skip = d > profile.animThirdRateFrom ? 2 : d > profile.animHalfRateFrom ? 1 : 0;
      }
      view.update(e, alpha, dt, frozen, skip);
    }
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      view.root.visible = false;
      this.views.delete(id);
      this.pool.push(view);
    }

    const px = lerp(p.px, p.x, alpha);
    const pz = lerp(p.pz, p.z, alpha);
    const py = groundY(px, pz);
    this.cam.update(px, pz, p.state === 'dead' ? 0 : p.vx, p.state === 'dead' ? 0 : p.vz, dt, py);
    this.heroLight.position.set(px, py + 2.8, pz + 1.6);
    this.world.follow?.(px, pz);
    cutout.hero.value.set(px, py, pz);
    cutout.cam.value.copy(this.cam.position);
    this.fx.update(sim, alpha, dt, frozen, this.cam.pixelScale(this.height));
    this.debug?.update(sim, alpha);

    this.renderer.info.reset();
    this.post.render(dt);
    this.perf.calls = this.renderer.info.render.calls;
    this.perf.triangles = this.renderer.info.render.triangles;
  }
}
