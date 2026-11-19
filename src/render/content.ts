// Run content in the world (M16): hidden blessings, Litfaßsäule shrines, the trader, the captive,
// the cache, the supply drop and the radio zone. Built in code; glows are unlit sprites (no lights).
import {
  AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  OctahedronGeometry, RingGeometry, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, type BufferGeometry, type Object3D, type Sphere,
} from 'three';
import type { RunContent } from '../sim/runcontent';
import type { Sim } from '../sim/types';
import { heroLook } from '../data/hero-look';
import { Animator, type CharacterAssets } from './characters';
import { HeroModel } from './hero-model';
import { groundY } from './ground';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FX_LAYER, LOOT_LAYER, LOOT_SHOW } from './layers';
import type { Materials } from './materials';
import { paintGlow, paintWood } from './paint';

const NPC_LOOK = heroLook({ a: { base: 'weste' } });

/**
 * A person on the hero rig in the vest (the hero starts in the coat), so NPCs never read as copies of
 * her; only that look's pieces draw. Idle loop running; `attach` hangs props on a bone.
 */
export function npcPerson(assets: CharacterAssets): { root: Group; anim: Animator; attach: (bone: string, o: Object3D) => void } {
  const root = new Group();
  const body = new HeroModel(assets.hero);
  body.setLook(NPC_LOOK);
  const model = body.model;
  root.add(model);
  const anim = new Animator(model, new Map([...assets.heroClips].filter(([n]) => n === 'Idle_Loop' || n === 'Interact' || n === 'Jog_Fwd_Loop')));
  anim.loop('Idle_Loop', 0);
  return { root, anim, attach: (bone, o) => { model.getObjectByName(bone)?.add(o); } };
}

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

/** Fund pieces, built once and shared by every run (no new GPU buffers per rebuild). */
let FUND_PARTS: { gear: BufferGeometry; hub: BufferGeometry; box: BufferGeometry; tag: BufferGeometry; gold: MeshBasicMaterial; dark: MeshBasicMaterial; label: MeshBasicMaterial } | null = null;
function fundParts(): NonNullable<typeof FUND_PARTS> {
  if (FUND_PARTS) return FUND_PARTS;
  // A gear: a thin wheel with eight teeth, merged into one geometry; a dark hub in the middle.
  const wheel = new CylinderGeometry(0.22, 0.22, 0.06, 16).rotateX(Math.PI / 2);
  const teeth = Array.from({ length: 8 }, (_, k) => {
    const a = (k / 8) * Math.PI * 2;
    return new BoxGeometry(0.08, 0.08, 0.06).rotateZ(a).translate(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
  });
  const gear = mergeGeometries([wheel, ...teeth])!;
  for (const g of [wheel, ...teeth]) g.dispose();
  FUND_PARTS = {
    gear, hub: new CylinderGeometry(0.07, 0.07, 0.07, 10).rotateX(Math.PI / 2),
    box: new BoxGeometry(0.36, 0.22, 0.06), tag: new BoxGeometry(0.28, 0.08, 0.065).translate(0, 0.04, 0),
    gold: new MeshBasicMaterial({ color: 0xd9a940, fog: false }), dark: new MeshBasicMaterial({ color: 0x2a2622, fog: false }), label: new MeshBasicMaterial({ color: 0xe8dccb, fog: false }),
  };
  return FUND_PARTS;
}

export class ContentView {
  readonly group = new Group();
  private readonly hidden: Array<{ root: Group; shard: Mesh; glow: Sprite }> = [];
  /** Funde (2D #14, #27): a gold gear (Uhrwerkteil) or a cassette, each with an unlit glow. */
  private readonly funde: Array<{ root: Group; body: Group; glow: Sprite }> = [];
  private readonly tmp = new Vector3();
  private readonly cacheParts: Mesh[] = [];
  private heroX = 0;
  private heroZ = 0;
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
  /** Playtest 2026-11-18: a freed captive no longer vanishes; they walk off toward the camp for a few seconds. */
  private leaving: { t: number; dx: number; dz: number } | null = null;
  private wasFree = false;
  /** One Späti keeper, standing behind the counter of the nearest Späti. */
  private keeper: { root: Group; anim: Animator } | null = null;
  /** Talk spots (playtest 2026-11-17): a ring on the ground where the trade can start; it brightens in reach. */
  private readonly talkRings = [0, 1].map(() => {
    const g = new Group();
    const ring = flat(new RingGeometry(0.9, 1, 48), 0xf2cc83, 0.5);
    const fill = flat(new CircleGeometry(0.9, 48), 0xf2cc83, 0.08);
    ring.position.y = fill.position.y = 0.06;
    g.add(ring, fill);
    g.visible = false;
    return { g, ring, fill };
  });
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
    // The cache's contour shows through buildings within 15 m too (the layer is switched in `update`).
    this.cacheParts.push(body, lid, band, lock);
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
    for (const r of this.talkRings) this.group.add(r.g);
  }

  /** Hidden blessings and shrines of this run (positions are fixed for the run). */
  private build(c: RunContent): void {
    this.built = c;
    for (const h of [...this.hidden, ...this.shrines, ...this.funde]) this.group.remove(h.root);
    // The Fund glows own a painted texture each; the meshes share FUND_PARTS and are not freed.
    for (const h of this.funde) { const m = h.glow.material as SpriteMaterial; m.map?.dispose(); m.dispose(); }
    this.hidden.length = this.shrines.length = this.funde.length = 0;
    const F = fundParts();
    for (const f of c.funde ?? []) {
      const root = new Group(), body = new Group();
      // Shared, merged pieces (review of PR #58): an Uhrwerkteil is two draw calls, a cassette two.
      if (f.kind === 'teil') body.add(new Mesh(F.gear, F.gold), new Mesh(F.hub, F.dark));
      else body.add(new Mesh(F.box, F.dark), new Mesh(F.tag, F.label));
      // FX layer, plus the find contour through buildings within 15 m (hero-outline.ts); the root hides beyond that.
      body.traverse((o) => { o.layers.set(FX_LAYER); o.layers.enable(LOOT_LAYER); });
      const glow = f.kind === 'teil' ? glowSprite('rgba(255,205,110,1)', 'rgba(255,150,40,0)', 2) : glowSprite('rgba(230,235,255,0.9)', 'rgba(150,170,255,0)', 1.6);
      root.add(body, glow);
      root.position.set(f.x, groundY(f.x, f.z), f.z);
      this.group.add(root);
      this.funde.push({ root, body, glow });
    }
    for (const h of c.hidden) {
      const root = new Group();
      const shard = new Mesh(new OctahedronGeometry(0.2), new MeshBasicMaterial({ color: 0xffc46a, fog: false }));
      shard.layers.set(FX_LAYER);
      // Its gold contour shows through buildings within 15 m (hero-outline.ts, LOOT_LAYER).
      shard.layers.enable(LOOT_LAYER);
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
    const { root, anim, attach } = npcPerson(this.assets);
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

  /**
   * Spheres round the hidden finds the hero is within 15 m of (shown blessing shards, the open cache), for
   * their contour behind buildings. Returns how many it wrote.
   */
  lootSpheres(out: Sphere[]): number {
    let n = 0;
    for (const h of this.hidden) {
      if (n >= out.length) return n;
      if (!h.root.visible) continue;
      out[n++]!.set(h.shard.getWorldPosition(this.tmp), 0.5);
    }
    for (const h of this.funde) {
      if (n >= out.length) return n;
      if (!h.root.visible) continue;
      out[n++]!.set(h.body.getWorldPosition(this.tmp), 0.5);
    }
    if (n < out.length && this.cache.visible && Math.hypot(this.cache.position.x - this.heroX, this.cache.position.z - this.heroZ) < LOOT_SHOW) {
      out[n++]!.set(this.tmp.copy(this.cache.position).setY(this.cache.position.y + 0.4), 0.9);
    }
    return n;
  }

  update(s: Sim, dt: number, heroX: number, heroZ: number): void {
    this.time += dt;
    this.heroX = heroX;
    this.heroZ = heroZ;
    const c = s.content;
    // A new run has new places: compare the positions, the content object is replaced on restart.
    if (!this.built || this.built.hidden.length !== c.hidden.length || this.built.hidden[0]?.x !== c.hidden[0]?.x || this.built.shrines[0]?.x !== c.shrines[0]?.x || (this.built.funde?.length ?? 0) !== (c.funde?.length ?? 0)) this.build(c);
    this.built = c;
    this.hidden.forEach((h, i) => {
      const d = c.hidden[i]!;
      // 2D rule: hidden blessings glow only up close (11 m); since 2026-11-19 they show from 15 m, through walls too.
      const k = d.got ? 0 : Math.max(0, Math.min(1, (LOOT_SHOW - Math.hypot(d.x - heroX, d.z - heroZ)) / 4));
      h.root.visible = k > 0.01;
      if (!h.root.visible) return;
      h.shard.position.y = 0.9 + Math.sin(this.time * 2.2 + i) * 0.12;
      h.shard.rotation.y = this.time * 1.8;
      h.shard.scale.setScalar(k);
      h.glow.position.y = h.shard.position.y;
      (h.glow.material as SpriteMaterial).opacity = k * (0.7 + 0.3 * Math.sin(this.time * 5));
    });
    this.funde.forEach((h, i) => {
      const f = c.funde?.[i];
      // Seen from 15 m like the hidden blessings, then it fades in (they are hidden, not marked on the map).
      const k = !f || f.got ? 0 : Math.max(0, Math.min(1, (LOOT_SHOW - Math.hypot(f.x - heroX, f.z - heroZ)) / 4));
      h.root.visible = k > 0.01;
      if (!h.root.visible) return;
      h.body.position.y = 0.85 + Math.sin(this.time * 2 + i) * 0.08;
      h.body.rotation.y = this.time * 1.4;
      h.body.scale.setScalar(k);
      h.glow.position.y = h.body.position.y;
      (h.glow.material as SpriteMaterial).opacity = k * (0.6 + 0.25 * Math.sin(this.time * 4 + i));
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
    // Only within 15 m, else the cache would get its contour whenever the pass runs for the hero or an enemy.
    const near = !!c.cache && Math.hypot(c.cache.x - heroX, c.cache.z - heroZ) < LOOT_SHOW;
    for (const m of this.cacheParts) { if (near) m.layers.enable(LOOT_LAYER); else m.layers.disable(LOOT_LAYER); }
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
    // Talk rings, person-sized (Johannes 2026-11-17): around the trader, and the Späti customer spot.
    // Reach (CONTENT.*.touch) is a little larger than the ring so standing on it always works.
    const spots: Array<{ x: number; z: number; r: number; on: boolean }> = [];
    if (c.trader) spots.push({ x: c.trader.x, z: c.trader.z, r: 1, on: c.talk === -1 });
    let best = -1;
    let bestD = 45;
    s.level.rests.forEach((r, i) => {
      if (!r.desk) return;
      const d = Math.hypot(r.desk.x - heroX, r.desk.z - heroZ);
      if (d < bestD) { bestD = d; best = i; }
    });
    const desk = best >= 0 ? s.level.rests[best]!.desk : undefined;
    if (desk) spots.push({ x: desk.x, z: desk.z, r: 0.55, on: c.talk === best });
    this.talkRings.forEach((t, i) => {
      const o = spots[i];
      t.g.visible = !!o && !c.tradeOpen;
      if (!o) return;
      t.g.position.set(o.x, groundY(o.x, o.z), o.z);
      t.g.scale.setScalar(o.r);
      (t.ring.material as MeshBasicMaterial).opacity = o.on ? 0.85 : 0.35 + 0.15 * Math.sin(this.time * 3);
      (t.fill.material as MeshBasicMaterial).opacity = o.on ? 0.16 : 0.05;
    });
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
      this.wasFree = c.captive.free;
      this.leaving = null;
    } else if (this.captive && this.wasFree && !this.leaving && this.captive.root.visible) {
      // Just rescued: turn away from the hero and walk off, the ring goes.
      const r = this.captive.root, dx = r.position.x - heroX, dz = r.position.z - heroZ, d = Math.hypot(dx, dz) || 1;
      this.leaving = { t: 0, dx: dx / d, dz: dz / d };
      this.captive.ring.visible = false;
      this.captive.anim.loop('Jog_Fwd_Loop', 0.25, 0.7);
      r.rotation.y = Math.atan2(dx, dz);
    } else if (this.captive && this.leaving) {
      const L = this.leaving, r = this.captive.root;
      L.t += dt;
      // A short pause (the thank-you line), then off at a walking pace; gone after five seconds.
      if (L.t > 0.8) {
        r.position.x += L.dx * 2.2 * dt; r.position.z += L.dz * 2.2 * dt;
        r.position.y = groundY(r.position.x, r.position.z);
      }
      this.captive.anim.update(dt);
      if (L.t > 5) { r.visible = false; this.leaving = null; this.wasFree = false; this.captive.ring.visible = true; this.captive.anim.loop('Idle_Loop', 0); }
    } else if (this.captive) this.captive.root.visible = false;
  }
}
