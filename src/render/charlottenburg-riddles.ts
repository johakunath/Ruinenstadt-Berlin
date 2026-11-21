// M16 step 6c maze riddles, render side (`docs/tasks/m12d-charlottenburg-enemies.md` › Maze riddles).
// Reads sim state, never writes it.
//
// Static parts go into the chunk batches of shared materials (at most two more batches in a maze chunk:
// glossy steel for the mirror frames and glass, with the sky reflection; stucco for the plinth discs, posts and
// gate piers). Live parts (`RiddleView`): the three crystals (one unlit mesh each, dim until lit), the ring of the
// plinth the hero stands near (dashes and the charge arc, as the tunnel hold ring), the two iron gate leaves
// (one batch each, they swing open), the lit silhouette card in each true mirror.
// Cost (Ausgewogen and Leistung, the whole maze on screen): at most 12 draw calls (3 crystals, 3 halos, 2 ring,
// 2 leaves, 2 silhouettes), no light, no pass, no shadow; outside the maze all are frustum-culled.
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, OctahedronGeometry, PlaneGeometry, RingGeometry, CylinderGeometry, type Texture } from 'three';
import { MIRROR, PLINTH, type MapDef } from '../data/map';
import { sub, type RGB } from './landmarks';
import { FX_LAYER } from './layers';
import type { ChunkBuilder, MapMats } from './map-world';
import { Builder } from './world';

const FRAME: RGB = [0.62, 0.5, 0.3];
const GLASS: RGB = [0.92, 0.95, 1.0];
const STONE: RGB = [0.78, 0.76, 0.72];
const IRON: RGB = [0.5, 0.52, 0.55];
const LIT = 0xbfe8ff, DIM = 0x31414e;
const LIT_C = new Color(LIT).multiplyScalar(1.6);
/** Seconds the gate leaves take to swing open. */
const SWING = 1.4;

/** What the view reads from the sim each frame. */
export interface RiddleState {
  /** Seconds stood per plinth, the seconds that light one, the gate open. */
  t: readonly number[];
  need: number;
  open: boolean;
  /** Hero position (interpolated). */
  x: number;
  z: number;
}

export interface RiddleView {
  group: Group;
  update(s: RiddleState, dt: number): void;
}

/** Mirror frames and glass, plinth discs and posts, gate piers into the chunks. */
export function buildRiddleStatic(m: MapDef, chunkOf: (x: number, z: number) => ChunkBuilder, ground: (x: number, z: number) => number): void {
  const { w, h } = MIRROR;
  for (const r of m.mirrors ?? []) {
    const b = chunkOf(r.x, r.z), M = b.mm, f = new Matrix4().makeRotationY(r.rot).setPosition(r.x, ground(r.x, r.z), r.z);
    // Two feet, the frame with a crest, a dark backing, the glass a little in front.
    for (const s of [-1, 1]) b.box(M.railSteel, sub(f, s * (w / 2 - 0.05), 0.15, 0), 0.16, 0.3, 0.42, FRAME);
    b.box(M.railSteel, sub(f, 0, 0.3 + h / 2, 0), w + 0.2, h + 0.2, 0.12, FRAME);
    b.box(M.railSteel, sub(f, 0, 0.42 + h, 0), w * 0.55, 0.2, 0.14, FRAME);
    b.box(M.railSteel, sub(f, 0, 0.3 + h / 2, 0.065), w - 0.04, h - 0.04, 0.02, GLASS);
  }
  const P = m.plinths;
  if (P) {
    for (const q of P.pts) {
      const b = chunkOf(q.x, q.z), M = b.mm, y = ground(q.x, q.z);
      b.geo(M.stucco, new CylinderGeometry(P.r - 0.15, P.r - 0.05, 0.06, 24), new Matrix4().setPosition(q.x, y + 0.03, q.z), STONE);
      const px = q.x, pz = q.z - PLINTH.post;
      b.geo(M.stucco, new CylinderGeometry(0.22, 0.3, 0.95, 10), new Matrix4().setPosition(px, y + 0.475, pz), STONE);
      b.box(M.stucco, new Matrix4().setPosition(px, y + 0.98, pz), 0.62, 0.08, 0.62, STONE);
    }
    const g = P.gate, b = chunkOf(g.x, g.z), M = b.mm, f = new Matrix4().makeRotationY(g.rot).setPosition(g.x, ground(g.x, g.z), g.z);
    for (const s of [-1, 1]) {
      b.box(M.stucco, sub(f, s * (g.half - 0.35), 1.3, 0), 0.5, 2.6, 0.6, STONE);
      b.box(M.stucco, sub(f, s * (g.half - 0.35), 2.68, 0), 0.62, 0.16, 0.72, STONE);
    }
  }
}

/** A soft standing figure, white on black (for an additive card). */
function silhouetteTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  g.filter = 'blur(2px)';
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(32, 22, 10, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(18, 38); g.lineTo(46, 38); g.lineTo(50, 78); g.lineTo(42, 80); g.lineTo(41, 122); g.lineTo(34, 122); g.lineTo(32, 86);
  g.lineTo(30, 122); g.lineTo(23, 122); g.lineTo(22, 80); g.lineTo(14, 78);
  g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  return t;
}

const flat = (geo: RingGeometry, color: number, opacity: number): Mesh => {
  const mesh = new Mesh(geo, new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.layers.set(FX_LAYER);
  mesh.renderOrder = 2;
  return mesh;
};

export function buildRiddleView(m: MapDef, mats: MapMats, ground: (x: number, z: number) => number): RiddleView {
  const group = new Group();
  group.name = 'riddles';
  const P = m.plinths;

  // Crystals on the plinth posts: dim glass until lit, then bright with a slow turn.
  const crystalGeo = new OctahedronGeometry(0.28, 0);
  const crystals = (P?.pts ?? []).map((q) => {
    const mat = new MeshBasicMaterial({ color: DIM });
    const mesh = new Mesh(crystalGeo, mat);
    mesh.position.set(q.x, ground(q.x, q.z) + 1.36, q.z - PLINTH.post);
    mesh.scale.set(1, 1.6, 1);
    group.add(mesh);
    return { mesh, mat };
  });
  // One halo card per crystal, shown once lit (additive, FX layer).
  const haloMat = new MeshBasicMaterial({ color: LIT, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, fog: false, map: glowDisc() });
  const halos = crystals.map((c) => {
    const halo = new Mesh(new PlaneGeometry(1.6, 1.6), haloMat);
    halo.position.copy(c.mesh.position);
    halo.layers.set(FX_LAYER);
    halo.visible = false;
    group.add(halo);
    return halo;
  });

  // The ring of the nearest unlit plinth (dashes, charge arc).
  const R = P?.r ?? 1.5;
  const dash = new RingGeometry(R - 0.08, R, 64, 1);
  { const idx = dash.getIndex()!, out: number[] = []; for (let i = 0; i < idx.count; i += 6) if (Math.floor(i / 12) % 2 === 0) for (let k = 0; k < 6; k++) out.push(idx.getX(i + k)); dash.setIndex(out); }
  const dashMesh = flat(dash, LIT, 0.4);
  const arcGeo = new RingGeometry(R - 0.42, R - 0.16, 64, 1, Math.PI / 2, -Math.PI * 2);
  const arc = flat(arcGeo, LIT, 0.85);
  const ring = new Group();
  ring.add(dashMesh, arc);
  ring.visible = false;
  group.add(ring);

  // Gate leaves: bars on two rails with a spiked top, pivots at the piers; they swing into the pocket.
  const leaves: Group[] = [];
  if (P) {
    const g = P.gate, root = new Group();
    root.position.set(g.x, ground(g.x, g.z), g.z);
    root.rotation.y = g.rot;
    const W = g.half - 0.6;
    for (const s of [-1, 1]) {
      const b = new Builder(mats), leaf = new Group();
      // Local x from the pivot toward the middle.
      for (const y of [0.35, 1.2, 2.0]) b.box(mats.iron, new Matrix4().setPosition((-s * W) / 2, y, 0), W, 0.06, 0.06, IRON);
      for (let x = 0.08; x < W; x += 0.16) b.box(mats.iron, new Matrix4().setPosition(-s * x, 1.12 + (x * 0.18) / W, 0), 0.03, 2.2 + (x * 0.36) / W, 0.03, IRON);
      for (const mesh of b.solid.meshes()) { mesh.castShadow = true; leaf.add(mesh); }
      leaf.position.set(s * (g.half - 0.6), 0, 0);
      root.add(leaf);
      leaves.push(leaf);
    }
    group.add(root);
  }
  let openK = 0;
  let first = true;

  // Silhouettes in the true mirrors: follow the hero's side-to-side position, smaller with distance.
  const silTex = silhouetteTexture();
  const sils = (m.mirrors ?? []).filter((r) => r.shows).map((r) => {
    const mat = new MeshBasicMaterial({ color: 0xcfe6ff, map: silTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false });
    const card = new Mesh(new PlaneGeometry(MIRROR.w * 0.5, MIRROR.h * 0.8), mat);
    card.layers.set(FX_LAYER);
    const root = new Group();
    root.position.set(r.x, ground(r.x, r.z), r.z);
    root.rotation.y = r.rot;
    root.add(card);
    group.add(root);
    return { r, card, mat };
  });

  return {
    group,
    update(s: RiddleState, dt: number): void {
      // Plinths.
      let nearest = -1, best = 6;
      crystals.forEach((c, i) => {
        const k = Math.min(1, (s.t[i] ?? 0) / s.need), lit = k >= 1;
        c.mat.color.setHex(DIM).lerp(LIT_C, lit ? 1 : k * 0.6);
        if (lit) c.mesh.rotation.y += dt * 0.8;
        halos[i]!.visible = lit;
        const q = P!.pts[i]!, d = Math.hypot(q.x - s.x, q.z - s.z);
        if (!lit && d < best) { best = d; nearest = i; }
      });
      ring.visible = nearest >= 0;
      if (nearest >= 0) {
        const q = P!.pts[nearest]!, k = Math.min(1, (s.t[nearest] ?? 0) / s.need), inside = best < P!.r;
        ring.position.set(q.x, ground(q.x, q.z) + 0.08, q.z);
        arc.visible = k > 0;
        arcGeo.setDrawRange(0, Math.round(64 * k) * 6);
        (dashMesh.material as MeshBasicMaterial).opacity = inside ? 0.6 : 0.3;
      }
      // Gate: swings over `SWING` seconds; a resumed run finds it open.
      // A new run closes it again (the sim restores the collider).
      if (s.open) openK = first ? 1 : Math.min(1, openK + dt / SWING);
      else openK = 0;
      first = false;
      const e = openK * openK * (3 - 2 * openK);
      leaves.forEach((leaf, i) => { leaf.rotation.y = (i === 0 ? 1 : -1) * e * Math.PI * 0.5; });
      // Mirrors: the hero in front, within 9 m.
      for (const v of sils) {
        const dx = s.x - v.r.x, dz = s.z - v.r.z;
        const front = dx * Math.sin(v.r.rot) + dz * Math.cos(v.r.rot), side = dx * Math.cos(v.r.rot) - dz * Math.sin(v.r.rot);
        const d = Math.hypot(dx, dz), a = front > 0.3 ? Math.max(0, Math.min(1, (9 - d) / 3)) : 0;
        v.mat.opacity = a * 0.85;
        v.card.visible = a > 0;
        const sc = Math.max(0.4, Math.min(1, 2.6 / (d + 1.2)));
        v.card.scale.set(sc, sc, 1);
        const lim = (MIRROR.w * (1 - 0.5 * sc)) / 2 - 0.05;
        v.card.position.set(Math.max(-lim, Math.min(lim, side * 0.35)), 0.3 + MIRROR.h * (0.5 - 0.4 * (1 - sc)), 0.085);
      }
    },
  };
}

/** Round soft glow (white centre fading out). */
function glowDisc(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}
