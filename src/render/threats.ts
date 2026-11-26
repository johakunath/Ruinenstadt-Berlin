// What enemies put into the world (M12): marked circles that fill until they go off, rush lines,
// shots, burning and acid ground, roar rings, the gold ring under an open body. Pooled, unlit,
// on the FX layer: no lights, no shadows, the same cost on both profiles.
// M12c: the Wachdrohne's searchlight (a decal and a beam per spot, at most two), the pink ring under a
// winding Boxenkopf, sparks over dazed drones. Each visible piece is one draw call, nothing else.
// M15: hour sectors of the Weltzeituhr (ring slices), its minute hand (a turning strip), green root
// circles and the roots round a held hero.
// WP5: the pink ring under a howling Heuler, its harmless howl ring (half as bright), pink sparks over driven bodies.
// M16: white-violet glass bursts with a shard spray (pooled particles), the Diva's prism strips (three slots), a
// gold ring under a guarded Ringvater and a warm one under the real Spiegelpaar, the Conférencier's spotlight from
// above. Each visible piece is one draw call; no lights.
import {
  AdditiveBlending, CircleGeometry, Color, ConeGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, SphereGeometry, Sprite, SpriteMaterial,
  Vector3,
} from 'three';
import { BOSS, THREAT } from '../data/enemies';
import { guarded } from '../sim/combat';
import { lerp, Rng } from '../sim/math';
import { sweepAngle } from '../sim/threats';
import type { Sim, SimEvent } from '../sim/types';
import type { Emitters } from './abilities';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
import { paintGlow } from './paint';
import { ownHeight } from './enemies';

const BARS = 18;
/** Where the life bar floats, per body. */
const BAR_Y = { zombie: 2.05, human: 2.05, female: 2, raptor: 1.55, rex: 3.9, crow: 2.2, rat: 0.6, drone: 2.4, mech: 2.3, mechBig: 4, kern: 1.25, koloss: 6.5, clock: 9, carpet: 2.3 } as const;
const ZONES = 18, LINES = 6, SHOTS = 96, HAZARDS = 60, WAVES = 8, OPEN = 6, SPOTS = 2, PULSES = 6, SECTORS = 5, HANDS = 2, STRIPS = 3, MARKS = 2;
const ZONE_COLOR = {
  slam: 0xff4a1e, flame: 0xff7a1e, bomb: 0xff2a2a, tail: 0xff4a1e, acid: 0x8fe04a, shove: 0xffa03a, land: 0x43d1cf, root: 0x97c459, slab: 0xffa03a, hour: 0xff3a2a,
  // M16: white-violet shard bursts, the Logenbrecher's crimson blow, the prism ray, the gold applause.
  shard: 0xd8b8ff, faust: 0xff3a5a, prism: 0xbfe8ff, applause: 0xffc84a,
  // M18: the Tee-Ifrit's glass (tea amber), the Sultan's carpet strip (ruby).
  tea: 0xffa040, carpet: 0xd0284a,
} as const;
/** Hour sector geometry: inner radius as a share of the outer (3 of 9 m), one of 24 slices, centred on angle 0. */
const SECTOR_IN = BOSS.weltzeituhr.r0 / BOSS.weltzeituhr.r1, SECTOR_HALF = Math.PI / 24;
const up = new Vector3(0, 1, 0);
const dirV = new Vector3();
const m4 = new Matrix4();
const col = new Color();

function fx<T extends Mesh | InstancedMesh>(m: T, order = 3): T {
  m.layers.set(FX_LAYER);
  m.renderOrder = order;
  m.frustumCulled = false;
  return m;
}
const add = (color: number, opacity = 1): MeshBasicMaterial => new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
const flat = (m: Mesh): Mesh => {
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  return m;
};

export class ThreatView {
  readonly group = new Group();
  private readonly rng = new Rng(11);
  private readonly zones: Array<{ rim: Mesh; fill: Mesh }> = [];
  private readonly lines: Mesh[] = [];
  private readonly waves: Mesh[] = [];
  private readonly open: Mesh[] = [];
  private readonly spots: Array<{ rim: Mesh; fill: Mesh; beam: Mesh }> = [];
  private readonly pulses: Mesh[] = [];
  /** M12c: the pink ring round a hero the Türsteher holds; it closes as the hold runs out. */
  private readonly held: Mesh;
  private readonly globs: InstancedMesh;
  private readonly bossShots: InstancedMesh;
  private readonly hazards: InstancedMesh;
  private readonly bars: Array<{ back: Sprite; fill: Sprite }> = [];
  private readonly sectors: Array<{ rim: Mesh; fill: Mesh }> = [];
  private readonly hands: Mesh[] = [];
  /** M15: the green roots round a hero a Wurzler holds. */
  private readonly roots: Mesh;
  /** M16: the Diva's prism strips, and the rings that mark a guarded Ringvater and the real Spiegelpaar. */
  private readonly strips: Mesh[] = [];
  private readonly marks: Mesh[] = [];
  private time = 0;

  constructor(private readonly emit: Emitters) {
    // Small life bars over hurt enemies (playtest 2026-11-17); bosses always, wider and gold (playtest 2026-11-20),
    // on top of the big bar in the HUD.
    for (let i = 0; i < BARS; i++) {
      const mk = (color: number, order: number): Sprite => {
        const sp = new Sprite(new SpriteMaterial({ color, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 0.9 }));
        sp.center.set(0, 0.5);
        sp.layers.set(FX_LAYER);
        sp.renderOrder = order;
        sp.visible = false;
        this.group.add(sp);
        return sp;
      };
      this.bars.push({ back: mk(0x120c0a, 8), fill: mk(0xd8452e, 9) });
    }
    for (let i = 0; i < ZONES; i++) {
      const rim = fx(flat(new Mesh(new RingGeometry(0.93, 1, 48), add(0xff4a1e, 0.85))), 2);
      const fill = fx(flat(new Mesh(new CircleGeometry(1, 36), add(0xff4a1e, 0.3))), 2);
      this.group.add(rim, fill);
      this.zones.push({ rim, fill });
    }
    for (let i = 0; i < SECTORS; i++) {
      const rim = fx(flat(new Mesh(new RingGeometry(SECTOR_IN, 1, 6, 1, -SECTOR_HALF, SECTOR_HALF * 2), add(0xff3a2a, 0.5))), 2);
      const fill = fx(flat(new Mesh(new RingGeometry(SECTOR_IN, 1, 6, 1, -SECTOR_HALF, SECTOR_HALF * 2), add(0xff3a2a, 0.3))), 2);
      this.group.add(rim, fill);
      this.sectors.push({ rim, fill });
    }
    for (let i = 0; i < HANDS; i++) {
      const g = new PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
      const m = fx(new Mesh(g, add(0xff2a1e, 0.5)), 3);
      m.visible = false;
      this.group.add(m);
      this.hands.push(m);
    }
    this.roots = fx(flat(new Mesh(new RingGeometry(0.35, 0.62, 10, 1), add(0x97c459, 0.8))), 3);
    this.group.add(this.roots);
    for (let i = 0; i < STRIPS; i++) {
      const m = fx(new Mesh(new PlaneGeometry(1, 1), add(ZONE_COLOR.prism, 0.4)), 2);
      m.visible = false;
      this.group.add(m);
      this.strips.push(m);
    }
    for (let i = 0; i < MARKS; i++) {
      const m = fx(flat(new Mesh(new RingGeometry(0.88, 1, 40), add(0xf2d14b, 0.8))), 2);
      this.group.add(m);
      this.marks.push(m);
    }
    for (let i = 0; i < LINES; i++) {
      const g = new PlaneGeometry(1, 1);
      g.translate(0, 0.5, 0);
      const m = fx(new Mesh(g, add(0xff3a1e, 0.4)), 2);
      m.visible = false;
      this.group.add(m);
      this.lines.push(m);
    }
    for (let i = 0; i < WAVES; i++) {
      const m = fx(flat(new Mesh(new RingGeometry(0.955, 1, 72), add(0xff5a8a, 0.9))), 3);
      this.group.add(m);
      this.waves.push(m);
    }
    for (let i = 0; i < OPEN; i++) {
      // Punish window: white, not yellow (playtest 2026-11-18: yellow reads as an NPC talk ring).
      const m = fx(flat(new Mesh(new RingGeometry(0.86, 1, 36, 1, 0, Math.PI * 1.7), add(0xf4f1ea, 0.9))), 2);
      this.group.add(m);
      this.open.push(m);
    }
    for (let i = 0; i < SPOTS; i++) {
      const rim = fx(flat(new Mesh(new RingGeometry(0.9, 1, 48), add(0xd8fff8, 0.8))), 2);
      const fill = fx(flat(new Mesh(new CircleGeometry(1, 36), add(0x9ff0ea, 0.22))), 2);
      // The beam from the lens to the spot: an open cone, tip at the top.
      const cone = new ConeGeometry(1, 1, 20, 1, true);
      cone.translate(0, -0.5, 0);
      const beam = fx(new Mesh(cone, add(0x9ff0ea, 0.045)), 4);
      beam.visible = false;
      this.group.add(rim, fill, beam);
      this.spots.push({ rim, fill, beam });
    }
    for (let i = 0; i < PULSES; i++) {
      const m = fx(flat(new Mesh(new RingGeometry(0.82, 1, 40), add(0xff4fa3, 0.7))), 2);
      this.group.add(m);
      this.pulses.push(m);
    }
    this.held = fx(flat(new Mesh(new RingGeometry(0.8, 1, 40), add(0xff4fa3, 0.9))), 3);
    this.group.add(this.held);
    const inst = (r: number, color: number): InstancedMesh => {
      const m = fx(new InstancedMesh(new SphereGeometry(r, 8, 6), new MeshBasicMaterial({ color, fog: false }), SHOTS), 5);
      m.count = 0;
      this.group.add(m);
      return m;
    };
    this.globs = inst(1, 0xc8ff7a);
    this.bossShots = inst(1, 0xffb060);
    const disc = new PlaneGeometry(2.6, 2.6);
    disc.rotateX(-Math.PI / 2);
    this.hazards = fx(new InstancedMesh(disc, new MeshBasicMaterial({ map: paintGlow('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }), HAZARDS), 2);
    this.hazards.count = 0;
    this.group.add(this.hazards);
  }

  onEvent(ev: SimEvent): void {
    const E = this.emit;
    const R = this.rng;
    if (ev.type === 'zoneHit' && (ev.kind === 'shard' || ev.kind === 'applause' || ev.kind === 'prism' || ev.kind === 'carpet')) {
      // M16: a glass burst throws white-violet shards up and out; applause gold sparks; the prism ray a white flash.
      const y = groundY(ev.x, ev.z);
      const n = ev.kind === 'prism' || ev.kind === 'carpet' ? 10 : Math.round(16 + ev.r * 8);
      const [r, g, b] = ev.kind === 'applause' ? [5, 3.6, 1.2] : ev.kind === 'prism' ? [3, 4.2, 5] : ev.kind === 'carpet' ? [5, 1.6, 1.4] : [3.6, 3, 5];
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), d = Math.sqrt(R.next()) * ev.r * 0.6, s = R.range(1.5, 5);
        E.glow(ev.x + Math.sin(a) * d, y + R.range(0.2, 1.2), ev.z + Math.cos(a) * d, Math.sin(a) * s, R.range(2, 6), Math.cos(a) * s, R.range(0.3, 0.7), R.range(0.05, 0.12), r, g, b, 14, 0.4);
      }
    } else if (ev.type === 'zoneHit') {
      const y = groundY(ev.x, ev.z);
      const fire = ev.kind === 'flame' || ev.kind === 'bomb' || ev.kind === 'tea';
      const n = Math.round(14 + ev.r * 8);
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), d = Math.sqrt(R.next()) * ev.r;
        E.dust(ev.x + Math.sin(a) * d, y + 0.15, ev.z + Math.cos(a) * d, Math.sin(a) * R.range(0.5, 2.5), R.range(0.6, 2.4), Math.cos(a) * R.range(0.5, 2.5), R.range(0.4, 0.8), R.range(0.5, 1), 0.2, 0.18, 0.16);
        if (fire || i % 2 === 0) E.glow(ev.x + Math.sin(a) * d, y + 0.2, ev.z + Math.cos(a) * d, Math.sin(a) * R.range(0, 3), R.range(2, 7), Math.cos(a) * R.range(0, 3), R.range(0.2, 0.55), R.range(0.1, fire ? 0.5 : 0.18), 5, fire ? 2 : 3.2, fire ? 0.5 : 1.6, 12, 0.3);
      }
    } else if (ev.type === 'enemyShot') {
      const y = groundY(ev.x, ev.z) + 1.2;
      for (let i = 0; i < 6; i++) E.glow(ev.x, y, ev.z, R.range(-2, 2), R.range(0, 2), R.range(-2, 2), R.range(0.15, 0.35), 0.1, ev.boss ? 5 : 1.6, ev.boss ? 2.6 : 4.4, 0.6, 3);
    } else if (ev.type === 'summon' || ev.type === 'bossRage') {
      if (ev.type === 'summon') for (let i = 0; i < 16; i++) E.dust(ev.x + R.range(-1.6, 1.6), groundY(ev.x, ev.z) + 0.1, ev.z + R.range(-1.6, 1.6), 0, R.range(0.8, 2), 0, R.range(0.5, 0.9), R.range(0.5, 0.9), 0.2, 0.22, 0.16);
    }
  }

  private drawZone(m: { rim: Mesh; fill: Mesh }, z: Sim['threats']['zones'][number], k: number, y: number): void {
    m.rim.visible = m.fill.visible = true;
    m.rim.position.set(z.x, y, z.z);
    m.fill.position.set(z.x, y, z.z);
    m.rim.scale.setScalar(z.r);
    m.fill.scale.setScalar(z.r * Math.max(0.05, k));
    const c = ZONE_COLOR[z.kind];
    (m.rim.material as MeshBasicMaterial).color.setHex(c);
    (m.fill.material as MeshBasicMaterial).color.setHex(k > 0.85 ? 0xffd6a0 : c);
    (m.fill.material as MeshBasicMaterial).opacity = 0.22 + 0.3 * k;
  }

  update(s: Sim, alpha: number, dt: number): void {
    this.time += dt;
    const T = s.threats;
    const E = this.emit;
    const R = this.rng;

    // Marked circles: the fill grows to the rim, then the circle goes off. Hour sectors are slices of a ring.
    let nz = 0, ns = 0, nt = 0;
    for (const z of T.zones) {
      const k = 1 - Math.max(0, z.t) / z.max;
      const y = groundY(z.x, z.z) + 0.07;
      if (z.line) {
        // M16 prism ray: a thin strip on the ground while it winds up, the full width bright while it hits.
        if (nt >= STRIPS) continue;
        const m = this.strips[nt++]!;
        m.visible = true;
        m.position.set(z.x, y + 0.02, z.z);
        m.rotation.set(Math.PI / 2, Math.atan2(z.line.dx, z.line.dz), 0, 'YXZ');
        const live = z.t <= 0;
        m.scale.set(live ? z.line.width : z.line.width * (0.15 + 0.35 * k), z.line.half * 2, 1);
        (m.material as MeshBasicMaterial).opacity = live ? 0.85 : 0.18 + 0.3 * k + 0.1 * Math.sin(this.time * 30) ** 2;
        // M18: the Sultan's carpet strip is ruby, bright gold while it hits.
        const rug = z.kind === 'carpet';
        (m.material as MeshBasicMaterial).color.setHex(live ? (rug ? 0xffd070 : 0xffffff) : rug ? ZONE_COLOR.carpet : ZONE_COLOR.prism);
        continue;
      }
      if (z.sector) {
        if (ns >= SECTORS) continue;
        const m = this.sectors[ns++]!;
        m.rim.visible = m.fill.visible = true;
        for (const q of [m.rim, m.fill]) {
          q.position.set(z.x, y, z.z);
          q.scale.setScalar(z.r);
          // Ring angle θ lies at sim angle θ + 90° once the mesh is laid flat.
          q.rotation.z = z.sector.a - Math.PI / 2;
        }
        (m.rim.material as MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(this.time * 18) ** 2;
        (m.fill.material as MeshBasicMaterial).color.setHex(k > 0.85 ? 0xffd6a0 : ZONE_COLOR.hour);
        (m.fill.material as MeshBasicMaterial).opacity = 0.12 + 0.45 * k;
        continue;
      }
      if (nz >= ZONES) continue;
      this.drawZone(this.zones[nz++]!, z, k, y);
    }
    for (let i = nz; i < ZONES; i++) this.zones[i]!.rim.visible = this.zones[i]!.fill.visible = false;
    for (let i = nt; i < STRIPS; i++) this.strips[i]!.visible = false;
    for (let i = ns; i < SECTORS; i++) this.sectors[i]!.rim.visible = this.sectors[i]!.fill.visible = false;

    // The minute hand: faint while it is only shown, bright while it sweeps.
    this.hands.forEach((m, i) => {
      const w = T.sweeps[i];
      m.visible = !!w;
      if (!w) return;
      const t = w.t - w.wind + dt * alpha;
      m.position.set(w.x, groundY(w.x, w.z) + 0.09, w.z);
      m.rotation.set(Math.PI / 2, sweepAngle(w, t), 0, 'YXZ');
      m.scale.set(w.width * 2, w.r, 1);
      (m.material as MeshBasicMaterial).opacity = t < 0 ? 0.2 + 0.25 * (w.t / w.wind) : 0.85;
    });

    // Roots round a held hero (a Wurzler; the Türsteher's grab shows its own pink ring below).
    const p = s.player;
    this.roots.visible = p.root > 0 && p.rootBy === 0;
    if (this.roots.visible) {
      const x = lerp(p.px, p.x, alpha), z = lerp(p.pz, p.z, alpha);
      this.roots.position.set(x, groundY(x, z) + 0.08, z);
      this.roots.rotation.z = Math.sin(this.time * 9) * 0.2;
    }


    // Rush lines while a pounce, lunge, dive or charge winds up; the gold ring under open bodies.
    let nl = 0, no = 0, np = 0, nm = 0;
    for (const e of s.enemies) {
      if (e.state === 'dead') continue;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      const sp = e.sp;
      // M16: a gold ring while the Ringvater's guard lives; a warm ring under the real Spiegelpaar (her reflection has none).
      const mark = (e.kind === 'ringvater' && guarded(s, e)) || e.kind === 'spiegelpaar';
      if (mark && nm < MARKS) {
        const m = this.marks[nm++]!;
        m.visible = true;
        m.position.set(x, groundY(x, z) + 0.085, z);
        m.scale.setScalar(e.def.radius * (e.kind === 'ringvater' ? 2.4 : 1.9));
        (m.material as MeshBasicMaterial).color.setHex(e.kind === 'ringvater' ? 0xf2d14b : 0xff6a7a);
        (m.material as MeshBasicMaterial).opacity = 0.55 + 0.25 * Math.sin(this.time * 4);
      }
      // M12c: a pink ring fills under a body that winds up a bass ring or a beat.
      if (e.state === 'special' && sp && (sp.kind === 'bass' || sp.kind === 'beat' || sp.kind === 'howl') && e.stateT < sp.wind && np < PULSES) {
        const m = this.pulses[np++]!;
        const k = e.stateT / sp.wind;
        m.visible = true;
        m.position.set(x, groundY(x, z) + 0.09, z);
        m.scale.setScalar(e.def.radius * (1.4 + 1.6 * k));
        (m.material as MeshBasicMaterial).opacity = 0.35 + 0.5 * k;
      }
      // WP5 Zünder: sparks fly off the burning fuse, a shower of them while it burns down.
      if (e.kind === 'zuender' && R.next() < dt * (e.state === 'special' && sp?.kind === 'fuse' ? 40 : 4)) {
        const y = groundY(x, z) + 1.3 * e.def.scale;
        E.glow(x + R.range(-0.1, 0.1), y, z + R.range(-0.1, 0.1), R.range(-1.2, 1.2), R.range(1, 2.6), R.range(-1.2, 1.2), R.range(0.2, 0.45), 0.05, 6, 3.4, 1, 6);
      }
      // H3: embers fly up off the Brandmeister's burning helmet.
      if (e.kind === 'brandmeister' && R.next() < dt * 14) {
        const y = groundY(x, z) + 1.95 * e.def.scale;
        E.glow(x + R.range(-0.2, 0.2), y, z + R.range(-0.2, 0.2), R.range(-0.5, 0.5), R.range(1.2, 2.8), R.range(-0.5, 0.5), R.range(0.4, 0.8), 0.06, 6, 2.6, 0.6, -1);
      }
      // Driven on by a howl or a bass ring: faint pink sparks rise off the body.
      if (e.buff > 0 && R.next() < dt * 5) E.glow(x + R.range(-0.3, 0.3), groundY(x, z) + R.range(0.8, 1.6), z + R.range(-0.3, 0.3), 0, R.range(0.6, 1.2), 0, R.range(0.4, 0.7), 0.08, 5, 1.4, 2.6, 0);
      // Dazed drones spark.
      if (e.kind === 'drone' && e.rest > 0 && R.next() < dt * 14) E.glow(x, groundY(x, z) + 0.6, z, R.range(-1.5, 1.5), R.range(0.5, 2.5), R.range(-1.5, 1.5), R.range(0.15, 0.3), 0.06, 3, 4.5, 6, 6);
      // M18: the Teppichschlinger's dive is marked (its line is locked at the start of the wind-up).
      if (e.state === 'special' && sp && sp.speed > 0 && (sp.kind !== 'dive' || e.kind === 'teppich') && e.stateT < sp.wind && nl < LINES) {
        const m = this.lines[nl++]!;
        const k = e.stateT / sp.wind;
        m.visible = true;
        m.position.set(x, groundY(x, z) + 0.06, z);
        // The strip lies on the ground and runs from the body along the locked direction.
        m.rotation.set(Math.PI / 2, Math.atan2(sp.dx, sp.dz), 0, 'YXZ');
        m.scale.set(e.def.radius * 2, sp.speed * sp.go + e.def.radius, 1);
        (m.material as MeshBasicMaterial).opacity = 0.16 + 0.4 * k;
      }
      if (e.open > 0 && no < OPEN) {
        const m = this.open[no++]!;
        m.visible = true;
        m.position.set(x, groundY(x, z) + 0.08, z);
        m.rotation.z = this.time * 2.4;
        m.scale.setScalar(e.def.radius * 2.1);
        (m.material as MeshBasicMaterial).opacity = Math.min(0.9, e.open * 3);
      }
    }
    for (let i = nl; i < LINES; i++) this.lines[i]!.visible = false;
    for (let i = no; i < OPEN; i++) this.open[i]!.visible = false;
    for (let i = np; i < PULSES; i++) this.pulses[i]!.visible = false;
    for (let i = nm; i < MARKS; i++) this.marks[i]!.visible = false;

    // M12c: held by the Türsteher.
    const hp = s.player;
    this.held.visible = hp.root > 0 && hp.rootBy !== 0 && hp.state !== 'dead';
    if (this.held.visible) {
      const x = lerp(hp.px, hp.x, alpha), z = lerp(hp.pz, hp.z, alpha);
      this.held.position.set(x, groundY(x, z) + 0.1, z);
      this.held.scale.setScalar(0.55 + 0.6 * hp.root);
      (this.held.material as MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(this.time * 18);
    }

    // M12c searchlights: white-cyan, brighter while the hero stands in it, red when it locks.
    this.spots.forEach((m, i) => {
      const q = T.spots[i];
      m.rim.visible = m.fill.visible = m.beam.visible = !!q;
      if (!q) return;
      const x = lerp(q.px, q.x, alpha), z = lerp(q.pz, q.z, alpha), y = groundY(x, z);
      const lock = q.flash > 0 ? 1 : 0;
      const heat = Math.min(1, q.inT / 0.6);
      m.rim.position.set(x, y + 0.075, z);
      m.fill.position.set(x, y + 0.07, z);
      m.rim.scale.setScalar(q.r);
      m.fill.scale.setScalar(q.r * (1 - 0.25 * heat));
      const c = lock ? (Math.sin(this.time * 40) > 0 ? 0xff2a2a : 0xff8060) : 0xd8fff8;
      (m.rim.material as MeshBasicMaterial).color.setHex(c);
      (m.fill.material as MeshBasicMaterial).color.setHex(lock ? 0xff3a2a : 0x9ff0ea);
      (m.fill.material as MeshBasicMaterial).opacity = 0.18 + 0.25 * heat + 0.3 * lock;
      (m.rim.material as MeshBasicMaterial).opacity = q.cool > 0 ? 0.35 : 0.85;
      // Beam from the source's lens down to the spot.
      const src = s.enemies.find((e) => e.id === q.src);
      if (!src) { m.beam.visible = false; return; }
      // M16: the Conférencier's spotlight falls from high above the stage (warm white), not from a lens.
      const stage = src.kind === 'conferencier';
      if (stage && !lock) {
        (m.rim.material as MeshBasicMaterial).color.setHex(0xfff0c8);
        (m.fill.material as MeshBasicMaterial).color.setHex(0xffe0a0);
      }
      const sx = stage ? x - 1.5 : lerp(src.px, src.x, alpha), sz = stage ? z - 1 : lerp(src.pz, src.z, alpha), sy = stage ? y + 9 : groundY(sx, sz) + 2.25;
      dirV.set(x - sx, y - sy, z - sz);
      const len = dirV.length();
      m.beam.position.set(sx, sy, sz);
      m.beam.quaternion.setFromUnitVectors(up, dirV.multiplyScalar(-1 / (len || 1)));
      m.beam.scale.set(q.r, len, q.r);
      (m.beam.material as MeshBasicMaterial).color.setHex(lock ? 0xff3a2a : stage ? 0xffe0a0 : 0x9ff0ea);
    });

    // Life bars: bosses first (the Spiegelbild cannot be hurt), then bodies that took damage, first come first served.
    let nbar = 0;
    const bosses = s.enemies.filter((e) => e.def.boss && e.kind !== 'spiegelbild');
    const list = [...bosses, ...s.enemies];
    for (let i = 0; i < list.length; i++) {
      if (nbar >= BARS) break;
      const e = list[i]!, boss = i < bosses.length;
      if (e.state === 'dead' || (!boss && (e.def.boss || e.hp >= e.maxHp))) continue;
      const b = this.bars[nbar++]!;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      const w = boss ? Math.min(2.6, 1.6 + e.def.radius * 0.5) : Math.min(1.5, 0.7 + e.def.radius * 0.6), y = (boss ? 0.25 : 0) + groundY(x, z) + BAR_Y[e.def.body] * (e.def.body === 'zombie' || e.def.body === 'human' || e.def.body === 'female' || e.def.body === 'mech' || e.def.body === 'raptor' ? e.def.scale * ownHeight(e.kind) : 1);
      b.back.visible = b.fill.visible = true;
      // Sprites face the camera; the left edge is the anchor, so shift half a width to the camera's left (screen x = world x here).
      b.back.position.set(x - w / 2, y, z);
      b.fill.position.set(x - w / 2 + 0.02, y, z);
      b.back.scale.set(w, boss ? 0.2 : 0.13, 1);
      b.fill.scale.set(Math.max(0.01, (w - 0.04) * (e.hp / e.maxHp)), boss ? 0.14 : 0.085, 1);
      (b.fill.material as SpriteMaterial).color.setHex(e.open > 0 ? 0xf4f1ea : boss ? 0xe0a03a : e.elite ? 0xc98cff : 0xd8452e);
    }
    for (let i = nbar; i < BARS; i++) this.bars[i]!.back.visible = this.bars[i]!.fill.visible = false;

    // Shots: acid globs wobble, boss shots are embers.
    let ng = 0, nb = 0;
    for (const q of T.shots) {
      const x = lerp(q.px, q.x, alpha), z = lerp(q.pz, q.z, alpha), y = groundY(x, z) + 1;
      const r = q.r * (1 + 0.15 * Math.sin(this.time * 18 + x));
      m4.makeScale(r, r, r).setPosition(x, y, z);
      if (q.boss) { if (nb < SHOTS) this.bossShots.setMatrixAt(nb++, m4); } else if (ng < SHOTS) this.globs.setMatrixAt(ng++, m4);
      if (R.next() < 0.6) E.glow(x, y, z, R.range(-0.3, 0.3), R.range(-0.4, 0.4), R.range(-0.3, 0.3), R.range(0.15, 0.35), q.r * 0.9, q.boss ? 5 : 1.4, q.boss ? 2.2 : 4.2, 0.5, 1.5, 0.2);
    }
    this.globs.count = ng;
    this.bossShots.count = nb;
    this.globs.instanceMatrix.needsUpdate = this.bossShots.instanceMatrix.needsUpdate = true;

    // Ground hazards: fire trails glow orange, acid green.
    let nh = 0;
    for (const h of T.hazards) {
      if (nh >= HAZARDS) break;
      const fade = Math.min(1, h.t * 1.5) * Math.min(1, (h.max - h.t) * 6 + 0.2);
      m4.makeScale(h.r, 1, h.r).setPosition(h.x, groundY(h.x, h.z) + 0.06, h.z);
      this.hazards.setMatrixAt(nh, m4);
      col.setHex(h.kind === 'fire' ? 0xff7a2a : 0x8ad040).multiplyScalar(fade * (0.75 + 0.25 * Math.sin(this.time * 12 + h.x * 3)));
      this.hazards.setColorAt(nh++, col);
      if (R.next() < dt * 5) E.glow(h.x + R.range(-h.r, h.r) * 0.6, groundY(h.x, h.z) + 0.1, h.z + R.range(-h.r, h.r) * 0.6, 0, R.range(1, 2.4), 0, R.range(0.3, 0.6), R.range(0.2, 0.4), h.kind === 'fire' ? 1.5 : 0.5, h.kind === 'fire' ? 0.6 : 1.6, 0.12, -1.2, 0.3);
    }
    this.hazards.count = nh;
    this.hazards.instanceMatrix.needsUpdate = true;
    if (this.hazards.instanceColor) this.hazards.instanceColor.needsUpdate = true;

    // Roar rings.
    this.waves.forEach((m, i) => {
      const w = T.waves[i];
      m.visible = !!w && w.r > 0;
      if (!w || w.r <= 0) return;
      const r = Math.min(w.max, w.r + w.speed * dt * alpha);
      m.position.set(w.x, groundY(w.x, w.z) + 0.1, w.z);
      m.scale.setScalar(r);
      // A harmless ring (the Heuler's howl) only shows its reach.
      (m.material as MeshBasicMaterial).opacity = (w.damage > 0 || w.floor > 0 ? 0.95 : 0.45) * (1 - (r / w.max) ** 3);
    });
  }
}

/** Camera shake a threat event asks for. */
export function threatShake(ev: SimEvent): number {
  if (ev.type === 'zoneHit') return ev.r >= BOSS.slam.radius ? 0.26 : ev.r >= THREAT.stomp.radius ? 0.16 : 0.1;
  if (ev.type === 'bossRage') return 0.3;
  if (ev.type === 'enemySpecial' && ev.phase === 'go' && (ev.kind === 'roar' || ev.kind === 'charge')) return 0.2;
  return 0;
}
