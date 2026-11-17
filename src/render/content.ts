// Run content in the world (M16): hidden blessings, Litfaßsäule shrines, the trader, the captive,
// the cache, the supply drop and the radio zone. Built in code; glows are unlit sprites (no lights).
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  OctahedronGeometry, RingGeometry, SRGBColorSpace, Sprite, SpriteMaterial, type Object3D,
} from 'three';
import type { RunContent } from '../sim/runcontent';
import type { Sim } from '../sim/types';
import { heroLook } from '../data/hero-look';
import { Animator, type CharacterAssets } from './characters';
import { HeroModel } from './hero-model';
import { groundY } from './ground';
import { FX_LAYER } from './layers';
import type { Materials } from './materials';
import { paintGlow, paintWood } from './paint';

const NPC_LOOK = heroLook({ a: { base: 'weste' } });

const glowSprite = (inner: string, outer: string, size: number): Sprite => {
  const s = new Sprite(new SpriteMaterial({ map: paintGlow(inner, outer), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1);
  s.layers.set(FX_LAYER);
  s.renderOrder = 6;
  return s;
};
const flat = (geo: RingGeometry | CircleGeometry, color: number, opacity: number): Mesh => {
  const m = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
  m.rotation.x = -Math.PI / 2;
  m.layers.set(FX_LAYER);
  m.renderOrder = 2;
  return m;
};

/** Poster wall of a Litfaßsäule: torn bills in the palette of the style bible. */
function posters(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cdbf9c';
  g.fillRect(0, 0, 512, 256);
  const cols = ['#b8261c', '#e0a43a', '#3a6a8a', '#ead9c0', '#4a5536', '#8a4a32', '#d6cfc0'];
  let seed = 11;
  const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const w = 50 + r() * 70, h = 60 + r() * 90, x = r() * 512, y = 10 + r() * 190;
    g.save();
    g.translate(x, y);
    g.rotate((r() - 0.5) * 0.12);
    g.fillStyle = cols[Math.floor(r() * cols.length)]!;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(20,14,10,0.75)';
    g.fillRect(8, 10, w - 16, 9);
    for (let k = 0; k < 4; k++) g.fillRect(8, 30 + k * 12, (w - 16) * (0.4 + r() * 0.6), 4);
    g.restore();
  }
  g.fillStyle = 'rgba(30,22,16,0.35)';
  for (let i = 0; i < 60; i++) g.fillRect(r() * 512, r() * 256, 2 + r() * 30, 1 + r() * 3);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class ContentView {
  readonly group = new Group();
  private readonly hidden: Array<{ root: Group; shard: Mesh; glow: Sprite }> = [];
  private readonly shrines: Array<{ root: Group; glow: Sprite; halo: Mesh }> = [];
  private readonly cache = new Group();
  private readonly crate = new Group();
  private readonly beam: Mesh;
  private readonly zone = new Group();
  private readonly zoneFill: Mesh;
  private readonly zoneRing: Mesh;
  private readonly people = new Group();
  private trader: { root: Group; anim: Animator } | null = null;
  private captive: { root: Group; anim: Animator; ring: Mesh } | null = null;
  /** One Späti keeper, standing behind the counter of the nearest Späti. */
  private keeper: { root: Group; anim: Animator } | null = null;
  private built: RunContent | null = null;
  private time = 0;

  constructor(private readonly assets: CharacterAssets, private readonly materials: Materials) {
    const wood = materials.surface({ map: paintWood({ flatten: materials.look.flatten, normalMaps: false, anisotropy: 1 }, '#6b4a30', 45).map, roughness: 0.9 });
    const iron = materials.surface({ color: 0x4a4038, roughness: 0.6, metalness: 0.5 });
    const gold = materials.surface({ color: 0xc9a227, roughness: 0.4, metalness: 0.7, emissive: 0x6a4a08 });
    // Cache: an old chest with a warm glow.
    const body = new Mesh(new BoxGeometry(0.9, 0.5, 0.56), wood);
    body.position.y = 0.25;
    const lid = new Mesh(new CylinderGeometry(0.28, 0.28, 0.9, 10, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.position.y = 0.5;
    const band = new Mesh(new BoxGeometry(0.1, 0.56, 0.6), iron);
    band.position.set(0, 0.28, 0);
    const lock = new Mesh(new BoxGeometry(0.14, 0.16, 0.06), gold);
    lock.position.set(0, 0.42, 0.3);
    const cg = glowSprite('rgba(255,215,100,0.9)', 'rgba(255,170,40,0)', 3.2);
    cg.position.y = 0.8;
    this.cache.add(body, lid, band, lock, cg);
    // Supply drop: a strapped crate under a rag of parachute, with a beam to find it by.
    const box = new Mesh(new BoxGeometry(0.85, 0.7, 0.85), wood);
    box.position.y = 0.35;
    const strap = new Mesh(new BoxGeometry(0.9, 0.12, 0.9), materials.surface({ color: 0xb8261c, roughness: 0.9 }));
    strap.position.y = 0.4;
    const chute = new Mesh(new ConeGeometry(0.9, 0.5, 8, 1, true), materials.surface({ color: 0xcfc6ae, roughness: 0.95, doubleSided: true }));
    chute.position.set(0.5, 0.86, 0.2);
    chute.rotation.z = -0.7;
    this.beam = new Mesh(new CylinderGeometry(0.12, 0.3, 14, 10, 1, true), new MeshBasicMaterial({ color: 0xf2d14b, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
    this.beam.position.y = 7;
    this.beam.layers.set(FX_LAYER);
    this.crate.add(box, strap, chute, this.beam);
    // Radio zone: a ring that fills while the hero holds it.
    this.zoneRing = flat(new RingGeometry(0.955, 1, 64), 0x7dd3ff, 0.7);
    this.zoneFill = flat(new CircleGeometry(1, 48), 0x7dd3ff, 0.16);
    const mast = new Mesh(new CylinderGeometry(0.03, 0.05, 2.4, 6), iron);
    mast.position.y = 1.2;
    const lamp = glowSprite('rgba(140,220,255,1)', 'rgba(60,160,255,0)', 1.6);
    lamp.position.y = 2.5;
    this.zone.add(this.zoneRing, this.zoneFill, mast, lamp);
    for (const g of [this.cache, this.crate, this.zone]) {
      g.visible = false;
      g.traverse((o) => { if ((o as Mesh).isMesh && o.layers.mask === 1) o.castShadow = true; });
      this.group.add(g);
    }
    this.group.add(this.people);
  }

  /** Hidden blessings and shrines of this run (positions are fixed for the run). */
  private build(c: RunContent): void {
    this.built = c;
    for (const h of [...this.hidden, ...this.shrines]) this.group.remove(h.root);
    this.hidden.length = this.shrines.length = 0;
    for (const h of c.hidden) {
      const root = new Group();
      const shard = new Mesh(new OctahedronGeometry(0.2), new MeshBasicMaterial({ color: 0xffc46a, fog: false }));
      shard.layers.set(FX_LAYER);
      const glow = glowSprite('rgba(255,190,90,1)', 'rgba(255,120,30,0)', 2.6);
      root.add(shard, glow);
      root.position.set(h.x, groundY(h.x, h.z), h.z);
      this.group.add(root);
      this.hidden.push({ root, shard, glow });
    }
    const paper = this.materials.surface({ map: posters(), roughness: 0.95 });
    const cap = this.materials.surface({ color: 0x3a5a4a, roughness: 0.6, metalness: 0.3 });
    for (const h of c.shrines) {
      const root = new Group();
      const col = new Mesh(new CylinderGeometry(0.5, 0.5, 2.5, 20), paper);
      col.position.y = 1.35;
      const foot = new Mesh(new CylinderGeometry(0.56, 0.6, 0.2, 20), cap);
      foot.position.y = 0.1;
      const top = new Mesh(new CylinderGeometry(0.62, 0.56, 0.16, 20), cap);
      top.position.y = 2.68;
      const dome = new Mesh(new ConeGeometry(0.56, 0.42, 20), cap);
      dome.position.y = 2.97;
      for (const m of [col, foot, top, dome]) m.castShadow = true;
      const glow = glowSprite('rgba(125,211,255,1)', 'rgba(60,150,255,0)', 2.8);
      glow.position.y = 3.3;
      const halo = flat(new RingGeometry(0.85, 1, 40), 0x7dd3ff, 0.5);
      halo.position.y = 0.06;
      halo.scale.setScalar(1.5);
      root.add(col, foot, top, dome, glow, halo);
      root.position.set(h.x, groundY(h.x, h.z), h.z);
      this.group.add(root);
      this.shrines.push({ root, glow, halo });
    }
  }

  private person(tint: 'trader' | 'captive' | 'keeper'): { root: Group; anim: Animator } {
    const root = new Group();
    // Traders, captives and keepers wear the vest (the hero starts in the coat), so they never read
    // as copies of her; only that look's pieces draw.
    const body = new HeroModel(this.assets.hero);
    body.setLook(NPC_LOOK);
    const model = body.model;
    root.add(model);
    const anim = new Animator(model, new Map([...this.assets.heroClips].filter(([n]) => n === 'Idle_Loop' || n === 'Interact')));
    anim.loop('Idle_Loop', 0);
    const attach = (bone: string, o: Object3D): void => { model.getObjectByName(bone)?.add(o); };
    if (tint === 'trader') {
      // Wide hat, a big pack and a green lantern: readable from far away.
      const felt = this.materials.surface({ color: 0x6b4a30, roughness: 0.95 });
      const brim = new Mesh(new CylinderGeometry(0.3, 0.32, 0.03, 16), felt);
      brim.position.y = 0.2;
      const crown = new Mesh(new CylinderGeometry(0.13, 0.16, 0.16, 12), felt);
      crown.position.y = 0.28;
      attach('Head', brim);
      attach('Head', crown);
      const pack = new Mesh(new BoxGeometry(0.42, 0.56, 0.26), this.materials.surface({ color: 0x4a5536, roughness: 0.9 }));
      pack.position.set(0, 0.12, -0.24);
      const roll = new Mesh(new CylinderGeometry(0.09, 0.09, 0.5, 10), this.materials.surface({ color: 0x8a4a32, roughness: 0.9 }));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 0.46, -0.24);
      attach('spine_03', pack);
      attach('spine_03', roll);
      const lantern = glowSprite('rgba(170,255,140,1)', 'rgba(70,200,60,0)', 1.5);
      lantern.position.set(0, -0.2, 0.1);
      attach('hand_l', lantern);
    }
    if (tint === 'keeper') {
      // Flat cap and a striped apron: the Späti keeper.
      const cap = new Mesh(new CylinderGeometry(0.15, 0.17, 0.07, 12), this.materials.surface({ color: 0x2f3b44, roughness: 0.9 }));
      cap.position.y = 0.2;
      const peak = new Mesh(new BoxGeometry(0.2, 0.02, 0.14), this.materials.surface({ color: 0x232c33, roughness: 0.9 }));
      peak.position.set(0, 0.17, 0.14);
      attach('Head', cap);
      attach('Head', peak);
      const apron = new Mesh(new BoxGeometry(0.4, 0.62, 0.05), this.materials.surface({ color: 0x9a3a2e, roughness: 0.95 }));
      apron.position.set(0, -0.12, 0.17);
      attach('spine_02', apron);
    }
    root.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
    this.people.add(root);
    return { root, anim };
  }

  update(s: Sim, dt: number, heroX: number, heroZ: number): void {
    this.time += dt;
    const c = s.content;
    // A new run has new places: compare the positions, the content object is replaced on restart.
    if (!this.built || this.built.hidden.length !== c.hidden.length || this.built.hidden[0]?.x !== c.hidden[0]?.x || this.built.shrines[0]?.x !== c.shrines[0]?.x) this.build(c);
    this.built = c;
    this.hidden.forEach((h, i) => {
      const d = c.hidden[i]!;
      // 2D rule: hidden blessings glow only up close.
      const k = d.got ? 0 : Math.max(0, Math.min(1, (11 - Math.hypot(d.x - heroX, d.z - heroZ)) / 4));
      h.root.visible = k > 0.01;
      if (!h.root.visible) return;
      h.shard.position.y = 0.9 + Math.sin(this.time * 2.2 + i) * 0.12;
      h.shard.rotation.y = this.time * 1.8;
      h.shard.scale.setScalar(k);
      h.glow.position.y = h.shard.position.y;
      (h.glow.material as SpriteMaterial).opacity = k * (0.7 + 0.3 * Math.sin(this.time * 5));
    });
    this.shrines.forEach((h, i) => {
      const used = c.shrines[i]!.used;
      h.glow.visible = h.halo.visible = !used;
      if (used) return;
      (h.glow.material as SpriteMaterial).opacity = 0.75 + 0.25 * Math.sin(this.time * 3 + i);
      h.halo.scale.setScalar(1.45 + 0.12 * Math.sin(this.time * 2.4 + i));
    });

    const place = (g: Group, o: { x: number; z: number } | null): boolean => {
      g.visible = !!o;
      if (o) g.position.set(o.x, groundY(o.x, o.z), o.z);
      return !!o;
    };
    place(this.cache, c.cache);
    if (place(this.crate, c.crate)) (this.beam.material as MeshBasicMaterial).opacity = 0.22 + 0.1 * Math.sin(this.time * 4);
    if (place(this.zone, c.zone) && c.zone) {
      this.zoneRing.scale.setScalar(c.zone.r);
      this.zoneRing.position.y = this.zoneFill.position.y = 0.07;
      this.zoneFill.scale.setScalar(c.zone.r * Math.max(0.02, c.zone.p / c.zone.need));
      (this.zoneRing.material as MeshBasicMaterial).opacity = 0.5 + 0.25 * Math.sin(this.time * 5);
    }
    if (c.trader) {
      this.trader ??= this.person('trader');
      const t = this.trader;
      t.root.visible = true;
      t.root.position.set(c.trader.x, groundY(c.trader.x, c.trader.z), c.trader.z);
      t.root.rotation.y = Math.atan2(heroX - c.trader.x, heroZ - c.trader.z);
      t.anim.update(dt);
    } else if (this.trader) this.trader.root.visible = false;
    let shop: { x: number; z: number; rot: number } | null = null;
    for (const r of s.level.rests) if (r.keeper && Math.hypot(r.x - heroX, r.z - heroZ) < 45) shop = { ...r.keeper, rot: r.rot };
    if (shop) {
      this.keeper ??= this.person('keeper');
      const k = this.keeper;
      k.root.visible = true;
      k.root.position.set(shop.x, groundY(shop.x, shop.z), shop.z);
      // Faces the customer side, turns the head of the body a little toward the hero when close.
      const toHero = Math.atan2(heroX - shop.x, heroZ - shop.z);
      const d = Math.atan2(Math.sin(toHero - shop.rot), Math.cos(toHero - shop.rot));
      k.root.rotation.y = shop.rot + Math.max(-0.9, Math.min(0.9, d));
      k.anim.update(dt);
    } else if (this.keeper) this.keeper.root.visible = false;
    if (c.captive) {
      if (!this.captive) {
        const p = this.person('captive');
        const ring = flat(new RingGeometry(0.9, 1, 40), 0xead9c0, 0.6);
        ring.position.y = 0.06;
        ring.scale.setScalar(1.1);
        p.root.add(ring);
        this.captive = { ...p, ring };
      }
      const t = this.captive;
      t.root.visible = true;
      t.root.position.set(c.captive.x, groundY(c.captive.x, c.captive.z), c.captive.z);
      t.root.rotation.y = Math.atan2(heroX - c.captive.x, heroZ - c.captive.z);
      (t.ring.material as MeshBasicMaterial).color.setHex(c.captive.free ? 0x8fd16a : 0xe05050);
      (t.ring.material as MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(this.time * 4);
      t.anim.update(dt);
    } else if (this.captive) this.captive.root.visible = false;
  }
}
