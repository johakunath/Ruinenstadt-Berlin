// Ties the scene together: world, characters, effects, camera, post-processing.
// The sim knows nothing about this file; it reads sim state and events and draws them.
import { ALEX_WEATHER, KOEPENICK_WEATHER, MITTE_WEATHER, Weather, XHAIN_WEATHER } from './weather';
import { HeroPreview, type PreviewState } from './hero-preview';
import { heroLook } from '../data/hero-look';
import {
  ACESFilmicToneMapping, BackSide, BufferAttribute, Color, FogExp2, Mesh, MeshBasicMaterial, PCFShadowMap, PMREMGenerator, PointLight, Scene,
  SphereGeometry, Vector3,
  WebGLRenderer, type Object3D, type Texture,
} from 'three';
import { HIT_FEEL } from '../data/combat';
import { lerp } from '../sim/math';
import { DT, type Sim, type SimEvent } from '../sim/types';
import { FollowCamera } from './camera';
import { LandmarkReveal } from './reveal';
import { HeroView, loadCharacters, type CharacterAssets } from './characters';
import { EnemyView } from './enemies';
import { ENEMY_LAYER } from './layers';
import { threatShake } from './threats';
import type { BodyKind } from '../data/enemies';
import { HitDebug, PerfStats } from './debug';
import { Fx } from './fx';
import { LootView } from './loot';
import { ContentView } from './content';
import { leapHeight } from '../sim/abilities';
import type { Look } from './looks';
import { Materials } from './materials';
import { Post } from './post';
import { ShadowClock } from './shadow-rate';
import type { Profile } from './profile';
import { buildWorld, type World } from './world';
import { buildMapWorld } from './map-world';
import { NIGHT_SKY, type Sky } from './sky';
import type { TunnelState } from './tunnel-view';
import { bridgeAwareSurface, groundY, setGround } from './ground';
import { COURTYARD } from '../data/courtyard';
import type { Lot, MapDef } from '../data/map';
import type { Prop } from '../data/courtyard';
import type { BreakableDef } from '../sim/breakables';
import { campPlaceAt, type CampLayout } from '../data/camp-map';
import { campStates } from '../sim/camp';
import { CampStationsView } from './camp-stations';
import { BarrierView } from './barriers';

export interface RendererOptions {
  profile: Profile;
  look: Look;
  /** Time of day (`sky.ts`); night when left out. Its grade must already be merged into `look`. */
  sky?: Sky;
  debugHit: boolean;
  debugFlow: boolean;
  /** `?shadows=boxes`: map chunk meshes cast no shadow, only caster boxes, instanced props and characters. */
  boxShadows?: boolean;
  /** `?cut=off` / `?cut=<meters>`: V1 B cutaway off, or the Hinterhof cut height. */
  cut?: 'off' | number;
  /** M11d: show each landmark once with a camera swing. */
  reveal?: boolean;
  /** ?cam=distance,pitch for close-up checks. */
  cam?: { distance: number; pitch: number };
  /** Expedition map; the gate 1 courtyard when left out. */
  map?: { def: MapDef; lots: Lot[]; props: Prop[]; breakables?: BreakableDef[] };
  /** M15: load the mech bodies (Alexanderplatz, or `?spawn=` of a mech kind elsewhere). */
  mechs?: boolean;
}

/** M20 tunnel view state from the sim: grating times, the hold charge, the end platform's power. */
function tunnelState(sim: Sim, time: number): TunnelState {
  const encs = sim.level.encounters, hi = encs.findIndex((e) => e.hold), r = sim.run, h = r.hold;
  const at = r.index === hi;
  return {
    time,
    gateT: sim.gateT,
    hold: at && r.phase === 'hold' && h ? { k: h.p / h.need, inside: h.inside } : null,
    invite: at && r.phase === 'travel',
    // `wave` still counts the last fight while walking up; it is 1 only after the charge.
    power: hi >= 0 && (r.index > hi || (at && (r.phase === 'pause' || r.phase === 'fight') && r.wave >= 1)) ? (h?.on ?? -1e3) : null,
  };
}

/** Small sky environment for reflections on metal, glass and puddles: the sky gradient above, warm lamps low down. */
function skyEnvironment(renderer: WebGLRenderer, look: Sky): Texture {
  const env = new Scene();
  const sky = new SphereGeometry(50, 24, 12);
  const colors: number[] = [];
  const pos = sky.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 50;
    const t = Math.max(0, h);
    const [hr, hg, hb] = look.env.horizon, [tr, tg, tb] = look.env.top;
    colors.push(hr + (tr - hr) * t, hg + (tg - hg) * t, hb + (tb - hb) * t);
  }
  sky.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  env.add(new Mesh(sky, new MeshBasicMaterial({ vertexColors: true, side: BackSide })));
  const lamp = new SphereGeometry(4, 8, 6);
  for (const [x, y, z, c] of [[-30, 6, -30, 0xffa040], [35, 8, -20, 0xff9a3a], [20, 5, 38, 0xffb060], [-40, 30, 20, 0x9fd6dc]] as Array<[number, number, number, number]>) {
    const m = new Mesh(lamp, new MeshBasicMaterial({ color: new Color(c).multiplyScalar(c === 0x9fd6dc ? 2 : 2.2 * look.env.lamps) }));
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
  /** M11d: camera swing to a landmark the first time the hero comes near (null in the courtyard). */
  readonly reveal: LandmarkReveal | null;
  private readonly post: Post;
  private readonly sky: Sky;
  private readonly fx: Fx;
  private readonly weather: Weather;
  private readonly loot = new LootView();
  private readonly content: ContentView;
  private readonly campView: CampStationsView | null;
  private readonly campLayout: CampLayout | null;
  private readonly hero: HeroView;
  private readonly views = new Map<number, EnemyView>();
  /** V1: living enemies nearest the hero, for their contour behind buildings (half height in m). */
  private outlined: Array<{ root: Object3D; size: number; d: number }> = [];
  /** Spare views per body rig. */
  private readonly pool = new Map<BodyKind, EnemyView[]>();
  private readonly debug: HitDebug | null;
  /** Soft fill that travels with the hero so the fight reads against the dark ground. */
  private readonly heroLight = new PointLight(0xffe2bd, 9, 7, 1.4);
  private time = 0;
  private height = 720;
  /** Sun shadow map rate (profile `shadowInterval`). */
  private readonly shadowClock: ShadowClock;

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly world: World,
    private readonly assets: CharacterAssets,
    private readonly materials: Materials,
    private readonly opts: RendererOptions,
  ) {
    this.shadowClock = new ShadowClock(opts.profile.shadowInterval);
    const Y = COURTYARD.yard;
    const B = opts.map?.def.bounds;
    this.cam = new FollowCamera(
      opts.cam,
      // The south edge front stands about 2 m inside the bound: the frame stops 5 m short so the hero stays on screen above the HUD (M11d step 4).
      B ? { minX: B.minX + 12, maxX: B.maxX - 12, minZ: B.minZ + 6, maxZ: B.maxZ - 5 } : { minX: Y.minX + 4, maxX: Y.maxX - 4, minZ: Y.minZ + 1.5, maxZ: Y.maxZ - 4 },
    );
    const def = opts.map?.def;
    this.reveal = def && opts.reveal ? new LandmarkReveal(def.landmarks, (x, z) => groundY(x, z)) : null;
    setGround(def ? bridgeAwareSurface(def) : () => 0);
    this.sky = opts.sky ?? NIGHT_SKY;
    this.scene.background = new Color(this.sky.background);
    this.scene.fog = new FogExp2(this.sky.fog, this.sky.fogDensity);
    this.scene.environment = skyEnvironment(renderer, this.sky);
    this.scene.environmentIntensity = this.sky.env.intensity;
    this.scene.add(world.group);
    this.hero = new HeroView(assets, materials);
    this.scene.add(this.hero.root, this.heroLight);
    const start = opts.map?.def.start;
    const mistBox = start ? { minX: start.x - 22, maxX: start.x + 22, minZ: start.z - 18, maxZ: start.z + 14 } : COURTYARD.yard;
    // M11c: weather per zone (Köpenick only; the tunnel stays dry).
    this.weather = new Weather(this.scene, def, def?.id === 'koepenick' ? KOEPENICK_WEATHER : def?.id === 'xhain' ? XHAIN_WEATHER : def?.id === 'alex' ? ALEX_WEATHER : def?.id === 'mitte' ? MITTE_WEATHER : {}, opts.profile.embers / 140, this.sky.fogDensity / NIGHT_SKY.fogDensity, this.sky.wet);
    this.fx = new Fx(world.fires, { embers: opts.profile.embers, blobShadows: !opts.profile.enemyShadows, mistBox });
    this.content = new ContentView(assets, materials);
    // M20: the walkable camp's stations (build sites, levels, keepers) and their rings.
    this.campLayout = def?.camp ?? null;
    this.campView = def?.camp ? new CampStationsView(assets, materials, def.camp) : null;
    if (this.campView) this.scene.add(this.campView.group);
    this.scene.add(this.fx.group, this.loot.group, this.content.group);
    this.debug = opts.debugHit || opts.debugFlow ? new HitDebug(opts.debugFlow) : null;
    if (this.debug) this.scene.add(this.debug.lines);
    // R1: the hero outline tests occluders against a sphere around the hero and her weapon. C1: in the
    // Melee_Hook lunge the hand is 1.4 m ahead and the spear tip 2 m further, low (about 3.45 m from the center).
    const hero = this.hero.root;
    // V1: enemies behind buildings get a red contour; spheres around the nearest living ones.
    this.post = new Post(renderer, this.scene, this.cam.camera, opts.profile, opts.look, (out) => out.set(out.center.set(hero.position.x, hero.position.y + 1.1, hero.position.z), 3.5), (out) => {
      let n = 0;
      for (const v of this.outlined) {
        if (n >= out.length) break;
        const r = v.root.position;
        const o = out[n++]!;
        o.center.set(r.x, r.y + v.size, r.z);
        o.radius = v.size * 1.3;
      }
      return n;
    }, (out) => this.content.lootSpheres(out));
    this.resize();
  }

  static async create(canvas: HTMLCanvasElement, opts: RendererOptions): Promise<GameRenderer> {
    const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    // Shadow renders are requested per frame (`ShadowClock`, `Post.render`), never automatic.
    renderer.shadowMap.autoUpdate = false;
    renderer.info.autoReset = false;
    const materials = new Materials(opts.look, opts.profile);
    const world = opts.map ? buildMapWorld(materials, opts.map.def, opts.map.lots, opts.map.props, opts.map.breakables, { boxShadows: opts.boxShadows, cut: opts.cut, sky: opts.sky }) : buildWorld(materials);
    const assets = await loadCharacters(materials, opts.mechs || opts.map?.def.id === 'alex');
    const game = new GameRenderer(renderer, world, assets, materials, opts);
    // Every clothing piece visible for one compile, so equipping never compiles a shader mid-game;
    // the first frame applies the real look.
    game.hero.body.showAll();
    await renderer.compileAsync(game.scene, game.cam.camera);
    return game;
  }

  /** The turnable hero for the inventory doll, drawn with this renderer (H1 step 5). */
  heroPreview(read: () => PreviewState): HeroPreview {
    return new HeroPreview(this.renderer, this.assets, this.materials, read);
  }

  /** Akkusparen: at most 1× pixel ratio (main.ts also caps the frame rate). */
  private eco = false;
  setEco(on: boolean): void {
    if (on === this.eco) return;
    this.eco = on;
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.eco ? 1 : this.opts.profile.maxDpr);
    this.height = h * dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, dpr);
    this.cam.setAspect(w / h);
    this.shadowClock.invalidate();
  }

  /**
   * Call when the sim is replaced (start and restart). A new sim reuses enemy ids, so every
   * enemy view goes back to the pool and is assigned again; the camera snaps to the hero.
   */
  reset(sim: Sim): void {
    for (const view of this.views.values()) this.release(view);
    this.views.clear();
    this.cam.snap(sim.player.x, sim.player.z, groundY(sim.player.x, sim.player.z));
    this.world.follow?.(sim.player.x, sim.player.z, true);
    this.shadowClock.invalidate();
    this.world.breakables?.reset();
    for (const b of sim.breakables) if (b.broken) this.world.breakables?.broke(b.id);
  }

  /** Zoom: +1 farther, -1 nearer, 0 cycles through the three levels. */
  zoom(dir: number): void {
    this.cam.stepZoom(dir);
  }

  private release(view: EnemyView): void {
    view.root.visible = false;
    const list = this.pool.get(view.body) ?? [];
    list.push(view);
    this.pool.set(view.body, list);
  }

  /** Ground point under a pointer position, for mouse aim. */
  groundPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    const p = this.cam.groundPoint((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, tmp);
    return p ? { x: p.x, z: p.z } : null;
  }

  onEvent(ev: SimEvent, sim: Sim): void {
    this.fx.onEvent(ev);
    const y = (x: number, z: number, h: number): number => groundY(x, z) + h;
    const ts = threatShake(ev);
    if (ts > 0) this.cam.shake(0, 0, ts);
    switch (ev.type) {
      case 'hit': {
        this.views.get(ev.id)?.hit();
        const feel = HIT_FEEL[ev.weight];
        // Procs and area ticks (quiet) spark a little and never shake the camera.
        this.fx.sparks(ev.x, groundY(ev.x, ev.z) + 1.15, ev.z, ev.dx, ev.dz, !ev.quiet && (ev.weight === 'heavy' || !!ev.critical));
        if (!ev.quiet) this.cam.shake(ev.dx, ev.dz, feel.shake * (ev.killed ? 1.5 : 1) * (ev.critical ? 1.25 : 1));
        if (ev.killed) this.fx.puff(ev.x, ev.z, 5);
        break;
      }
      case 'dot':
        if (ev.killed) this.fx.puff(ev.x, ev.z, 5);
        break;
      case 'shock':
        this.cam.shake(0, 0, ev.kind === 'earth' ? 0.3 : ev.kind === 'small' ? 0.12 : 0.18);
        break;
      case 'impact':
        this.cam.shake(0, 0, ev.kind === 'boom' ? 0.06 : 0.12);
        break;
      case 'ability':
        if (ev.ultimate) {
          this.fx.burst(sim.player.x, y(sim.player.x, sim.player.z, 1), sim.player.z, 6, 5, 1.6, 40, 7);
          this.cam.shake(0, 0, 0.14);
        }
        break;
      case 'encounterClear':
        // P7 reward moment: a warm gold burst around the hero (one-off particles, no extra light).
        this.fx.burst(sim.player.x, y(sim.player.x, sim.player.z, 1.2), sim.player.z, 6, 4.2, 1.2, 70, 7);
        break;
      case 'secondWind':
        this.fx.burst(sim.player.x, y(sim.player.x, sim.player.z, 1), sim.player.z, 6, 5, 1.6, 60, 8);
        break;
      case 'hidden':
        this.fx.burst(ev.x, y(ev.x, ev.z, 0.9), ev.z, 6, 3.4, 1, 50, 6);
        break;
      case 'shrine':
        this.fx.burst(ev.x, y(ev.x, ev.z, 2.6), ev.z, 2, 4.4, 6, 50, 6);
        break;
      case 'runEvent':
        if (ev.phase === 'done') this.fx.burst(ev.x, y(ev.x, ev.z, 0.8), ev.z, 6, 5, 1.6, 50, 6);
        break;
      case 'pickup':
        if (ev.what === 'food' || ev.what === 'heal') this.fx.burst(sim.player.x, y(sim.player.x, sim.player.z, 0.9), sim.player.z, 1.6, 4.4, 1.2, 16, 3);
        break;
      case 'playerHit':
        this.cam.shake(ev.dx, ev.dz, 0.2);
        this.fx.puff(ev.x, ev.z, 4, 0.6);
        break;
      case 'dodge':
        this.fx.puff(sim.player.x, sim.player.z, 7);
        break;
      case 'gateOpen':
        // M20: the grating drops into its slot (2D `openGate`: orange burst, crash, shake).
        this.fx.burst(ev.x, y(ev.x, ev.z, 1.2), ev.z, 6, 3.6, 0.6, 40, 6);
        this.fx.debris(ev.x, groundY(ev.x, ev.z) + 0.4, ev.z, 'crate', 10);
        this.cam.shake(0, 0, 0.16);
        break;
      case 'power':
        this.fx.burst(ev.x, y(ev.x, ev.z, 1.4), ev.z, 6, 5.5, 2, 60, 7);
        this.cam.shake(0, 0, 0.1);
        break;
      case 'breakableHit':
        this.world.breakables?.hit(ev.id);
        this.fx.debris(ev.x, groundY(ev.x, ev.z) + 0.6, ev.z, ev.kind, 5);
        this.cam.shake(0, 0, 0.04);
        break;
      case 'breakableBreak':
        this.world.breakables?.broke(ev.id);
        this.fx.debris(ev.x, groundY(ev.x, ev.z) + 0.5, ev.z, ev.kind, 22);
        this.fx.puff(ev.x, ev.z, 8, 1.2);
        this.cam.shake(0, 0, 0.12);
        break;
      default:
        break;
    }
  }

  /** CSS-pixel screen position of a world point (may lie off screen). */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    const cam = this.cam.camera;
    const toScreen = (v: Vector3): { x: number; y: number } => {
      v.project(cam);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    };
    // Behind the camera the projection flips. Then use the ground direction from the hero instead:
    // project a point 2 m from the hero toward the target and push it far along that screen ray.
    if (tmpScreen.set(x, y, z).applyMatrix4(cam.matrixWorldInverse).z < -0.1) return toScreen(tmpScreen.set(x, y, z));
    const dx = x - this.heroX;
    const dz = z - this.heroZ;
    const l = Math.hypot(dx, dz) || 1;
    const hy = groundY(this.heroX, this.heroZ);
    const h = toScreen(tmpScreen.set(this.heroX, hy, this.heroZ));
    const a = toScreen(tmpScreen.set(this.heroX + (dx / l) * 2, hy, this.heroZ + (dz / l) * 2));
    const k = 1e4 / (Math.hypot(a.x - h.x, a.y - h.y) || 1);
    return { x: h.x + (a.x - h.x) * k, y: h.y + (a.y - h.y) * k };
  }

  private heroX = 0;
  private heroZ = 0;
  /** P25 Türsteher neon bars at the Tor; built on the first frame of a level that has them. */
  private barriers: BarrierView | null = null;

  render(sim: Sim, alpha: number, dt: number): void {
    this.time += dt;
    const frozen = sim.hitstop > 0;
    const p = sim.player;
    this.world.update(this.time);
    this.world.sync?.(sim.time - DT * (1 - alpha));
    if (this.world.tunnel) this.world.tunnel.update(tunnelState(sim, sim.time - DT * (1 - alpha)), dt);
    if (!this.barriers && sim.level.barriers.length) this.scene.add((this.barriers = new BarrierView(sim.level.barriers)).group);
    this.barriers?.update(sim, dt);
    const leap = leapHeight(sim, frozen ? 1 : alpha);
    const w = sim.equipment.w;
    this.hero.update(p, alpha, dt, frozen, { kind: sim.stats.kind, base: w?.base ?? 'rohr', element: sim.stats.elements[0], spin: sim.abilities.spin, guard: sim.abilities.guard, leap, look: heroLook(sim.equipment) });

    // Enemy views follow the sim list; bodies that left go back to the pool.
    const seen = new Set<number>();
    const profile = this.opts.profile;
    const live: Array<{ root: Object3D; size: number; d: number }> = [];
    for (const e of sim.enemies) {
      seen.add(e.id);
      let view = this.views.get(e.id);
      if (!view) {
        view = this.pool.get(e.def.body)?.pop() ?? new EnemyView(this.assets, this.materials, e.def.body, profile.enemyShadows, { gdr: this.opts.map?.def.id === 'alex', clockRig: this.world.clockRig });
        if (!view.root.parent) this.scene.add(view.root);
        view.assign(e, sim.level.flavor === 'neon');
        view.root.traverse((o) => { if ((o as Mesh).isMesh) o.layers.enable(ENEMY_LAYER); });
        this.views.set(e.id, view);
      }
      let skip = 0;
      if (profile.animHalfRateFrom > 0) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        skip = d > profile.animThirdRateFrom ? 2 : d > profile.animHalfRateFrom ? 1 : 0;
      }
      view.update(e, alpha, dt, frozen, skip);
      if (e.state !== 'dead') {
        const b = e.def.body;
        live.push({ root: view.root, size: b === 'rex' ? 2.4 : b === 'raptor' ? 1.1 : b === 'crow' ? 0.6 : b === 'rat' ? 0.35 : b === 'drone' ? (e.def.boss ? 1 : 0.4) : e.def.scale, d: Math.hypot(e.x - p.x, e.z - p.z) });
      }
    }
    live.sort((a, b) => a.d - b.d);
    this.outlined = live;
    // M15: the Weltzeituhr landmark steps aside while its boss body is up (awake, fighting or settling).
    if (this.world.clock) this.world.clock.visible = !sim.enemies.some((e) => e.kind === 'weltzeituhr');
    for (const [id, view] of this.views) {
      if (seen.has(id)) continue;
      this.views.delete(id);
      this.release(view);
    }

    const px = lerp(p.px, p.x, alpha);
    const pz = lerp(p.pz, p.z, alpha);
    const py = groundY(px, pz);
    this.heroX = px;
    this.heroZ = pz;
    const reveal = this.reveal?.update(dt, px, pz, p.state !== 'dead', this.cam.camera.aspect) ?? null;
    this.cam.update(px, pz, p.state === 'dead' ? 0 : p.vx, p.state === 'dead' ? 0 : p.vz, dt, py, reveal);
    this.heroLight.position.set(px, py + 2.8, pz + 1.6);
    const shadows = this.shadowClock.tick(dt);
    // During a reveal the light pool moves to the landmark and the fog thins, so it reads at distance.
    if (reveal && reveal.weight > 0.5) this.world.follow?.(reveal.look.x, reveal.look.z, shadows);
    else this.world.follow?.(px, pz, shadows);
    (this.scene.fog as FogExp2).density = this.sky.fogDensity * (1 - 0.9 * (reveal?.weight ?? 0));
    this.world.breakables?.update(dt);
    this.loot.update(sim, this.time);
    this.content.update(sim, dt, px, pz);
    if (this.campView && this.campLayout) this.campView.update(campStates(sim), this.time, campPlaceAt(this.campLayout, px, pz)?.id ?? null, px, pz);
    this.fx.update(sim, alpha, dt, frozen, this.cam.pixelScale(this.height), py + leap, this.hero.thrustTipY());
    this.weather.update(dt, px, pz, this.time);
    this.debug?.update(sim, alpha);

    this.renderer.info.reset();
    this.post.render(dt, shadows);
    this.perf.calls = this.renderer.info.render.calls;
    this.perf.triangles = this.renderer.info.render.triangles;
  }
}

