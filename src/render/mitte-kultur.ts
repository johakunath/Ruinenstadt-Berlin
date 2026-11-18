// M15 Mitte step 4: the Tiergarten and Kulturforum landmarks plus the Galeries Lafayette and Checkpoint Charlie, built
// from photos (Wikipedia/Commons, 2026-11-18; `docs/maps/landmarks.md`). Each builder returns true when it drew the kind;
// `buildMitteLandmark` falls back to the step 2 massing otherwise. Cues (* = below 5 m, what the game camera sees):
//   Siegessäule: red granite plinth* with the green bronze frieze*, door and candles*, the column hall with gold mosaic and
//     railing (5.2 m), fluted dark column with four gilded cannon rings (photo: four, the 1939 drum), gilded Victoria (48 m).
//   Philharmonie: white foyer wing* with green ribbon windows*, clinker plinth and glass-block screens*, gold hall walls
//     sagging between high corners (the tent) under a pale metal roof (photo: the roof is silver, the walls gold), stair tower.
//   St. Matthäus: ochre brick with red bands*, three parallel gabled naves (three gables to the front), arched portals*,
//     square tower with clock, belfry gallery, corner pinnacles and the green pyramid spire.
//   Staatsbibliothek: glass foyer with gold fascia, lettering and lit entrance*, terraced reading room with white shed
//     lights, the closed gold book magazine.
//   Neue Nationalgalerie: granite terrace and steps*, lit glass hall with curtains*, eight black cross columns*, black roof
//     plate with ribbed fascia (5.9 m), the Calder sculpture*.
//   Galeries Lafayette: curved glass corners, polished floor bands, glass mansard, dark canopy* over the shuttered shop
//     front* with the lit entrance* and lettering*, red store banners, the (overgrown) green wall.
//   Checkpoint Charlie: white booth* with the row of spotlights* and the CHECKPOINT board, sandbags*, US flags*, the
//     sector sign behind it (German line only), raised striped barrier*.
// Cost: one new material (`atlas`: lettering, LED strips, bronze friezes, mosaic, the lit gallery hall), cached per
// `Materials`. Roughly 4.5k (Siegessäule), 1.5k (Philharmonie), 3.5k (Matthäus), 1.2k (Stabi), 1.5k (NNG), 0.9k (Lafayette),
// 0.7k (Checkpoint) triangles (estimated from the parts); one or two pooled lights each, no per-frame code.
import { BufferAttribute, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Matrix4, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import type { Landmark } from '../data/map';
import { Rng } from '../sim/math';
import type { LitMaterial, Materials } from './materials';
import { canvas, toTexture } from './paint';
import { archHead, archWindow, cached, ENDS, frameOf, frustum, pane, SLOPES, sub, type Frame } from './landmarks';
import { lp, type ChunkBuilder } from './map-world';
import type { MCtx, RGB } from './mitte-world';

type V3 = [number, number, number];
type V2 = [number, number];

// ---------------------------------------------------------------- sign atlas (the one new material)

/** Atlas regions in canvas px (x, y, w, h) of the 1024² sign atlas. */
type Region = readonly [number, number, number, number];
const R = {
  sektor: [0, 0, 1024, 256], lafayette: [0, 256, 1024, 128], phil: [0, 384, 512, 128], stabi: [512, 384, 512, 128],
  check: [0, 512, 512, 128], hall: [512, 512, 256, 128], cyan: [768, 512, 64, 128], magenta: [832, 512, 64, 128], amber: [896, 512, 64, 128], cold: [960, 512, 64, 128],
  reliefA: [0, 640, 896, 128], reliefB: [0, 768, 896, 128], banner: [896, 640, 128, 384], mosaic: [0, 896, 512, 128], flag: [512, 896, 256, 128],
} as const satisfies Record<string, Region>;

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 10) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

const SANS = 'bold %px "Helvetica Neue", Arial, sans-serif';
const SCRIPT = 'italic bold %px "Brush Script MT", "Segoe Script", Georgia, serif';
/** Shed light: a short gable prism (ridge along x) with its glazed ends. */
const ALL_SHED = SLOPES | ENDS;

/** Bronze frieze: soldiers, horses and flags in low relief on verdigris bronze (the Siegessäule plinth). */
function paintRelief(g: CanvasRenderingContext2D, r: Region, seed: number): void {
  const [x0, y0, w, h] = r, rng = new Rng(seed);
  g.fillStyle = '#33433a';
  g.fillRect(x0, y0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = x0 + 14 + rng.range(0, w - 28), base = y0 + h - 12, s = rng.range(0.75, 1.1);
    g.fillStyle = rng.pick(['#5a6e61', '#4b5d51', '#6a8072', '#425246']);
    if (rng.next() < 0.22) {
      // Horse with rider.
      g.beginPath(); g.ellipse(x, base - 34 * s, 22 * s, 11 * s, 0, 0, Math.PI * 2); g.fill();
      for (const dx of [-15, -8, 9, 16]) g.fillRect(x + dx * s, base - 26 * s, 4 * s, 26 * s);
      g.beginPath(); g.ellipse(x + 23 * s, base - 50 * s, 6 * s, 14 * s, 0.5, 0, Math.PI * 2); g.fill();
      g.fillRect(x - 5 * s, base - 70 * s, 10 * s, 26 * s);
      g.beginPath(); g.arc(x, base - 76 * s, 6 * s, 0, Math.PI * 2); g.fill();
    } else {
      g.fillRect(x - 6 * s, base - 54 * s, 12 * s, 30 * s);
      g.fillRect(x - 6 * s, base - 26 * s, 5 * s, 26 * s);
      g.fillRect(x + 1 * s, base - 26 * s, 5 * s, 26 * s);
      g.beginPath(); g.arc(x, base - 62 * s, 6.5 * s, 0, Math.PI * 2); g.fill();
      if (rng.next() < 0.3) { g.fillRect(x + 6 * s, base - 100 * s, 2.5 * s, 60 * s); g.fillRect(x + 8 * s, base - 100 * s, 18 * s, 12 * s); }
    }
  }
  // Highlights on the top edges, dark shadow below, panel joints and the frame.
  g.fillStyle = 'rgba(150,180,160,0.12)';
  g.fillRect(x0, y0 + 10, w, h * 0.3);
  g.fillStyle = 'rgba(10,16,12,0.35)';
  g.fillRect(x0, y0 + h - 14, w, 14);
  g.fillStyle = '#22302a';
  for (const f of [0.41, 0.74]) g.fillRect(x0 + w * f, y0, 6, h);
  g.strokeStyle = '#1b2420';
  g.lineWidth = 8;
  g.strokeRect(x0 + 4, y0 + 4, w - 8, h - 8);
}

/** Glass mosaic of the column hall: figures on gold ground. */
function paintMosaic(g: CanvasRenderingContext2D, r: Region): void {
  const [x0, y0, w, h] = r, rng = new Rng(1875);
  g.fillStyle = '#b48c34';
  g.fillRect(x0, y0, w, h);
  for (let i = 0; i < 900; i++) { g.fillStyle = rng.pick(['#c89c40', '#9c7428', '#d6b050', '#a8842e']); g.fillRect(x0 + rng.range(0, w), y0 + rng.range(0, h), 4, 4); }
  for (let i = 0; i < 9; i++) {
    const x = x0 + 26 + i * (w - 52) / 8 + rng.range(-8, 8), cols = rng.pick([['#8e2e24', '#d8d0bc'], ['#2c4876', '#c8bca0'], ['#3e5a34', '#8e2e24'], ['#d8d0bc', '#2c4876']]);
    g.fillStyle = cols[0]!;
    g.beginPath(); g.moveTo(x - 16, y0 + h - 14); g.lineTo(x - 6, y0 + 38); g.lineTo(x + 6, y0 + 38); g.lineTo(x + 16, y0 + h - 14); g.fill();
    g.fillStyle = cols[1]!;
    g.fillRect(x - 7, y0 + 46, 14, 26);
    g.fillStyle = '#e0c8a8';
    g.beginPath(); g.arc(x, y0 + 30, 8, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#3a2a18';
  g.fillRect(x0, y0, w, 8);
  g.fillRect(x0, y0 + h - 8, w, 8);
}

/** The atlas; `glow` paints the emissive version (letters and LEDs bright, bronze and mosaic dark). */
function paintAtlas(g: CanvasRenderingContext2D, glow: boolean): void {
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 1024);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fill = (r: Region, col: string): void => { g.fillStyle = col; g.fillRect(r[0], r[1], r[2], r[3]); };
  const word = (r: Region, text: string, col: string, size: number, font = SANS, dy = 0): void => {
    g.fillStyle = col;
    fitText(g, text, r[0] + r[2] / 2, r[1] + r[3] / 2 + 4 + dy, r[2] - 48, size, font);
  };
  // The sector sign: white enamel, black letters and rim, rust at the edges (2089); floodlit at night.
  const s = R.sektor;
  fill(s, glow ? '#4a463c' : '#ece8da');
  g.strokeStyle = '#111';
  g.lineWidth = 14;
  g.strokeRect(s[0] + 10, s[1] + 10, s[2] - 20, s[3] - 20);
  word(s, 'SIE VERLASSEN DEN', '#111', 92, SANS, -52);
  word(s, 'AMERIKANISCHEN SEKTOR', '#111', 92, SANS, 52);
  if (!glow) {
    const rng = new Rng(1961);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,60,25,${rng.range(0.1, 0.35)})`; g.beginPath(); g.arc(rng.pick([s[0] + 20, s[0] + s[2] - 20, s[0] + rng.range(0, s[2])]), s[1] + rng.pick([18, s[3] - 18, rng.range(0, s[3])]), rng.range(6, 22), 0, Math.PI * 2); g.fill(); }
  }
  // Lettering.
  fill(R.lafayette, glow ? '#000' : '#15191f');
  word(R.lafayette, 'Galeries Lafayette', glow ? '#fff' : '#f4efe4', 96, SCRIPT);
  // Red store banner, the script running down it.
  {
    const [x0, y0, w, h] = R.banner;
    fill(R.banner, glow ? '#3a0c10' : '#b42430');
    g.save();
    g.translate(x0 + w / 2, y0 + h / 2);
    g.rotate(Math.PI / 2);
    g.fillStyle = glow ? '#c8c8c8' : '#f6f0ea';
    fitText(g, 'Galeries Lafayette', 0, 4, h - 40, 64, SCRIPT);
    g.restore();
  }
  fill(R.phil, glow ? '#000' : '#3a3020');
  word(R.phil, 'PHILHARMONIE', glow ? '#c89848' : '#ecc468', 80);
  fill(R.stabi, glow ? '#000' : '#3a3020');
  word(R.stabi, 'STAATSBIBLIOTHEK', glow ? '#b8a070' : '#efe0b0', 80);
  fill(R.check, glow ? '#3c3a32' : '#eeece4');
  g.strokeStyle = '#111';
  g.lineWidth = 8;
  g.strokeRect(R.check[0] + 6, R.check[1] + 6, R.check[2] - 12, R.check[3] - 12);
  word(R.check, 'CHECKPOINT', '#111', 84);
  // The lit gallery hall: pale curtains behind black mullions, two dark broken panes.
  {
    const [x0, y0, w, h] = R.hall, rng = new Rng(1968);
    const bw = w / 12;
    for (let k = 0; k < 12; k++) {
      const bx = x0 + k * bw, curtain = [0, 1, 4, 5, 6, 10].includes(k);
      // Curtained bays glow pale; open bays show the dark hall with a lit floor and a few exhibits.
      g.fillStyle = curtain ? (glow ? '#5c6268' : '#d0d2ce') : glow ? '#14181e' : '#3a4650';
      g.fillRect(bx, y0, bw, h);
      if (curtain) for (let x = 0; x < bw; x += 4) { g.fillStyle = glow ? `rgba(0,0,0,${rng.range(0, 0.3)})` : `rgba(90,95,100,${rng.range(0.05, 0.3)})`; g.fillRect(bx + x, y0 + 14, 2, h - 14); }
      else {
        g.fillStyle = glow ? '#3a4048' : '#9aa4aa';
        g.fillRect(bx, y0 + h - 22, bw, 16);
        if (k % 3 === 2) { g.fillStyle = glow ? '#000' : '#202428'; g.fillRect(bx + bw * 0.3, y0 + h * 0.45, bw * 0.4, h * 0.4); }
      }
    }
    g.fillStyle = glow ? '#000' : '#101214';
    g.fillRect(x0 + 8 * bw + 3, y0 + 40, bw - 6, h * 0.35);
    g.fillStyle = '#0c0d0e';
    g.fillRect(x0, y0, w, 12);
    for (let k = 0; k <= 12; k++) g.fillRect(x0 + Math.min(w - 3, k * (w / 12)), y0, 3, h);
    g.fillRect(x0, y0 + h - 6, w, 6);
  }
  // LED swatches (Potsdamer Platz accents).
  fill(R.cyan, '#43d1cf');
  fill(R.magenta, '#ff4fa3');
  fill(R.amber, '#e19142');
  fill(R.cold, '#9fb4ff');
  // US flag on the booth (unlit).
  if (!glow) {
    const [x0, y0, w, h] = R.flag;
    fill(R.flag, '#e8e4dc');
    g.fillStyle = '#9a2a2a';
    for (let k = 0; k < 13; k += 2) g.fillRect(x0, y0 + (k * h) / 13, w, h / 13);
    g.fillStyle = '#26345e';
    g.fillRect(x0, y0, w * 0.42, h * (7 / 13));
  }
  if (!glow) {
    paintRelief(g, R.reliefA, 1871);
    paintRelief(g, R.reliefB, 1864);
    paintMosaic(g, R.mosaic);
  }
}

const atlases = new WeakMap<Materials, LitMaterial>();
function atlas(c: MCtx): LitMaterial {
  const m = c.N.materials;
  let a = atlases.get(m);
  if (!a) {
    const [c1, g1] = canvas(1024, 1024), [c2, g2] = canvas(1024, 1024);
    paintAtlas(g1, false);
    paintAtlas(g2, true);
    a = m.surface({ map: toTexture(c1, false, m.profile.anisotropy), emissiveMap: toTexture(c2, false, 4), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 });
    atlases.set(m, a);
  }
  return a;
}

function regionGeo(r: Region): BufferGeometry {
  return cached(`mk-r${r.join(',')}`, () => {
    const g = new PlaneGeometry(1, 1), uv = g.getAttribute('uv');
    const u0 = r[0] / 1024, u1 = (r[0] + r[2]) / 1024, v1 = 1 - r[1] / 1024, v0 = 1 - (r[1] + r[3]) / 1024;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return g;
  });
}

/** A w × h plate of atlas region `r`, centred on `m` (facing +z). */
function plate(b: ChunkBuilder, A: LitMaterial, r: Region, m: Matrix4, w: number, h: number): void {
  b.geo(A, regionGeo(r), m.clone().multiply(new Matrix4().makeScale(w, h, 1)));
}

// ---------------------------------------------------------------- geometry helpers

/** Flat-shaded triangle soup (non-indexed, normals per face). Winding: counter-clockwise seen from the front. */
class Soup {
  private readonly p: number[] = [];
  private readonly t: number[] = [];
  tri(a: V3, b: V3, c: V3, ua: V2, ub: V2, uc: V2): void {
    this.p.push(...a, ...b, ...c);
    this.t.push(...ua, ...ub, ...uc);
  }
  quad(a: V3, b: V3, c: V3, d: V3, ua: V2, ub: V2, uc: V2, ud: V2): void {
    this.tri(a, b, c, ua, ub, uc);
    this.tri(a, c, d, ua, uc, ud);
  }
  geo(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.t), 2));
    g.computeVertexNormals();
    return g;
  }
}

/** Walls along a closed outline (counter-clockwise seen from above), uv in metres × `s`; `skip` drops edges by index. */
function ring(pts: readonly V2[], y0: number, y1: number, s: number, skip: readonly number[] = []): BufferGeometry {
  const w = new Soup();
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[(i + 1) % pts.length]!, len = Math.hypot(bx - ax, bz - az);
    if (!skip.includes(i)) w.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [acc * s, y0 * s], [(acc + len) * s, y0 * s], [(acc + len) * s, y1 * s], [acc * s, y1 * s]);
    acc += len;
  }
  return w.geo();
}

/** Flat cap over a convex outline at height y (fan from its centroid), uv in metres × `s`. */
function cap(pts: readonly V2[], y: number, s: number): BufferGeometry {
  const w = new Soup(), cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i]!, [bx, bz] = pts[(i + 1) % pts.length]!;
    w.tri([cx, y, cz], [ax, y, az], [bx, y, bz], [cx * s, cz * s], [ax * s, az * s], [bx * s, bz * s]);
  }
  return w.geo();
}

/** Scales a geometry's uvs (cylinders: metres around and up). */
function uvs(g: BufferGeometry, su: number, sv: number): BufferGeometry {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

/** Cylinder centred on its height; `mat` frame `m` at the centre. */
function cyl(b: ChunkBuilder, mat: Material, m: Matrix4, r0: number, r1: number, h: number, seg: number, tint?: RGB, open = false): void {
  const g = cached(`mk-cy${r0.toFixed(2)},${r1.toFixed(2)},${h.toFixed(2)},${seg},${open}`, () => uvs(new CylinderGeometry(r0, r1, h, seg, 1, open), Math.PI * (r0 + r1) * 0.5, h * 0.5));
  b.geo(mat, g, m, tint);
}

/** A box between two local points (rod, arm, leg) with section s. */
function rod(b: ChunkBuilder, mat: Material, F: Frame, a: V3, c: V3, s: number, tint?: RGB, s2 = s): void {
  const A = new Vector3(...a), C = new Vector3(...c), d = C.clone().sub(A), len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  const mid = A.add(C).multiplyScalar(0.5);
  b.box(mat, F(mid.x, mid.y, mid.z).multiply(new Matrix4().makeRotationFromQuaternion(q)), s, len, s2, tint);
}

// ---------------------------------------------------------------- Siegessäule

const GOLD: RGB = [1.22, 0.96, 0.46];

/** Fluted drum: 2n segments, every other ring vertex pulled in (the flutes catch the light). */
function fluted(r: number, h: number, n: number): BufferGeometry {
  return cached(`mk-flute${r.toFixed(2)},${h}`, () => {
    const g = new CylinderGeometry(r * 0.96, r, h, n * 2, 1, true), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) if ((i % (n * 2 + 1)) % 2) { p.setX(i, p.getX(i) * 0.9); p.setZ(i, p.getZ(i) * 0.9); }
    g.computeVertexNormals();
    return uvs(g, Math.PI * r, h * 0.5);
  });
}

function siegessaeule(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = frameOf(l), A = atlas(c);
  const GR: RGB = [0.7, 0.42, 0.36], GRD: RGB = [0.56, 0.32, 0.28], STONE: RGB = [0.4, 0.38, 0.34], BRZ: RGB = [0.36, 0.33, 0.28], CU: RGB = [0.48, 0.72, 0.62];
  // Plinth: step, socle, body, cornice (all inside the 9 × 9 m collider).
  b.box(M.stucco, F(0, 0.15, 0), 9, 0.3, 9, GRD);
  b.box(M.stucco, F(0, 0.75, 0), 8.6, 0.9, 8.6, GR);
  b.box(M.stucco, F(0, 2.55, 0), 8.2, 2.7, 8.2, GR);
  b.box(M.stucco, F(0, 4.05, 0), 8.7, 0.3, 8.7, GRD);
  b.box(M.stucco, F(0, 4.32, 0), 8.3, 0.25, 8.3, GR);
  for (let k = 0; k < 4; k++) {
    const m = F(0, 0, 0, (k * Math.PI) / 2);
    // Bronze frieze in a dark frame, joints in the granite, the door below (front).
    b.box(M.iron, sub(m, 0, 2.75, 4.1), 7.3, 1.15, 0.06, [0.5, 0.6, 0.52]);
    plate(b, A, k % 2 ? R.reliefB : R.reliefA, sub(m, 0, 2.75, 4.14), 7.1, 1.0);
    b.box(M.stucco, sub(m, 0, 2.0, 4.1), 8.2, 0.08, 0.04, GRD);
    b.box(M.stucco, sub(m, 0, 3.5, 4.1), 8.2, 0.08, 0.04, GRD);
  }
  b.box(M.dark, F(0, 0.95, 4.2), 0.8, 1.3, 0.3);
  b.box(M.stucco, F(0, 1.68, 4.33), 1.2, 0.16, 0.12, GRD);
  // Candles and wreaths of the people who camp on the island, on the step before the door.
  const rng = new Rng(1873);
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-1.6, 1.6), z = rng.range(4.36, 4.46), h = rng.range(0.08, 0.22);
    b.box(i % 3 ? M.lampGlass : M.stucco, F(x, 0.3 + h / 2, z), 0.06, h, 0.06, [1.3, 1.25, 1.1]);
  }
  b.geo(M.enamel, cached('mk-wreath', () => new TorusGeometry(0.28, 0.08, 5, 12)), F(1.15, 0.62, 4.36), [0.3, 0.45, 0.28]);
  b.light(lp(l, 0, 0.7, 5.3), 0xffb262, 5, 6, 0.25, 2.2);
  b.light(lp(l, 0, 3.2, 7.5), 0xb4c8ff, 7, 12, 0, 3.5);
  // Round drum and the column hall: 16 granite columns around the mosaic wall, gold railing, copper-capped ring.
  cyl(b, M.stucco, F(0, 4.62, 0), 3.25, 3.3, 0.35, 24, GRD);
  cyl(b, M.stucco, F(0, 5.0, 0), 2.95, 3.0, 0.4, 24, GR);
  cyl(b, M.stucco, F(0, 7.4, 0), 1.9, 1.9, 4.4, 16, GRD);
  for (let k = 0; k < 4; k++) {
    const g = cached(`mk-mosaic${k}`, () => {
      const q = new CylinderGeometry(1.94, 1.94, 3.3, 6, 1, true, (k * Math.PI) / 2, Math.PI / 2), uv = q.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (512 / 1024), (128 / 1024) * uv.getY(i));
      return q;
    });
    b.geo(A, g, F(0, 7.55, 0));
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16, x = Math.sin(a) * 2.55, z = Math.cos(a) * 2.55;
    b.box(M.stucco, F(x, 5.32, z, a), 0.46, 0.24, 0.46, GRD);
    cyl(b, M.stucco, F(x, 7.5, z), 0.16, 0.19, 4.1, 8, GR);
    b.box(M.iron, F(x, 9.68, z, a), 0.48, 0.26, 0.48, BRZ);
  }
  for (const y of [5.75, 6.25]) b.geo(N.gold, cached('mk-rail', () => new TorusGeometry(2.55, 0.03, 3, 32).rotateX(Math.PI / 2)), F(0, y, 0), GOLD);
  cyl(b, M.stucco, F(0, 10.15, 0), 2.85, 2.85, 0.6, 24, GR);
  cyl(b, M.enamel, F(0, 10.62, 0), 2.2, 2.95, 0.34, 24, CU);
  // The column: pedestal, four fluted drums with gilded cannon barrels, capital with eagles, the gilded gallery.
  cyl(b, N.sandstone, F(0, 11.75, 0), 1.3, 1.55, 1.9, 16, STONE);
  cyl(b, N.sandstone, F(0, 12.75, 0), 1.42, 1.42, 0.25, 16, STONE);
  const D = 5.15, y0 = 12.85;
  for (let k = 0; k < 4; k++) {
    const y = y0 + k * D, r = 1.1 - k * 0.035;
    b.geo(N.sandstone, fluted(r, D, 12), F(0, y + D / 2, 0), [0.36, 0.34, 0.31]);
    cyl(b, N.sandstone, F(0, y + D - 0.12, 0), r + 0.1, r + 0.1, 0.28, 16, STONE);
    const g = cached('mk-barrel', () => new CylinderGeometry(0.07, 0.1, 1.35, 5, 1, true));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      b.geo(N.gold, g, F(Math.sin(a) * (r + 0.02), y + 1.1, Math.cos(a) * (r + 0.02)), GOLD);
    }
    for (const dy of [0.38, 1.82]) b.geo(N.gold, cached(`mk-band${k}`, () => new TorusGeometry(r + 0.06, 0.06, 3, 16).rotateX(Math.PI / 2)), F(0, y + dy, 0), GOLD);
  }
  const top = y0 + 4 * D;
  cyl(b, M.iron, F(0, top + 0.8, 0), 1.45, 1.0, 1.6, 12, BRZ);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    b.box(M.iron, F(Math.sin(a) * 1.2, top + 1.0, Math.cos(a) * 1.2, a), 0.5, 0.9, 0.35, BRZ);
  }
  b.box(N.sandstone, F(0, top + 1.82, 0), 2.9, 0.45, 2.9, STONE);
  cyl(b, N.gold, F(0, top + 2.6, 0), 1.4, 1.4, 1.0, 16, GOLD, true);
  cyl(b, N.sandstone, F(0, top + 2.8, 0), 0.95, 0.95, 1.5, 12, STONE);
  cyl(b, N.sandstone, F(0, top + 3.75, 0), 0.6, 0.95, 0.4, 12, STONE);
  victoria(b, N.gold, F, top + 3.95);
  b.shadowBox(F(0, 2.2, 0), 8.4, 4.4, 8.4);
  b.shadowBox(F(0, 7.6, 0), 5.8, 6.4, 5.8);
  b.shadowBox(F(0, 25, 0), 2.2, 24, 2.2);
}

/** The gilded Victoria (about 9 m with wreath and staff), facing the front. */
function victoria(b: ChunkBuilder, gold: Material, F: Frame, y: number): void {
  cyl(b, gold, F(0, y + 1.7, 0.05), 0.42, 0.88, 3.4, 10, GOLD);
  b.box(gold, F(0, y + 1.5, -0.55, 0, -0.22), 0.95, 2.6, 0.3, GOLD);
  cyl(b, gold, F(0, y + 4.15, 0), 0.38, 0.44, 1.5, 8, GOLD);
  b.box(gold, F(0, y + 4.85, 0), 1.05, 0.38, 0.5, GOLD);
  b.geo(gold, cached('mk-head', () => new SphereGeometry(0.3, 8, 6)), F(0, y + 5.35, 0.02), GOLD);
  b.geo(gold, cached('mk-helm', () => new ConeGeometry(0.3, 0.5, 6)), F(0, y + 5.7, -0.02), GOLD);
  // Right arm up with the laurel wreath, left arm down to the staff with the Iron Cross.
  rod(b, gold, F, [-0.5, y + 4.85, 0], [-1.25, y + 6.55, 0.3], 0.2, GOLD);
  b.geo(gold, cached('mk-laurel', () => new TorusGeometry(0.36, 0.07, 5, 14)), F(-1.35, y + 6.95, 0.32), GOLD);
  rod(b, gold, F, [0.5, y + 4.85, 0], [0.78, y + 3.95, 0.4], 0.2, GOLD);
  rod(b, gold, F, [0.8, y + 1.2, 0.42], [0.8, y + 8.2, 0.42], 0.09, GOLD);
  b.geo(gold, cached('mk-crossRing', () => new TorusGeometry(0.32, 0.05, 4, 12)), F(0.8, y + 8.4, 0.42), GOLD);
  b.box(gold, F(0.8, y + 8.4, 0.42), 0.5, 0.12, 0.07, GOLD);
  b.box(gold, F(0.8, y + 8.4, 0.42), 0.12, 0.5, 0.07, GOLD);
  // Wings: tapered double-sided sheets spread up and back.
  const wing = cached('mk-wing', () => {
    const s = new Soup(), o: V2[] = [[0, 0], [0.7, -0.5], [1.7, 0.4], [2.5, 2.2], [2.4, 3.3], [1.4, 2.7], [0.4, 1.3]];
    for (let i = 1; i + 1 < o.length; i++) {
      const a: V3 = [o[0]![0], o[0]![1], 0], p: V3 = [o[i]![0], o[i]![1], 0], q: V3 = [o[i + 1]![0], o[i + 1]![1], 0];
      s.tri(a, p, q, [0, 0], [p[0] / 3, p[1] / 3], [q[0] / 3, q[1] / 3]);
      s.tri(a, q, p, [0, 0], [q[0] / 3, q[1] / 3], [p[0] / 3, p[1] / 3]);
    }
    return s.geo();
  });
  for (const sx of [1, -1]) b.geo(gold, wing, F(sx * 0.25, y + 4.8, -0.35, sx * 0.55).multiply(new Matrix4().makeScale(sx, 1, 1)), GOLD);
}

// ---------------------------------------------------------------- Philharmonie

let philGeo: readonly [BufferGeometry, BufferGeometry] | null = null;

function philharmonie(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = frameOf(l), A = atlas(c), rng = new Rng(1963);
  const GOLDW: RGB = [1.08, 0.9, 0.56], WHITE: RGB = [1.3, 1.4, 1.6], ROOF: RGB = [0.88, 0.9, 0.94];
  // Hall: an irregular plan whose gold walls sag between high corners (the tent); the pale roof fans to a low centre.
  const P: V3[] = [[-12.6, 5.2, 12.5], [5.2, 6.0, 16.5], [12.6, 1.2, 21], [13.6, -8.8, 15], [0.5, -10.6, 18.5], [-13.6, -6.4, 12.5]];
  const apex: V3 = [1.5, 14.5, -1.8];
  const g = philGeo ??= ((): readonly [BufferGeometry, BufferGeometry] => {
    const wall = new Soup(), roof = new Soup(), n = 8;
    for (let i = 0; i < P.length; i++) {
      const [ax, az, ah] = P[i]!, [bx, bz, bh] = P[(i + 1) % P.length]!, len = Math.hypot(bx - ax, bz - az), sag = 1.8 + len * 0.13;
      const at = (t: number): V3 => [ax + (bx - ax) * t, ah + (bh - ah) * t - sag * 4 * t * (1 - t), az + (bz - az) * t];
      for (let k = 0; k < n; k++) {
        const p0 = at(k / n), p1 = at((k + 1) / n), s0 = (k / n) * len, s1 = ((k + 1) / n) * len;
        // u up the wall, v along it: the gold texture's 2 × 1 m panels stand upright.
        wall.quad([p0[0], 0, p0[2]], [p1[0], 0, p1[2]], p1, p0, [0, s0 / 8], [0, s1 / 8], [p1[1] / 8, s1 / 8], [p0[1] / 8, s0 / 8]);
        roof.tri(apex, [p0[0], p0[1] + 0.25, p0[2]], [p1[0], p1[1] + 0.25, p1[2]], [apex[0] / 3, apex[2] / 3], [p0[0] / 3, p0[2] / 3], [p1[0] / 3, p1[2] / 3]);
      }
    }
    return [wall.geo(), roof.geo()] as const;
  })();
  b.geo(N.gold, g[0], F(0, 0, 0), GOLDW);
  b.geo(M.corrugated, g[1], F(0, 0, 0), ROOF);
  // Stair tower at the high corner: white panels framed in gold.
  const tx = 10.4, tz = 4.0, TH = 22.5;
  b.box(M.stucco, F(tx, TH / 2, tz, -0.55), 2.4, TH, 2.4, WHITE);
  const tm = F(tx, 0, tz, -0.55);
  for (const [x, z] of [[-1.2, 1.2], [1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]] as const) b.box(N.gold, sub(tm, x, TH / 2, z), 0.28, TH, 0.28, GOLDW);
  for (let y = 2.4; y < TH; y += 2.25) b.box(N.gold, sub(tm, 0, y, 0), 2.56, 0.12, 2.56, GOLDW);
  for (let y = 7.5; y < TH - 2; y += 4.5) pane(b, sub(tm, 0, y, 1.2), 0.5, 1.6, rng, 0.2);
  // Foyer wing along the front: white render, two ribbon windows (the upper one canted out), clinker plinth,
  // glass-block screens and the entrance under a canopy with the lettering.
  const fx0 = -14.6, fx1 = 8.2, fz0 = 5.0, fz1 = 10.3, FH = 6.0, fw = fx1 - fx0, fcx = (fx0 + fx1) / 2, fd = fz1 - fz0;
  b.box(M.stucco, F(fcx, FH / 2, (fz0 + fz1) / 2), fw, FH, fd, WHITE);
  b.box(M.corrugated, F(fcx, FH + 0.12, (fz0 + fz1) / 2 + 0.1), fw + 0.4, 0.24, fd + 0.4, ROOF);
  b.box(M.stucco, F(11.3, 2.6, 7.4, -0.5), 5.6, 5.2, 4.4, WHITE);
  b.box(M.corrugated, F(11.3, 5.3, 7.4, -0.5), 5.9, 0.2, 4.7, ROOF);
  const ribbon = (m: Matrix4, w: number): void => {
    b.box(M.glass, sub(m, 0, 2.35, 0.04), w, 0.9, 0.08);
    b.box(M.glass, sub(m, 0, 4.35, 0.22, 0, 0.14), w, 1.5, 0.08);
    b.box(M.stucco, sub(m, 0, 1.86, 0.1), w + 0.2, 0.1, 0.2, WHITE);
    b.box(M.stucco, sub(m, 0, 3.55, 0.12), w + 0.2, 0.12, 0.26, WHITE);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += 1.25) {
      b.box(M.stucco, sub(m, x, 2.35, 0.09), 0.08, 0.9, 0.06, WHITE);
      b.box(M.stucco, sub(m, x, 4.35, 0.3, 0, 0.14), 0.08, 1.5, 0.06, WHITE);
    }
  };
  const fm = F(fcx, 0, fz1);
  ribbon(sub(fm, -3, 0, 0), fw - 8.5);
  ribbon(F(11.3, 0, 7.4, -0.5).multiply(new Matrix4().makeTranslation(0, -0.6, 2.2)), 4.4);
  b.box(M.brick, sub(fm, -6.8, 0.85, 0.05), 9, 1.7, 0.1, [0.55, 0.36, 0.28]);
  b.box(M.concrete, sub(fm, 1.4, 0.85, 0.05), 7.2, 1.7, 0.1, [0.82, 0.88, 0.9], 2.5);
  for (let x = -2.2; x <= 5; x += 0.9) b.box(M.stucco, sub(fm, x, 0.85, 0.11), 0.06, 1.7, 0.04, WHITE);
  // Entrance: dark glass doors, a thin canopy at 3 m with a cold LED edge and the name on top.
  const ex = 8.8;
  b.box(M.glass, sub(fm, ex, 1.25, 0.06), 3.6, 2.5, 0.08);
  for (const x of [-1.8, -0.6, 0.6, 1.8]) b.box(M.iron, sub(fm, ex + x, 1.25, 0.11), 0.08, 2.5, 0.06, [0.6, 0.6, 0.62]);
  b.box(M.concrete, sub(fm, ex, 3.05, 1.0), 5.2, 0.22, 2.0, [1.1, 1.12, 1.15]);
  plate(b, A, R.cold, sub(fm, ex, 2.96, 2.01), 5.0, 0.06);
  plate(b, A, R.phil, sub(fm, ex, 3.6, 1.9), 4.8, 0.85);
  b.box(M.iron, sub(fm, ex, 3.6, 1.86), 4.9, 0.9, 0.05, [0.4, 0.38, 0.34]);
  b.light(lp(l, ex + fcx, 2.6, fz1 + 2.6), 0xffcc8a, 9, 10, 0.05, 3.2);
  b.light(lp(l, -5.5, 2.4, fz1 + 1.6), 0x6a8cff, 5, 8, 0, 3);
  b.shadowBox(F(0, 8, -2.5), 26, 16, 15);
  b.shadowBox(F(fcx, FH / 2, (fz0 + fz1) / 2), fw, FH, fd);
  b.shadowBox(F(tx, TH / 2, tz, -0.55), 2.4, TH, 2.4);
}

// ---------------------------------------------------------------- St.-Matthäus-Kirche

function matthaeus(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = frameOf(l), rng = new Rng(1846);
  const YEL: RGB = [1.08, 0.74, 0.46], YEL2: RGB = [1.16, 0.84, 0.56], RED: RGB = [0.95, 0.46, 0.34], CU: RGB = [0.55, 0.88, 0.76];
  const H = 8.2, RISE = 1.9, z0 = -8, z1 = 6.6, L = z1 - z0, zc = (z0 + z1) / 2;
  const naves: Array<[number, number]> = [[-3.35, 3.3], [0, 3.4], [3.35, 3.3]];
  // Red brick bands across a face: frame `m` (x along, z out), width w at y0, narrowing to `top` at y1 (gables).
  const bands = (m: Matrix4, w: number, y0: number, y1: number, top = w): void => {
    const p = (x: number, y: number): Vector3 => new Vector3(x, y, 0.014).applyMatrix4(m);
    for (let y = y0 + 0.45; y < y1 - 0.1; y += 0.62) {
      const f = (y - y0) / (y1 - y0), bw = (w + (top - w) * f) / 2;
      b.solid.of(M.brick).quad([p(-bw, y - 0.08), p(bw, y - 0.08), p(bw, y + 0.08), p(-bw, y + 0.08)], [0, 0, bw, 0.16], [RED]);
    }
  };
  // Three parallel naves, each with its own copper gable roof; ochre brick walls with the red bands.
  for (const [x, w] of naves) {
    b.box(N.sandstone, F(x, H / 2, zc), w, H, L, YEL);
    b.geo(M.corrugated, frustum(L + 0.5, w + 0.5, RISE, L + 0.5, 0, SLOPES), F(x, H, zc, Math.PI / 2), CU);
    b.geo(N.sandstone, frustum(L, w, RISE, L, 0, ENDS), F(x, H, zc, Math.PI / 2), YEL);
    b.box(N.sandstone, F(x, H - 0.15, z1 + 0.05), w + 0.2, 0.3, 0.12, YEL2);
  }
  b.box(M.concrete, F(0, 0.35, zc), 10.1, 0.7, L + 0.1, [0.6, 0.56, 0.5]);
  // Long sides: five bays with lesenes, three tall arched windows above, two small ones below.
  for (const s of [1, -1]) {
    const m = F(s * 5, 0, zc, (s * Math.PI) / 2);
    bands(m, L, 0.7, H);
    for (let k = 0; k <= 5; k++) b.box(N.sandstone, sub(m, (k / 5 - 0.5) * L, H / 2, 0.1), 0.42, H, 0.2, YEL2);
    b.box(N.sandstone, sub(m, 0, H - 0.25, 0.14), L, 0.3, 0.28, YEL2);
    for (let k = 0; k < 5; k++) {
      const bx = ((k + 0.5) / 5 - 0.5) * L;
      for (const dx of [-0.62, 0, 0.62]) archWindow(b, sub(m, bx + dx, dx ? 5.3 : 5.5, 0.02), 0.42, dx ? 2.0 : 2.4, rng, 0.15, false, { mat: N.sandstone, color: YEL2 });
      for (const dx of [-0.3, 0.3]) archWindow(b, sub(m, bx + dx, 1.9, 0.02), 0.3, 0.8, rng, 0.1, false);
    }
  }
  // Front: the two side gables with a window triplet, an oculus and an arched door each; the tower in the middle.
  for (const [x, w] of [naves[0]!, naves[2]!]) {
    const m = F(x, 0, z1);
    bands(m, w, 0.7, H);
    bands(sub(m, 0, 0, 0), w, H, H + RISE - 0.2, 0);
    for (const dx of [-0.7, 0, 0.7]) archWindow(b, sub(m, dx, dx ? 5.0 : 5.25, 0.02), 0.42, dx ? 1.9 : 2.4, rng, 0.2, false, { mat: N.sandstone, color: YEL2 });
    b.geo(N.sandstone, cached('mk-oculus', () => new TorusGeometry(0.34, 0.08, 5, 14)), sub(m, 0, H + 0.62, 0.05), YEL2);
    b.geo(M.dark, cached('mk-ocDisc', () => new CircleGeometry(0.3, 12)), sub(m, 0, H + 0.62, 0.04));
    b.box(N.sandstone, sub(m, 0, 1.25, 0.1), 1.5, 2.5, 0.2, YEL2);
    archHead(b, N.sandstone, sub(m, 0, 2.5, 0), 1.5, false, 0.1, YEL2);
    b.box(M.door, sub(m, 0, 1.1, 0.21), 1.0, 2.2, 0.04);
    archHead(b, M.dark, sub(m, 0, 2.2, 0), 1.0, false, 0.21);
    b.box(M.concrete, sub(m, 0, 0.12, 0.55), 2.0, 0.24, 0.9, [0.62, 0.6, 0.56]);
  }
  // Tower: square, striped, cornices, portal with canopy and lamps, clock, belfry openings, arcaded gallery with four
  // pinnacles, upper stage and the copper pyramid spire.
  const T = 3.4, TF = 7.0, tz = TF - T / 2, TH = 18.6;
  b.box(N.sandstone, F(0, TH / 2, tz), T, TH, T, YEL);
  for (const y of [H, 13.6]) b.box(N.sandstone, F(0, y, tz), T + 0.24, 0.26, T + 0.24, YEL2);
  for (let k = 0; k < 4; k++) {
    const face = sub(F(0, 0, tz), 0, 0, 0, (k * Math.PI) / 2), fm = sub(face, 0, 0, T / 2);
    if (k !== 2) bands(fm, T, k === 0 ? 3.4 : 0.7, TH);
    archWindow(b, sub(fm, 0, 10.4, 0.02), 0.6, 1.9, rng, 0.25, false, { mat: N.sandstone, color: YEL2 });
    b.geo(N.sandstone, cached('mk-clockRim', () => new TorusGeometry(0.62, 0.09, 5, 16)), sub(fm, 0, 12.4, 0.06), YEL2);
    b.geo(M.clock, cached('mk-clock', () => new CircleGeometry(0.56, 18)), sub(fm, 0, 12.4, 0.05));
    for (const dx of [-0.75, 0, 0.75]) archWindow(b, sub(fm, dx, 16.2, 0.02), 0.42, 1.8, rng, 0, false);
  }
  b.box(N.sandstone, F(0, TH + 0.35, tz), T + 0.5, 0.7, T + 0.5, YEL2);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    b.box(N.sandstone, F(x * (T / 2), TH + 1.3, tz + z * (T / 2)), 0.45, 1.2, 0.45, YEL2);
    b.geo(M.corrugated, cached('mk-pinn', () => new ConeGeometry(0.32, 1.9, 4)), F(x * (T / 2), TH + 2.85, tz + z * (T / 2), Math.PI / 4), CU);
  }
  const UH = 2.6;
  b.box(N.sandstone, F(0, TH + 0.7 + UH / 2, tz), 2.3, UH, 2.3, YEL);
  for (let k = 0; k < 4; k++) for (const dx of [-0.45, 0.45]) archWindow(b, sub(F(0, 0, tz, (k * Math.PI) / 2), dx, TH + 1.9, 1.15), 0.32, 1.1, rng, 0, false);
  b.geo(M.corrugated, cached('mk-spire', () => new ConeGeometry(1.75, 9.5, 4)), F(0, TH + 0.7 + UH + 4.75, tz, Math.PI / 4), CU);
  b.box(M.enamel, F(0, TH + UH + 10.6, tz), 0.06, 1.0, 0.06, [1.2, 1, 0.5]);
  // Portal in the tower front: arched door, little canopy, two lamps.
  const pm = F(0, 0, TF);
  b.box(N.sandstone, sub(pm, 0, 1.4, 0.06), 1.9, 2.8, 0.12, YEL2);
  archHead(b, N.sandstone, sub(pm, 0, 2.8, 0), 1.9, false, 0.06, YEL2);
  b.box(M.door, sub(pm, 0, 1.2, 0.13), 1.2, 2.4, 0.04);
  archHead(b, M.dark, sub(pm, 0, 2.4, 0), 1.2, false, 0.13);
  b.box(M.iron, sub(pm, 0, 3.25, 0.55, 0, 0.18), 2.4, 0.08, 1.1, [0.5, 0.5, 0.5]);
  for (const x of [-1.25, 1.25]) b.box(M.lampGlass, sub(pm, x, 2.2, 0.2), 0.22, 0.34, 0.22);
  for (let i = 0; i < 3; i++) b.box(M.concrete, sub(pm, 0, 0.08 + i * 0.16, 0.45 - i * 0.15), 2.6 - i * 0.3, 0.16, 0.9 - i * 0.3, [0.62, 0.6, 0.56]);
  b.light(lp(l, 0, 2.4, 8.4), 0xffbe74, 9, 9, 0.06, 3);
  b.shadowBox(F(0, H / 2 + 0.8, zc), 10, H + 1.6, L);
  b.shadowBox(F(0, (TH + 6) / 2, tz), T, TH + 6, T);
}

// ---------------------------------------------------------------- Staatsbibliothek

function stabi(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = frameOf(l), A = atlas(c);
  const GOLDS: RGB = [1.1, 0.9, 0.55], PALE: RGB = [0.92, 0.86, 0.72], WHITE: RGB = [1.22, 1.22, 1.18];
  // Book magazine: the long closed gold block at the back, stepped at both ends, narrow vertical slits.
  b.box(N.gold, F(-0.5, 9, -3.9), 31, 18, 4.2, GOLDS, 0.125);
  b.box(N.gold, F(-0.5, 18.5, -4.1), 29.5, 1.0, 3.6, GOLDS, 0.125);
  for (const [x, w, h] of [[-17.9, 3.8, 12.5], [16.9, 3.4, 14.5]] as const) b.box(N.gold, F(x, h / 2, -3.6), w, h, 4.8, GOLDS, 0.125);
  for (let x = -14; x <= 13; x += 3) b.box(M.dark, F(x, 13, -1.79), 0.22, 6, 0.04);
  // Reading room: two terraces in front of the magazine, a field of white shed lights on top, a ribbon window.
  for (const [z, d, h] of [[-0.6, 2.4, 9.4], [1.7, 2.2, 8.0]] as const) {
    b.box(N.gold, F(0, h / 2, z), 39.2, h, d, PALE, 0.125);
    for (let x = -18; x <= 18; x += 2.6) b.geo(M.stucco, frustum(2.0, d - 0.6, 0.85, 2.0, 0, ALL_SHED), F(x, h, z), WHITE);
  }
  b.box(M.glass, F(0, 6.1, 2.82), 37, 1.3, 0.06);
  for (let x = -18.5; x <= 18.5; x += 1.6) b.box(N.gold, F(x, 6.1, 2.86), 0.1, 1.3, 0.05, PALE);
  // Foyer: glass band under a gold fascia with the lettering, entrance with a canopy and a cold LED edge.
  const fz = 4.3, fd = 3.0;
  b.box(N.gold, F(0, 3.9, fz), 39.2, 1.0, fd, GOLDS, 0.125);
  b.box(M.concrete, F(0, 0.15, fz), 39.2, 0.3, fd, [0.6, 0.6, 0.58]);
  b.box(N.curtain, F(0, 1.85, fz - 0.2), 39, 3.1, fd - 0.4, [0.9, 1, 1.05], 1 / 12);
  for (let x = -19; x <= 19; x += 1.9) b.box(M.iron, F(x, 1.85, fz + fd / 2 - 0.35), 0.1, 3.1, 0.1, [0.5, 0.48, 0.44]);
  plate(b, A, R.stabi, F(-7, 3.9, fz + fd / 2 + 0.02), 7.2, 0.8);
  const ex = 7;
  b.box(M.concrete, F(ex, 3.2, 6.6), 6, 0.2, 2.4, [0.95, 0.95, 0.97]);
  plate(b, A, R.cold, F(ex, 3.08, 7.81), 5.8, 0.07);
  plate(b, A, R.hall, F(ex, 1.4, 5.43), 3.2, 2.6);
  for (const x of [-0.8, 0.8]) b.box(M.iron, F(ex + x, 1.4, 5.5), 0.08, 2.6, 0.05, [0.4, 0.4, 0.42]);
  b.light(lp(l, ex, 2.4, 7.6), 0x8fb0ff, 9, 10, 0.03, 3.4);
  b.shadowBox(F(-0.5, 9.5, -3.9), 38, 19, 4.4);
  b.shadowBox(F(0, 4.6, 0.5), 39, 9.2, 4.6);
}

// ---------------------------------------------------------------- Neue Nationalgalerie

function nng(c: MCtx, l: Landmark): void {
  const { b, M } = c, F = frameOf(l), A = atlas(c);
  const BLACK: RGB = [0.36, 0.36, 0.4], GRANITE: RGB = [0.8, 0.8, 0.78], T = 0.66;
  // Granite terrace with three full-width steps to the street (inside the collider), slab joints.
  b.box(M.concrete, F(0, T / 2, -0.35), 22, T, 21.3, GRANITE, 0.25);
  b.box(M.concrete, F(0, 0.22, 10.66), 22, 0.44, 0.68, GRANITE, 0.25);
  b.box(M.concrete, F(0, 0.11, 10.83), 22, 0.22, 0.34, GRANITE, 0.25);
  for (let k = -4; k <= 4; k++) {
    b.box(M.tar, F(k * 2.4, T + 0.005, -0.35), 0.05, 0.01, 21.3, [0.5, 0.5, 0.5]);
    b.box(M.tar, F(0, T + 0.005, k * 2.4 - 0.35), 22, 0.01, 0.05, [0.5, 0.5, 0.5]);
  }
  // The glass hall, set far back under the roof: lit curtains behind black mullions (atlas), black base and head.
  const hw = 8.4, y0 = T, y1 = 5.95;
  for (let k = 0; k < 4; k++) {
    const m = F(0, 0, 0, (k * Math.PI) / 2);
    plate(b, A, R.hall, sub(m, 0, (y0 + y1) / 2, hw), hw * 2, y1 - y0);
    b.box(M.iron, sub(m, 0, y0 + 0.08, hw + 0.02), hw * 2 + 0.1, 0.16, 0.08, BLACK);
    b.box(M.iron, sub(m, hw, (y0 + y1) / 2, hw), 0.14, y1 - y0, 0.14, BLACK);
  }
  b.box(M.concrete, F(0, y0 + 0.02, 0), hw * 2, 0.04, hw * 2, [0.9, 0.9, 0.88]);
  // Roof plate: black steel, ribbed fascia, a little rust and standing water on top (2089).
  const rw = 21.6, fy0 = 5.95, fy1 = 7.05;
  b.box(M.iron, F(0, fy1 - 0.1, 0), rw, 0.2, rw, BLACK);
  b.box(M.iron, F(0, fy0 + 0.05, 0), rw - 0.4, 0.1, rw - 0.4, [0.24, 0.24, 0.27]);
  for (let k = 0; k < 4; k++) {
    const m = F(0, 0, 0, (k * Math.PI) / 2);
    b.box(M.iron, sub(m, 0, (fy0 + fy1) / 2, rw / 2 - 0.1), rw, fy1 - fy0, 0.2, BLACK);
    for (let x = -rw / 2 + 1.8; x < rw / 2 - 0.5; x += 1.8) b.box(M.iron, sub(m, x, (fy0 + fy1) / 2, rw / 2 + 0.02), 0.1, fy1 - fy0, 0.1, [0.5, 0.5, 0.55]);
  }
  for (const [x, z, w, d] of [[-4, 3, 3.5, 2.2], [5.5, -6, 2.4, 3], [2, 6.5, 1.6, 1.2]] as const) b.box(M.rust, F(x, fy1 + 0.005, z), w, 0.01, d, [0.7, 0.55, 0.45]);
  // Eight cruciform columns, two per side, pin joint under the fascia.
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
    const m = sub(F(0, 0, 0, (k * Math.PI) / 2), s * 4.9, 0, rw / 2 - 0.35);
    b.box(M.iron, sub(m, 0, (T + fy0) / 2, 0), 0.5, fy0 - T, 0.1, BLACK);
    b.box(M.iron, sub(m, 0, (T + fy0) / 2, 0), 0.1, fy0 - T, 0.5, BLACK);
    b.box(M.iron, sub(m, 0, fy0 - 0.08, 0), 0.24, 0.16, 0.24, [0.6, 0.6, 0.62]);
  }
  // Calder's "Têtes et Queue" on the terrace: black plates on splayed legs.
  const cx = 5, cz = 9.6, ck = F(cx, T, cz, -0.4);
  for (const [x, z] of [[-0.9, 0.3], [0.8, 0.5], [0.1, -0.8]] as const) rod(b, M.iron, (px, py, pz) => sub(ck, px, py, pz), [x, 0, z], [0, 1.4, 0], 0.12, BLACK, 0.04);
  rod(b, M.iron, (px, py, pz) => sub(ck, px, py, pz), [0, 1.3, 0], [-0.3, 3.2, 0.1], 0.32, BLACK, 0.04);
  rod(b, M.iron, (px, py, pz) => sub(ck, px, py, pz), [0, 1.3, 0], [0.45, 2.8, -0.1], 0.28, BLACK, 0.04);
  for (const [x, y, r] of [[-0.32, 3.35, 0.36], [0.5, 2.95, 0.3]] as const) b.geo(M.iron, cached(`mk-calder${r}`, () => new CircleGeometry(r, 10)), sub(ck, x, y, 0.03), BLACK);
  b.light(lp(l, 0, 2.6, 11.6), 0xc8d6ff, 8, 12, 0, 4);
  b.shadowBox(F(0, 6.5, 0), rw, 1.1, rw);
  b.shadowBox(F(0, (T + fy0) / 2, 0), hw * 2, fy0 - T, hw * 2);
}

// ---------------------------------------------------------------- Galeries Lafayette

/** Plan of the store: square with the two front corners rounded (radius r), counter-clockwise seen from above. */
function lafayettePlan(h: number, r: number, seg = 6): V2[] {
  const pts: V2[] = [];
  for (let k = 0; k <= seg; k++) { const a = (k / seg) * (Math.PI / 2); pts.push([h - r + Math.sin(a) * r, h - r + Math.cos(a) * r]); }
  pts.push([h, -h], [-h, -h]);
  for (let k = 0; k <= seg; k++) { const a = -Math.PI / 2 + (k / seg) * (Math.PI / 2); pts.push([-h + r + Math.sin(a) * r, h - r + Math.cos(a) * r]); }
  return pts;
}

function lafayette(c: MCtx, l: Landmark): void {
  const { b, M, N } = c, F = frameOf(l), A = atlas(c), rng = new Rng(1996);
  const GLASS: RGB = [1.05, 1.16, 1.3], STEEL: RGB = [0.34, 0.36, 0.4], SHUT: RGB = [0.62, 0.64, 0.68], H0 = 4.4, H1 = 21.6, H2 = 25.2, R0 = 3.6;
  const outer = lafayettePlan(7, R0), inner = lafayettePlan(6.6, R0 - 0.4), top = lafayettePlan(5.2, R0 - 1.8), roofEdge = lafayettePlan(8.1, R0 + 1.1);
  const front = outer.length - 1; // the closing edge runs along the front between the two arcs
  // Glass body with floor bands (curtain atlas), the curved glass mansard on top, flat roof.
  const glass = cached('mk-laf-glass', () => {
    const g = ring(outer, H0, H1, 1 / 12), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
    return g;
  });
  const mansard = cached('mk-laf-mansard', () => {
    const s = new Soup();
    let acc = 0;
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length, [ax, az] = outer[i]!, [bx, bz] = outer[j]!, [cx, cz] = top[j]!, [dx, dz] = top[i]!, len = Math.hypot(bx - ax, bz - az);
      s.quad([ax, H1, az], [bx, H1, bz], [cx, H2, cz], [dx, H2, dz], [acc / 12, H1 / 12], [(acc + len) / 12, H1 / 12], [(acc + len) / 12, H2 / 12], [acc / 12, H2 / 12]);
      acc += len;
    }
    return s.geo();
  });
  b.geo(N.curtain, glass, F(0, 0, 0), GLASS);
  b.geo(N.curtain, mansard, F(0, 0, 0), [0.8, 0.88, 0.98]);
  b.geo(M.tar, cached('mk-laf-roof', () => cap(top, H2, 0.25)), F(0, 0, 0), [0.45, 0.45, 0.48]);
  // Polished floor bands: the horizontal lines that make the store read from afar.
  const band = cached('mk-laf-band', () => ring(lafayettePlan(7.06, R0 + 0.06), 0, 0.32, 0.5));
  for (let y = H0 + 2.9; y < H1; y += 3.0) b.geo(M.concrete, band, F(0, y, 0), [0.95, 1.0, 1.08]);
  // Dark steel canopy over the ground floor, wrapping the corners (above 2.5 m it may overhang the footprint).
  const canopy = cached('mk-laf-canopy', () => {
    const s = new Soup();
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length, a = roofEdge[i]!, bb = roofEdge[j]!, o0 = outer[i]!, o1 = outer[j]!;
      s.quad([o0[0], H0, o0[1]], [a[0], H0, a[1]], [bb[0], H0, bb[1]], [o1[0], H0, o1[1]], [0, 0], [0, 1], [1, 1], [1, 0]);
      s.quad([a[0], H0 - 0.45, a[1]], [bb[0], H0 - 0.45, bb[1]], [bb[0], H0, bb[1]], [a[0], H0, a[1]], [0, 0], [1, 0], [1, 0.2], [0, 0.2]);
    }
    return s.geo();
  });
  b.geo(M.iron, canopy, F(0, 0, 0), STEEL);
  // Ground floor: rolling shutters all round (2089), the lit entrance on the front with the name above it.
  b.geo(M.corrugated, cached('mk-laf-shut', () => ring(inner, 0, H0, 0.5, [front])), F(0, 0, 0), SHUT);
  const fm = F(0, 0, 6.6), ew = 3.2, side = 6.6 - (R0 - 0.4);
  for (const s of [-1, 1]) b.box(M.corrugated, sub(fm, s * (ew / 2 + (side - ew / 2) / 2), H0 / 2, 0), side - ew / 2, H0, 0.06, SHUT);
  b.geo(M.shop, cached('mk-laf-door', () => new PlaneGeometry(ew, 3.1)), sub(fm, 0, 1.55, -0.85));
  b.box(M.iron, sub(fm, 0, 3.75, -0.45), ew, 1.3, 0.9, STEEL);
  for (const s of [-1, 1]) b.box(M.iron, sub(fm, (s * ew) / 2, H0 / 2, -0.45), 0.14, H0, 0.9, STEEL);
  b.box(M.cobbles, sub(fm, 0, 0.02, -0.45), ew, 0.04, 0.9, [0.7, 0.68, 0.64]);
  plate(b, A, R.amber, sub(fm, 0, 3.08, -0.86), ew - 0.2, 0.06);
  plate(b, A, R.lafayette, sub(fm, 0, H0 - 0.22, 1.52), 4.6, 0.42);
  plate(b, A, R.lafayette, F(8.12, H0 - 0.22, -1, Math.PI / 2), 4.6, 0.42);
  // Store banners hanging from the canopy edge to the fourth floor (front and the south side).
  for (const x of [-4.6, 4.6]) plate(b, A, R.banner, F(x, 9.2, 7.12), 1.15, 5.6);
  for (const z of [-3.2, 2.0]) plate(b, A, R.banner, F(7.12, 9.2, z, Math.PI / 2), 1.15, 5.6);
  // The green wall on the front, overgrown since, with the name across it.
  const gm = F(0.6, 0, 7.04);
  b.box(M.iron, sub(gm, 0, 8.6, -0.02), 5.8, 6.6, 0.08, STEEL);
  b.box(M.mossy, sub(gm, 0, 8.6, 0.06), 5.4, 6.2, 0.1, [0.6, 0.85, 0.5]);
  const leaf = cached('mk-laf-leaf', () => new PlaneGeometry(1, 1).translate(0, -0.5, 0));
  for (let i = 0; i < 16; i++) b.cards.of(M.ivy).add(leaf, sub(gm, rng.range(-2.6, 2.6), rng.range(6.4, 11.6), 0.14, 0, 0, rng.range(-0.2, 0.2)).multiply(new Matrix4().makeScale(rng.range(0.8, 1.4), rng.range(1, 2.4), 1)), [0.75, 1, 0.7]);
  plate(b, A, R.lafayette, sub(gm, 0, 7.6, 0.13), 4.4, 0.95);
  // Graffiti on the shutters.
  for (const [x, z, ry, cell] of [[6.62, 3.4, Math.PI / 2, 0], [6.62, -3.8, Math.PI / 2, 2], [-2.6, 6.64, 0, 1]] as const) b.cards.of(M.graffiti).add(tagGeo(cell), F(x, 1.5, z, ry).multiply(new Matrix4().makeScale(1.9, 0.95, 1)), [0.85, 0.85, 0.85]);
  b.light(lp(l, 0, 2.3, 8.4), 0xffd2a0, 10, 10, 0.05, 3.2);
  b.shadowBox(F(0, H2 / 2, 0), 14, H2, 14);
}

/** A cell of the shared 2 × 2 graffiti atlas (M11c). */
function tagGeo(cell: number): BufferGeometry {
  return cached(`mk-tag${cell}`, () => {
    const g = new PlaneGeometry(1, 1), uv = g.getAttribute('uv'), u0 = (cell % 2) / 2, v0 = 0.5 - Math.floor(cell / 2) / 2;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
    return g;
  });
}

// ---------------------------------------------------------------- Checkpoint Charlie

function checkpoint(c: MCtx, l: Landmark): void {
  const { b, M } = c, F = frameOf(l), A = atlas(c), rng = new Rng(1961);
  const WHITE: RGB = [1.32, 1.42, 1.6], SAND: RGB = [0.92, 0.84, 0.64], POST: RGB = [1.1, 1.08, 1.0];
  // Booth: white boards on a black base, windows on three sides, door, flat roof, the board on top with two lamps.
  const bx = 0.35, bz = -0.4, BW = 2.2, BD = 1.7, BH = 2.35;
  b.box(M.stucco, F(bx, BH / 2 + 0.12, bz), BW, BH - 0.24, BD, WHITE);
  b.box(M.iron, F(bx, 0.12, bz), BW + 0.04, 0.24, BD + 0.04, [0.3, 0.3, 0.3]);
  b.box(M.stucco, F(bx, BH + 0.06, bz), BW + 0.3, 0.12, BD + 0.3, WHITE);
  for (let x = -BW / 2 + 0.2; x < BW / 2; x += 0.2) b.box(M.stucco, F(bx + x, BH / 2 + 0.12, bz + BD / 2 + 0.01), 0.02, BH - 0.24, 0.02, [1.05, 1.12, 1.25]);
  const fm = F(bx, 0, bz + BD / 2);
  b.box(M.door, sub(fm, -0.62, 1.05, 0.03), 0.62, 1.8, 0.04, [1.3, 1.3, 1.25]);
  pane(b, sub(fm, -0.62, 1.55, 0.06), 0.36, 0.6, rng, 1);
  pane(b, sub(fm, 0.38, 1.6, 0.02), 1.1, 0.75, rng, 1, { mat: M.stucco, color: WHITE });
  for (const s of [-1, 1]) pane(b, F(bx + (s * BW) / 2, 1.6, bz, (s * Math.PI) / 2), BD - 0.5, 0.75, rng, 0.6, { mat: M.stucco, color: WHITE });
  // The row of round spotlights under the front window.
  for (let i = 0; i < 4; i++) {
    b.geo(M.lampGlass, cached('mk-spot', () => new CircleGeometry(0.1, 10)), sub(fm, 0.0 + i * 0.26, 0.98, 0.09));
    b.box(M.iron, sub(fm, 0.0 + i * 0.26, 0.98, 0.04), 0.24, 0.24, 0.08, [0.6, 0.55, 0.4]);
  }
  plate(b, A, R.check, F(bx, BH + 0.42, bz + BD / 2 - 0.1), 1.8, 0.45);
  for (const s of [-1, 1]) {
    rod(b, M.iron, F, [bx + s * 0.75, BH + 0.1, bz], [bx + s * 0.95, BH + 0.95, bz + 0.5], 0.05, [0.5, 0.5, 0.5]);
    b.box(M.lampGlass, F(bx + s * 0.95, BH + 0.9, bz + 0.62), 0.2, 0.14, 0.2);
  }
  // Sandbag wall in front, five courses, and two US flags beside it.
  for (let row = 0; row < 5; row++) for (let i = 0; i < 3; i++) for (const z of [0.82, 1.3]) {
    b.box(M.burlap, F(-1.12 + i * 0.47 + (row % 2) * 0.12 + rng.range(-0.03, 0.03), 0.13 + row * 0.25, z + rng.range(-0.03, 0.03), rng.range(-0.06, 0.06)), 0.46, 0.25, 0.46, SAND);
  }
  for (const [x, z] of [[-1.45, 1.42], [-1.45, 0.45]] as const) {
    b.box(M.iron, F(x, 1.5, z), 0.05, 3.0, 0.05, [0.7, 0.7, 0.7]);
    plate(b, A, R.flag, F(x, 2.55, z - 0.36, Math.PI / 2), 0.7, 0.45);
    plate(b, A, R.flag, F(x, 2.55, z - 0.36, -Math.PI / 2), 0.7, 0.45);
  }
  // The sector sign on two posts behind the booth, seen above its roof from the street.
  for (const x of [-1.42, 1.42]) b.box(M.wood, F(x, 2.05, -1.48), 0.12, 4.1, 0.12, POST);
  b.box(M.wood, F(0, 3.55, -1.5), 2.86, 1.06, 0.06, POST);
  plate(b, A, R.sektor, F(0, 3.55, -1.46), 2.7, 0.92);
  // Striped barrier, its boom raised (open), so it stays inside the footprint.
  b.box(M.enamel, F(1.4, 0.5, 1.35), 0.24, 1.0, 0.24, [0.35, 0.35, 0.35]);
  const boom = F(1.4, 1.0, 1.35, 0, 0, Math.PI / 2 + 0.18);
  for (let i = 0; i < 7; i++) b.box(M.enamel, sub(boom, 0.2 + i * 0.4, 0, 0), 0.4, 0.09, 0.09, i % 2 ? [1.3, 1.28, 1.22] : [1.0, 0.22, 0.18]);
  b.light(lp(l, bx, 1.6, 1.5), 0xffd29a, 7, 8, 0.05, 2.6);
  b.shadowBox(F(bx, BH / 2, bz), BW, BH, BD);
}

/** Builds the Tiergarten, Kulturforum and Friedrichstraße landmarks of this file; false for every other kind. */
export function buildKultur(c: MCtx, l: Landmark): boolean {
  switch (l.kind) {
    case 'siegessaeule': siegessaeule(c, l); return true;
    case 'philharmonie': philharmonie(c, l); return true;
    case 'matthaeus': matthaeus(c, l); return true;
    case 'stabi': stabi(c, l); return true;
    case 'nng': nng(c, l); return true;
    case 'lafayette': lafayette(c, l); return true;
    case 'checkpoint': checkpoint(c, l); return true;
    default: return false;
  }
}
