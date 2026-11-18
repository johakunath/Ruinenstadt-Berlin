// What enemies put into the world (M12): marked circles that fill until they go off, rush lines,
// shots, burning and acid ground, roar rings, the gold ring under an open body. Pooled, unlit,
// on the FX layer: no lights, no shadows, the same cost on both profiles.
// M12c: the Wachdrohne's searchlight (a decal and a beam per spot, at most two), the pink ring under a
// winding Boxenkopf, sparks over dazed drones. Each visible piece is one draw call, nothing else.
import {
  AdditiveBlending, CircleGeometry, Color, ConeGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, SphereGeometry, Sprite, SpriteMaterial,
  Vector3,
} from 'three';
import { BOSS, THREAT } from '../data/enemies';
import { lerp, Rng } from '../sim/math';
import type { Sim, SimEvent } from '../sim/types';
import type { Emitters } from './abilities';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
import { paintGlow } from './paint';

const BARS = 18;
/** Where the life bar floats, per body. */
const BAR_Y = { zombie: 2.05, raptor: 1.55, rex: 3.9, crow: 2.2, rat: 0.6, drone: 2.4 } as const;
const ZONES = 14, LINES = 6, SHOTS = 72, HAZARDS = 60, WAVES = 8, OPEN = 6, SPOTS = 2, PULSES = 6;
const ZONE_COLOR = { slam: 0xff4a1e, flame: 0xff7a1e, bomb: 0xff2a2a, tail: 0xff4a1e, acid: 0x8fe04a, shove: 0xffa03a, land: 0x43d1cf } as const;
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
  private time = 0;

  constructor(private readonly emit: Emitters) {
    // Small life bars over hurt enemies (playtest 2026-11-17); bosses keep the big bar in the HUD.
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
      const m = fx(flat(new Mesh(new RingGeometry(0.86, 1, 36, 1, 0, Math.PI * 1.7), add(0xf2d14b, 0.9))), 2);
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
    if (ev.type === 'zoneHit') {
      const y = groundY(ev.x, ev.z);
      const fire = ev.kind === 'flame' || ev.kind === 'bomb';
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

  update(s: Sim, alpha: number, dt: number): void {
    this.time += dt;
    const T = s.threats;
    const E = this.emit;
    const R = this.rng;

    // Marked circles: the fill grows to the rim, then the circle goes off.
    this.zones.forEach((m, i) => {
      const z = T.zones[i];
      m.rim.visible = m.fill.visible = !!z;
      if (!z) return;
      const y = groundY(z.x, z.z) + 0.07;
      const k = 1 - Math.max(0, z.t) / z.max;
      m.rim.position.set(z.x, y, z.z);
      m.fill.position.set(z.x, y, z.z);
      m.rim.scale.setScalar(z.r);
      m.fill.scale.setScalar(z.r * Math.max(0.05, k));
      const c = ZONE_COLOR[z.kind];
      (m.rim.material as MeshBasicMaterial).color.setHex(c);
      (m.fill.material as MeshBasicMaterial).color.setHex(k > 0.85 ? 0xffd6a0 : c);
      (m.fill.material as MeshBasicMaterial).opacity = 0.22 + 0.3 * k;
    });

    // Rush lines while a pounce, lunge, dive or charge winds up; the gold ring under open bodies.
    let nl = 0, no = 0, np = 0;
    for (const e of s.enemies) {
      if (e.state === 'dead') continue;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      const sp = e.sp;
      // M12c: a pink ring fills under a body that winds up a bass ring or a beat.
      if (e.state === 'special' && sp && (sp.kind === 'bass' || sp.kind === 'beat') && e.stateT < sp.wind && np < PULSES) {
        const m = this.pulses[np++]!;
        const k = e.stateT / sp.wind;
        m.visible = true;
        m.position.set(x, groundY(x, z) + 0.09, z);
        m.scale.setScalar(e.def.radius * (1.4 + 1.6 * k));
        (m.material as MeshBasicMaterial).opacity = 0.35 + 0.5 * k;
      }
      // Dazed drones spark.
      if (e.kind === 'drone' && e.rest > 0 && R.next() < dt * 14) E.glow(x, groundY(x, z) + 0.6, z, R.range(-1.5, 1.5), R.range(0.5, 2.5), R.range(-1.5, 1.5), R.range(0.15, 0.3), 0.06, 3, 4.5, 6, 6);
      if (e.state === 'special' && sp && sp.speed > 0 && sp.kind !== 'dive' && e.stateT < sp.wind && nl < LINES) {
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

    // M12c: held by the Türsteher.
    const hp = s.player;
    this.held.visible = hp.root > 0 && hp.state !== 'dead';
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
      const sx = lerp(src.px, src.x, alpha), sz = lerp(src.pz, src.z, alpha), sy = groundY(sx, sz) + 2.25;
      dirV.set(x - sx, y - sy, z - sz);
      const len = dirV.length();
      m.beam.position.set(sx, sy, sz);
      m.beam.quaternion.setFromUnitVectors(up, dirV.multiplyScalar(-1 / (len || 1)));
      m.beam.scale.set(q.r, len, q.r);
      (m.beam.material as MeshBasicMaterial).color.setHex(lock ? 0xff3a2a : 0x9ff0ea);
    });

    // Life bars: only on bodies that took damage, nearest slots first come first served.
    let nbar = 0;
    for (const e of s.enemies) {
      if (nbar >= BARS) break;
      if (e.state === 'dead' || e.def.boss || e.hp >= e.maxHp) continue;
      const b = this.bars[nbar++]!;
      const x = lerp(e.px, e.x, alpha), z = lerp(e.pz, e.z, alpha);
      const w = Math.min(1.5, 0.7 + e.def.radius * 0.6), y = groundY(x, z) + BAR_Y[e.def.body] * (e.def.body === 'zombie' ? e.def.scale : 1);
      b.back.visible = b.fill.visible = true;
      // Sprites face the camera; the left edge is the anchor, so shift half a width to the camera's left (screen x = world x here).
      b.back.position.set(x - w / 2, y, z);
      b.fill.position.set(x - w / 2 + 0.02, y, z);
      b.back.scale.set(w, 0.13, 1);
      b.fill.scale.set(Math.max(0.01, (w - 0.04) * (e.hp / e.maxHp)), 0.085, 1);
      (b.fill.material as SpriteMaterial).color.setHex(e.open > 0 ? 0xf2d14b : e.elite ? 0xc98cff : 0xd8452e);
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
      (m.material as MeshBasicMaterial).opacity = 0.95 * (1 - (r / w.max) ** 3);
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
