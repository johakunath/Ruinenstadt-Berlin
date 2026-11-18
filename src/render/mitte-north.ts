// M15 Mitte step 4: the north landmarks built from photos (Wikipedia, 2026-11-18; `docs/maps/landmarks.md`):
// Brandenburger Tor, Reichstag, the three Bundestag buildings (`bundesbau` 0 Jakob-Kaiser-Haus, 1 Paul-Löbe-Haus,
// 2 Marie-Elisabeth-Lüders-Haus) and the Kanzleramt. Each builder returns true when it drew the kind;
// `buildMitteLandmark` falls back to the step 2 massing otherwise.
//
// Photo cues (* = below 5 m, what the game camera sees):
// - Tor: fluted Doric columns with bases*, five open passages*, triglyph frieze, stepped attic with the relief,
//   copper-green Quadriga, temple gate houses with pediments and colonnades*. 2089: the Türsteher's club door,
//   "KEIN EINLASS" neon over the middle passage*, holo barrier posts and line*, "GARDEROBE" in the south gate house*.
// - Reichstag: rusticated base with small windows*, west portico on its podium with the wide stair* and six
//   Corinthian columns, "DEM DEUTSCHEN VOLKE", four corner towers, the Foster dome (in 2089 most panes gone:
//   the rib lattice, the mirror cone and a survivor fire inside), flags and red-white barriers*, south portal*.
// - Jakob-Kaiser-Haus: stone-framed blocks and dark teal glass blocks with glass joints, stepped skyline*.
// - Paul-Löbe-Haus: concrete comb with round rotundas*, flat roof slab on thin columns*, glass ends*.
// - Lüders-Haus: big round window* under the cantilevered roof on thin columns*, glass hall, library drum,
//   the outside stair up to the Spree bridge*.
// - Kanzleramt: white cube with the round windows and tall fins, low wings with fins and green winter
//   gardens*, curved wing ends*, Ehrenhof with the rusty Chillida "Berlin"*, flags*, fence and plaque*.
//
// Cost: two new materials, made lazily per `Materials`: the sign atlas (neon words, lettering, frieze, relief,
// plaques) and white fair-faced concrete (Kanzleramt, Paul-Löbe-Haus, Lüders-Haus; the shared stucco is tan,
// enamel rusty). Neon tubes and the dome fire use the shared `N.neon`. Triangles (measured): Tor 5.6k,
// Reichstag 5.1k, Jakob-Kaiser-Haus 0.8k, Paul-Löbe-Haus 1.6k, Lüders-Haus 0.6k, Kanzleramt 1.6k. Two pooled
// light spots per landmark (one on the Bundestag buildings), no animation.
import { CircleGeometry, ConeGeometry, CylinderGeometry, Matrix4, RingGeometry, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material, type Texture } from 'three';
import type { Landmark } from '../data/map';
import { Rng } from '../sim/math';
import { archHead, archWindow, cached, ENDS, frameOf, frustum, pane, SLOPES, sub, type Frame } from './landmarks';
import { lp } from './map-world';
import type { LitMaterial, Materials } from './materials';
import { MC, type MCtx, type MitteMats, type RGB } from './mitte-world';
import { neonCell } from './mitte-paint';
import { canvas, toTexture } from './paint';

// ---------------------------------------------------------------- sign atlas

/** Sign atlas rows (1024 × 1024, 8 rows of 128 px); `cell` splits a row into n cells. */
const ROW = { einlass: 0, small: 1, volke: 2, frieze: 3, relief: 4, plaque: 5 } as const;
const mats = new WeakMap<Materials, { signs: LitMaterial; white: LitMaterial }>();

function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, font: string): void {
  let s = size;
  g.font = font.replace('%', String(s));
  while (g.measureText(text).width > maxW && s > 12) g.font = font.replace('%', String(--s));
  g.fillText(text, x, y);
}

/** `glow` paints the emissive version: neon letters bright, stone black. */
function paintSigns(glow: boolean): Texture {
  const S = 1024, H = 128, rng = new Rng(1791);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const neon = (x: number, y: number, w: number, text: string, col: string): void => {
    g.fillStyle = glow ? '#000' : '#120d16';
    g.fillRect(x, y, w, H);
    g.save();
    g.shadowColor = col;
    g.shadowBlur = glow ? 16 : 6;
    g.strokeStyle = glow ? col : '#3a3040';
    g.lineWidth = 4;
    g.strokeRect(x + 12, y + 14, w - 24, H - 28);
    g.fillStyle = col;
    if (!glow) g.globalAlpha = 0.75;
    fit(g, text, x + w / 2, y + H / 2 + 3, w - 60, 70, 'bold %px "Arial Narrow", Arial, sans-serif');
    g.restore();
  };
  const stone = (y: number, base: string): void => {
    g.fillStyle = glow ? '#000' : base;
    g.fillRect(0, y, S, H);
    if (glow) return;
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${rng.next() < 0.5 ? '255,250,235' : '70,60,45'},${rng.range(0.04, 0.12)})`;
      g.fillRect(rng.range(0, S), y + rng.range(0, H), rng.range(4, 30), rng.range(2, 8));
    }
  };
  neon(0, ROW.einlass * H, S, 'KEIN EINLASS', '#ff4fa3');
  neon(0, ROW.small * H, S / 2, 'GARDEROBE', '#e19142');
  neon(S / 2, ROW.small * H, S / 2, 'SPERRZONE', '#6a8cff');
  // "DEM DEUTSCHEN VOLKE": bronze capitals on the frieze, dimly floodlit at night.
  stone(ROW.volke * H, '#d6c9ac');
  g.fillStyle = glow ? '#2a2014' : '#3e3020';
  fit(g, 'DEM DEUTSCHEN VOLKE', S / 2, ROW.volke * H + H / 2 + 4, S - 80, 84, 'bold %px Georgia, "Times New Roman", serif');
  // Doric frieze: four triglyph + metope units, repeated along u.
  stone(ROW.frieze * H, '#d8cba8');
  if (!glow) for (let k = 0; k < 4; k++) {
    const x = k * 256, y = ROW.frieze * H;
    g.fillStyle = '#c4b590';
    g.fillRect(x, y + 8, 92, H - 16);
    g.fillStyle = 'rgba(60,50,35,0.55)';
    for (const gx of [14, 42, 70]) g.fillRect(x + gx, y + 14, 9, H - 34);
    g.fillStyle = 'rgba(255,248,230,0.35)';
    for (const gx of [24, 52]) g.fillRect(x + gx, y + 14, 6, H - 34);
    // Metope: a round shield in relief.
    g.fillStyle = 'rgba(70,60,40,0.35)';
    g.beginPath(); g.arc(x + 178, y + 68, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e4d8bc';
    g.beginPath(); g.arc(x + 174, y + 63, 32, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(60,50,35,0.4)';
    g.fillRect(x, y, 256, 8);
  }
  // Attic relief: the procession of the goddess of peace (Schadow), figures and horses in low relief.
  stone(ROW.relief * H, '#d2c4a2');
  if (!glow) {
    const y = ROW.relief * H;
    g.strokeStyle = 'rgba(70,58,40,0.6)';
    g.lineWidth = 6;
    g.strokeRect(6, y + 6, S - 12, H - 12);
    const fig = (x: number, w: number, horse: boolean): void => {
      for (const [dx, col] of [[3, 'rgba(70,58,40,0.45)'], [0, '#e6dbc0']] as const) {
        g.fillStyle = col;
        if (horse) {
          g.beginPath(); g.ellipse(x + dx, y + 74 + dx, w / 2, 16, 0, 0, Math.PI * 2); g.fill();
          g.fillRect(x + w / 2 - 12 + dx, y + 40 + dx, 12, 30);
          g.fillRect(x + w / 2 - 20 + dx, y + 34 + dx, 22, 12);
          for (const lx of [-w / 2 + 6, -w / 2 + 16, w / 2 - 20, w / 2 - 10]) g.fillRect(x + lx + dx, y + 84 + dx, 5, 28);
        } else {
          g.beginPath(); g.ellipse(x + dx, y + 30 + dx, 8, 9, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(x - w / 2 + dx, y + 112 + dx); g.lineTo(x - 6 + dx, y + 40 + dx); g.lineTo(x + 6 + dx, y + 40 + dx); g.lineTo(x + w / 2 + dx, y + 112 + dx); g.fill();
        }
      }
    };
    for (let i = 0; i < 6; i++) fig(60 + i * 62, 26, false);
    for (let i = 0; i < 4; i++) fig(470 + i * 56, 70, true);
    fig(700, 30, false);
    for (let i = 0; i < 4; i++) fig(770 + i * 62, 26, false);
  }
  // Plaques: bronze letters on light stone (dim at night).
  for (const [i, text] of ['DEUTSCHER BUNDESTAG', 'BUNDESKANZLERAMT'].entries()) {
    const x = i * 512, y = ROW.plaque * H;
    g.fillStyle = glow ? '#000' : '#cdc8bc';
    g.fillRect(x + 4, y + 4, 504, H - 8);
    g.fillStyle = glow ? '#3a3a36' : '#2c2a26';
    fit(g, text, x + 256, y + H / 2 + 3, 460, 52, 'bold %px Arial, sans-serif');
  }
  return toTexture(c, true, 4);
}

/**
 * White fair-faced concrete of the Band des Bundes (Kanzleramt, Paul-Löbe-Haus, Lüders-Haus): smooth, faint
 * panel joints and tie holes, a few rain streaks. One tile is 2 × 2 m at the 0.5 uv box scale.
 */
function paintWhite(): Texture {
  const S = 256, rng = new Rng(2001);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#e6e4de';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${rng.next() < 0.5 ? '255,255,255' : '120,118,110'},${rng.range(0.03, 0.08)})`;
    g.beginPath(); g.arc(rng.range(0, S), rng.range(0, S), rng.range(10, 50), 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(90,88,80,0.35)';
  g.fillRect(0, 0, S, 2); g.fillRect(0, S / 2, S, 2); g.fillRect(0, 0, 2, S);
  g.fillStyle = 'rgba(80,78,70,0.4)';
  for (const x of [S / 4, (S * 3) / 4]) for (const y of [S / 4, (S * 3) / 4]) { g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 10; i++) {
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, 'rgba(70,70,65,0.12)');
    grd.addColorStop(1, 'rgba(70,70,65,0)');
    g.fillStyle = grd;
    g.fillRect(rng.range(0, S), 0, rng.range(2, 6), rng.range(60, 200));
  }
  return toTexture(c, true, 4);
}

/** The two materials of this file, made once per `Materials`. */
function northMats(N: MitteMats): { signs: LitMaterial; white: LitMaterial } {
  let m = mats.get(N.materials);
  if (!m) {
    m = {
      signs: N.materials.surface({ map: paintSigns(false), emissiveMap: paintSigns(true), emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.6, vertexColors: true }),
      white: N.materials.surface({ map: paintWhite(), roughness: 0.8, vertexColors: true }),
    };
    mats.set(N.materials, m);
  }
  return m;
}

/** UV rect of cell `i` of `n` in atlas row `r`, u stretched by `rep` (the frieze repeats along u). */
function cell(r: number, i = 0, n = 1, rep = 1): [number, number, number, number] {
  return [(i / n) * rep, 1 - (r + 1) / 8 + 0.003, ((i + 1) / n) * rep, 1 - r / 8 - 0.003];
}

// ---------------------------------------------------------------- helpers

interface K extends MCtx {
  l: Landmark;
  F: Frame;
  /** Sign atlas. */
  S: LitMaterial;
  /** White fair-faced concrete. */
  Wc: LitMaterial;
}

/** Box with its bottom at local height y. */
function bx(k: K, mat: Material, x: number, y: number, z: number, w: number, h: number, d: number, t?: RGB, ry = 0): void {
  k.b.box(mat, k.F(x, y + h / 2, z, ry), w, h, d, t);
}

/** A quad centred on `m`, facing its +z. */
function quad(k: K, mat: Material, m: Matrix4, w: number, h: number, uv: readonly [number, number, number, number], t?: RGB): void {
  const p = (x: number, y: number): Vector3 => new Vector3(x, y, 0).applyMatrix4(m);
  k.b.solid.of(mat).quad([p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)], uv, t ? [t] : undefined);
}

/** Curtain glass on `m` with real bays (1.5 m) and floors (3.4 m): one atlas tile is 4 × 4. */
function glass(k: K, m: Matrix4, w: number, h: number, t: RGB, u0 = 0, floor = 3.4): void {
  quad(k, k.N.curtain, m, w, h, [u0, 0, u0 + w / 6, h / (4 * floor)], t);
}

/** A geometry drawn with the solid cell of the shared neon atlas (unlit; tint > 1 blooms). */
function glowGeo(key: string, make: () => BufferGeometry): BufferGeometry {
  return cached(`mn-glow-${key}`, () => {
    const g = make(), [u0, v0, u1, v1] = neonCell(-1), uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + u1) / 2, (v0 + v1) / 2);
    return g;
  });
}

/** Plain neon tube or LED strip, a w × h × d prism. */
function tube(k: K, m: Matrix4, w: number, h: number, d: number, t: RGB): void {
  k.b.geo(k.N.neon, glowGeo('tube', () => new CylinderGeometry(0.5, 0.5, 1, 4, 1)), m.clone().multiply(new Matrix4().makeScale(w, h, d)), t);
}

const cyl = (rt: number, rb: number, h: number, seg: number, open = false): BufferGeometry =>
  cached(`mn-cy${rt.toFixed(3)},${rb.toFixed(3)},${h.toFixed(3)},${seg},${open}`, () => new CylinderGeometry(rt, rb, h, seg, 1, open));

/** Fluted shaft: every other vertex column of a cylinder pulled in. */
function fluted(r0: number, r1: number, h: number, n: number): BufferGeometry {
  return cached(`mn-fl${r0.toFixed(3)},${r1.toFixed(3)},${h.toFixed(3)},${n}`, () => {
    const g = new CylinderGeometry(r1, r0, h, n * 2, 1, true);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) if ((i % (n * 2 + 1)) % 2) p.setXYZ(i, p.getX(i) * 0.87, p.getY(i), p.getZ(i) * 0.87);
    g.computeVertexNormals();
    return g;
  });
}

/** A column on `m` (base centre): plinth, base ring, fluted shaft, Doric echinus or Corinthian bell, abacus. */
function column(k: K, mat: Material, m: Matrix4, r: number, h: number, t: RGB, corinth = false, n = 10): void {
  const b = k.b, cap = corinth ? 1.05 : 0.7, s0 = 0.6, sh = h - s0 - cap;
  b.box(mat, sub(m, 0, 0.17, 0), r * 2.2, 0.34, r * 2.2, t);
  const seg = Math.max(6, n);
  b.geo(mat, cyl(r * 1.14, r * 1.18, 0.26, seg), sub(m, 0, 0.47, 0), t);
  b.geo(mat, fluted(r, r * 0.86, sh, n), sub(m, 0, s0 + sh / 2, 0), t);
  const bell = corinth ? 0.75 : 0.32;
  b.geo(mat, cyl(r * (corinth ? 1.22 : 1.18), r * 0.86, bell, seg), sub(m, 0, s0 + sh + bell / 2, 0), corinth ? [t[0] * 1.08, t[1] * 1.08, t[2] * 1.08] : t);
  b.box(mat, sub(m, 0, h - (cap - bell) / 2, 0), r * 2.5, cap - bell, r * 2.5, t);
}

const COPPER: RGB = [0.17, 0.31, 0.25];
/** Faded black, red, gold. */
const FLAG: readonly RGB[] = [[0.06, 0.06, 0.06], [0.55, 0.07, 0.05], [0.8, 0.6, 0.1]];
const DARK: RGB = [0.3, 0.27, 0.23];

// ---------------------------------------------------------------- Brandenburger Tor

/** Pier centres of `OPEN_PARTS.tor` (walls 2.6 × 9 m); gate houses at ±22.5 (8 × 9 m). */
const TOR_WALLS = [-16.925, -10.525, -4.125, 4.125, 10.525, 16.925];

function horse(k: K, m: Matrix4, t: RGB, rear: number): void {
  const b = k.b, M = k.M;
  b.geo(M.enamel, cached('mn-horse', () => new SphereGeometry(1, 8, 6)), sub(m, 0, 1.45, 0).multiply(new Matrix4().makeScale(0.36, 0.42, 0.95)), t);
  b.box(M.enamel, sub(m, 0, 1.95, 0.72, 0, 0.65), 0.28, 0.95, 0.42, t);
  b.box(M.enamel, sub(m, 0, 2.35, 1.2, 0, 2.1), 0.24, 0.62, 0.3, t);
  b.box(M.enamel, sub(m, 0, 1.3, -1.0, 0, 0.45), 0.12, 0.7, 0.12, t);
  for (const x of [-0.16, 0.16]) {
    b.box(M.enamel, sub(m, x, 0.55, -0.55), 0.14, 1.1, 0.16, t);
    // Forelegs swing forward from the shoulder (lifted more on the outer horses).
    const a = rear * (x < 0 ? 1.1 : 0.6);
    b.box(M.enamel, sub(m, x, 1.25 - 0.55 * Math.cos(a), 0.62 + 0.55 * Math.sin(a), 0, -a), 0.14, 1.1, 0.16, t);
  }
}

/** The Quadriga (Schadow 1793, copper): four horses abreast, chariot, Victoria with the staff, wreath and eagle. */
function quadriga(k: K, m: Matrix4): void {
  const b = k.b, M = k.M, t = COPPER;
  [-1.95, -0.65, 0.65, 1.95].forEach((x, i) => horse(k, sub(m, x, 0, 0.5, (x / 1.95) * 0.1), t, i === 0 || i === 3 ? 1 : 0.6));
  b.box(M.enamel, sub(m, 0, 0.95, -1.1), 1.6, 1.0, 1.1, t);
  for (const x of [-0.86, 0.86]) b.geo(M.enamel, cyl(0.58, 0.58, 0.12, 10), sub(m, x, 0.6, -1.25, 0, 0, Math.PI / 2), t);
  // Victoria: robe, torso, head, spread wings, the staff with the oak wreath, iron cross and eagle.
  const v = sub(m, 0, 1.2, -1.15);
  b.geo(M.enamel, cyl(0.26, 0.4, 1.6, 8), sub(v, 0, 0.8, 0), t);
  b.box(M.enamel, sub(v, 0, 1.85, 0), 0.5, 0.55, 0.3, t);
  b.geo(M.enamel, cached('mn-head', () => new SphereGeometry(0.17, 6, 4)), sub(v, 0, 2.3, 0.02), t);
  for (const s of [-1, 1]) b.box(M.enamel, sub(v, s * 0.42, 2.45, -0.2, 0, -0.35, s * -0.45), 0.08, 1.4, 0.55, t);
  b.box(M.enamel, sub(v, 0.42, 2.6, 0.25, 0, 0.08), 0.07, 2.6, 0.07, t);
  b.geo(M.enamel, cached('mn-wreath', () => new TorusGeometry(0.33, 0.06, 4, 10)), sub(v, 0.42, 3.75, 0.36), t);
  b.box(M.enamel, sub(v, 0.42, 3.75, 0.36), 0.12, 0.5, 0.05, t);
  b.box(M.enamel, sub(v, 0.42, 3.75, 0.36), 0.5, 0.12, 0.05, t);
  b.box(M.enamel, sub(v, 0.42, 4.25, 0.38), 0.22, 0.32, 0.2, t);
  b.box(M.enamel, sub(v, 0.42, 4.35, 0.38), 0.8, 0.14, 0.05, t);
}

/** A gate house (Torhaus): small Doric temple, pediments east and west, colonnade on the outer side. */
function gatehouse(k: K, s: number): void {
  const { b, M, N, F } = k, ST = MC.tor, SH: RGB = [0.8, 0.73, 0.57], cx = s * 22.5, CH = 5.6;
  bx(k, N.sandstone, cx, 0, 0, 8, 0.4, 9, SH);
  bx(k, N.sandstone, s * 22.2, 0.4, 0, 6.2, CH, 6.6, ST);
  const cols: Array<[number, number]> = [];
  for (const z of [-3.95, 3.95]) for (const x of [19.15, 21.4, 23.65, 25.9]) cols.push([s * x, z]);
  for (const z of [-1.32, 1.32]) cols.push([s * 25.9, z]);
  for (const [x, z] of cols) column(k, N.sandstone, F(x, 0.4, z), 0.36, CH, ST, false, 6);
  bx(k, N.sandstone, cx, 0.4 + CH, 0, 8, 0.95, 8.9, ST);
  bx(k, N.sandstone, cx, 1.35 + CH, 0, 8.4, 0.25, 9.4, SH);
  const roof = F(cx, 1.6 + CH, 0, Math.PI / 2);
  b.geo(M.enamel, frustum(9.4, 8.4, 1.5, 9.4, 0, SLOPES), roof, COPPER);
  b.geo(N.sandstone, frustum(9.4, 8.4, 1.5, 9.4, 0, ENDS), roof, ST);
  b.shadowBox(F(cx, 3.6, 0), 8, 7.2, 9);
  // Fronts: a window east and west; the outer side has the door (south house: the Türsteher's coat check).
  const rng = new Rng(1788 + s);
  for (const z of [-1, 1]) pane(b, F(s * 22.2, 3.0, z * 3.31, z < 0 ? Math.PI : 0), 1.0, 1.9, rng, 0.5);
  const door = F(s * 25.31, 0.4, 0, (s * Math.PI) / 2);
  b.box(M.dark, sub(door, 0, 1.3, 0.02), 1.3, 2.6, 0.04);
  b.box(N.sandstone, sub(door, 0, 2.75, 0.05), 1.7, 0.3, 0.1, SH);
  if (s < 0) {
    b.solid.excludeOccluder(() => {
      quad(k, k.S, sub(door, 0, 3.55, 0.12), 1.8, 0.45, cell(ROW.small, 0, 2));
      for (const x of [-0.78, 0.78]) {
        b.box(M.iron, sub(door, x, 2.35, 0.12), 0.08, 0.08, 0.24, [0.4, 0.4, 0.4]);
        b.box(M.lampGlass, sub(door, x, 2.15, 0.22), 0.18, 0.32, 0.18);
      }
    });
    b.light(lp(k.l, -26.9, 2.6, 0), 0xe19142, 9, 8, 0.12, 2.6);
  }
}

function tor(k: K): void {
  const { b, M, N, F, l } = k, ST = MC.tor, SH: RGB = [0.8, 0.73, 0.57], DK: RGB = [0.64, 0.57, 0.44];
  const CH = 12.6, AY = CH + 3.35;
  // Piers: a wall between front and back column; the five passages stay open (`OPEN_PARTS.tor`).
  for (const x of TOR_WALLS) {
    const outer = Math.abs(x) > 16, w = outer ? 2.6 : 1.3;
    bx(k, N.sandstone, x, 0, 0, w, CH, 7.1, ST);
    bx(k, N.sandstone, x, 0, 0, w + (outer ? 0 : 0.3), 0.55, 7.3, DK);
    // Sunken relief panels on the passage sides (the Hercules reliefs).
    for (const s of [-1, 1]) if (!outer || s === -Math.sign(x)) bx(k, N.sandstone, x + s * (w / 2 + 0.02), 3.2, 0, 0.05, 4.6, 4.4, SH);
    for (const z of [-3.55, 3.55]) column(k, N.sandstone, F(x, 0, z), 0.82, CH, ST);
    b.shadowBox(F(x, CH / 2, 0), w, CH, 8.8);
  }
  // Entablature: architrave, triglyph frieze (atlas, repeats along u), cornice.
  bx(k, N.sandstone, 0, CH, 0, 37.2, 1.3, 9.0, ST);
  bx(k, N.sandstone, 0, CH + 1.3, 0, 37.0, 1.35, 8.8, ST);
  for (const s of [-1, 1]) {
    quad(k, k.S, F(0, CH + 1.975, s * 4.41, s < 0 ? Math.PI : 0), 37.0, 1.35, cell(ROW.frieze, 0, 1, 5), ST);
    quad(k, k.S, F(s * 18.51, CH + 1.975, 0, (s * Math.PI) / 2), 8.8, 1.35, cell(ROW.frieze, 0, 1, 1.19), ST);
  }
  bx(k, N.sandstone, 0, CH + 2.65, 0, 38.0, 0.25, 9.6, ST);
  bx(k, N.sandstone, 0, CH + 2.9, 0, 38.4, 0.45, 9.9, SH);
  // Attic: a block with stepped sides rising to the raised middle with the relief, the Quadriga on top.
  bx(k, N.sandstone, 0, AY, 0, 36.0, 2.4, 8.2, ST);
  bx(k, N.sandstone, 0, AY + 2.4, 0, 36.4, 0.25, 8.5, SH);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const len = 11.6 - i * 3.4;
    bx(k, N.sandstone, s * (6.2 + len / 2), AY + 2.65 + i * 0.36, 0, len, 0.36, 7.4 - i * 1.3, ST);
  }
  bx(k, N.sandstone, 0, AY, 0, 12.4, 3.5, 8.8, ST);
  bx(k, N.sandstone, 0, AY + 3.5, 0, 12.8, 0.3, 9.1, SH);
  for (const s of [-1, 1]) quad(k, k.S, F(0, AY + 1.75, s * 4.41, s < 0 ? Math.PI : 0), 11.2, 1.4, cell(ROW.relief), ST);
  bx(k, N.sandstone, 0, AY + 3.8, 0, 5.6, 0.8, 4.4, SH);
  quadriga(k, F(0, AY + 4.6, 0));
  b.shadowBox(F(0, CH + 3.9, 0), 37, 7.8, 9);
  for (const s of [-1, 1]) gatehouse(k, s);
  // 2089: the Tor is the Türsteher's club door. "KEIN EINLASS" hangs over the middle passage (east), turned a
  // little to the south for the camera; holo barrier posts at the passage corners and a broken holo line.
  b.solid.excludeOccluder(() => {
    const sg = F(0, 4.75, 4.0, -0.35);
    b.box(M.iron, sub(sg, 0, 0, -0.07), 4.5, 0.66, 0.08, [0.25, 0.25, 0.28]);
    quad(k, k.S, sg, 4.4, 0.55, cell(ROW.einlass));
    for (const x of [-1.9, 1.9]) b.box(M.iron, sub(sg, x, 4.2, -0.07), 0.04, 7.8, 0.04, [0.2, 0.2, 0.2]);
    for (const x of [-3.0, 3.0]) for (const z of [-4.35, 4.35]) {
      b.geo(M.iron, cyl(0.07, 0.09, 1.15, 6), F(x, 0.575, z), [0.3, 0.32, 0.36]);
      tube(k, F(x, 1.2, z), 0.13, 0.12, 0.13, [0.6, 2.2, 2.1]);
    }
    for (let i = 0; i < 6; i++) if (i !== 3) tube(k, F(-2.5 + i, 0.02, 4.35), 0.7, 0.03, 0.06, [0.5, 1.9, 1.8]);
  });
  b.light(lp(l, 0, 4.2, 5.6), 0xff4fa3, 10, 9, 0.15, 3.4);
}

// ---------------------------------------------------------------- Reichstag

/** One window bay of the Reichstag on frame `m` (face point at the ground, z out). */
function rtBay(k: K, m: Matrix4, rng: Rng, upper: number): void {
  const b = k.b, N = k.N, RL: RGB = [0.84, 0.8, 0.71];
  pane(b, sub(m, 0, 2.0, 0.02), 0.9, 1.2, rng, 0.08);
  b.box(N.sandstone, sub(m, 0, 6.9, 0.05), 1.75, 4.6, 0.1, RL);
  archWindow(b, sub(m, 0, 6.5, 0.1), 1.2, 3.0, rng, 0.12, false);
  b.box(N.sandstone, sub(m, 0, 9.45, 0.18), 1.9, 0.22, 0.25, RL);
  pane(b, sub(m, 0, upper, 0.02), 1.1, 1.5, rng, 0.08);
}

function reichstag(k: K): void {
  const { b, M, N, F, l } = k, rng = new Rng(1894);
  const RT: RGB = [0.74, 0.7, 0.62], RB: RGB = [0.6, 0.56, 0.49], RL: RGB = [0.84, 0.8, 0.71];
  const G = 4, C = 13.6, TT = 19.4, FZ = 7.5, BZ = -14.2, cz = (FZ + BZ) / 2, D = FZ - BZ;
  // Body: rusticated ground floor, two main floors, cornice, balustrade, flat roof.
  bx(k, N.sandstone, 0, 0, cz, 38.4, C, D, RT);
  bx(k, N.sandstone, 0, 0, cz, 38.6, G, D + 0.2, RB);
  bx(k, N.sandstone, 0, C, cz, 39.0, 0.55, D + 0.6, RL);
  bx(k, M.slate, 0, C + 0.55, cz, 38.0, 0.1, D - 0.4, [0.62, 0.68, 0.7]);
  // Four inner courtyards around the plenary hall, seen from above as dark wells.
  for (const x of [-9.5, 9.5]) for (const z of [cz - 5.2, cz + 5.2]) bx(k, M.tar, x, C + 0.6, z, 6.5, 0.06, 4.6, [0.35, 0.35, 0.35]);
  for (const z of [FZ - 0.2, BZ + 0.2]) bx(k, N.sandstone, 0, C + 0.55, z, 38.4, 0.9, 0.4, RL);
  for (const x of [-19.0, 19.0]) bx(k, N.sandstone, x, C + 0.55, cz, 0.4, 0.9, D, RL);
  b.shadowBox(F(0, C / 2, cz), 38.4, C, D);
  // Corner towers with giant pilasters, an arcaded top storey and corner pinnacles.
  for (const sx of [-1, 1]) for (const tz of [6, -11.5]) {
    const x = sx * 16.45;
    bx(k, N.sandstone, x, 0, tz, 6.9, TT, 6.9, RT);
    bx(k, N.sandstone, sx * 16.5, 0, tz, 7.0, G, 7.0, RB);
    bx(k, N.sandstone, x, C, tz, 7.4, 0.55, 7.4, RL);
    bx(k, N.sandstone, x, TT, tz, 7.5, 0.5, 7.5, RL);
    bx(k, N.sandstone, x, TT + 0.5, tz, 5.8, 1.3, 5.8, RT);
    for (const px of [-2.95, 2.95]) for (const pz of [-2.95, 2.95]) {
      bx(k, N.sandstone, x + px, G, tz + pz, 0.8, C - G, 0.8, RL);
      bx(k, N.sandstone, x + px, TT + 0.5, tz + pz, 0.7, 1.9, 0.7, RT);
    }
    b.shadowBox(F(x, TT / 2, tz), 6.9, TT, 6.9);
  }
  // Windows on the faces the route sees: the west front and the south end (local +x).
  for (const sx of [-1, 1]) {
    for (const x of [9.25, 11.75]) rtBay(k, F(sx * x, 0, FZ + 0.05), rng, 11.4);
    for (const x of [14.75, 18.25]) {
      rtBay(k, F(sx * x, 0, 9.5), rng, 11.4);
      archWindow(b, F(sx * x, TT - 2.6, 9.48), 1.0, 2.0, rng, 0.1, false);
    }
  }
  for (const tz of [6, -11.5]) for (const z of [tz - 1.75, tz + 1.75]) {
    rtBay(k, F(20, 0, z, Math.PI / 2), rng, 11.4);
    archWindow(b, F(19.98, TT - 2.6, z, Math.PI / 2), 1.0, 2.0, rng, 0.1, false);
  }
  // Rustication joints on the visible ground floors.
  for (let i = 1; i < 7; i++) {
    const y = i * 0.56;
    for (const sx of [-1, 1]) quad(k, N.sandstone, F(sx * 16.5, y, 9.52), 7.0, 0.07, [0, 0, 1, 0.02], DARK);
    quad(k, N.sandstone, F(20.02, y, 6, Math.PI / 2), 7.0, 0.07, [0, 0, 1, 0.02], DARK);
    quad(k, N.sandstone, F(20.02, y, -11.5, Math.PI / 2), 7.0, 0.07, [0, 0, 1, 0.02], DARK);
  }
  // South portal: risalit with four engaged columns, an attic with a relief band, the door, the 2089 Sperrzone.
  const pz = -2.75;
  bx(k, N.sandstone, 19.35, 0, pz, 0.3, C + 0.55, 7.0, RT);
  bx(k, N.sandstone, 19.6, 0, pz, 0.8, G, 7.4, RB);
  for (const z of [-3.0, -1.25, 1.25, 3.0]) column(k, N.sandstone, F(19.6, G, pz + z), 0.38, C - G - 0.3, RT, true, 8);
  bx(k, N.sandstone, 19.55, C - 0.3, pz, 0.9, 0.85, 7.6, RL);
  bx(k, N.sandstone, 19.55, C + 0.55, pz, 0.8, 2.1, 7.4, RT);
  quad(k, k.S, F(19.96, C + 1.6, pz, Math.PI / 2), 6.4, 0.8, cell(ROW.relief), RT);
  const door = F(20.0, 0, pz, Math.PI / 2);
  b.box(N.sandstone, sub(door, 0, 1.6, 0.02), 2.4, 3.2, 0.04, RL);
  b.box(M.dark, sub(door, 0, 1.45, 0.05), 1.8, 2.9, 0.04);
  archHead(b, M.dark, sub(door, 0, 2.9, 0), 1.8, false, 0.07);
  b.solid.excludeOccluder(() => quad(k, k.S, sub(door, 0, 4.45, 0.08), 1.6, 0.4, cell(ROW.small, 1, 2)));
  b.light(lp(l, 21.2, 3.2, pz), 0xcfe0ff, 9, 9, 0.05, 3);
  // West portico: podium, the wide stair, six Corinthian columns, glass entrance, lettering, pediment.
  bx(k, N.sandstone, 0, 0, 9.35, 16, 3.3, 3.7, RB);
  for (let i = 0; i < 11; i++) bx(k, N.sandstone, 0, 0, 11.2 + (i + 0.5) * 0.31, 14, 3.3 * (11 - i) / 11, 0.31, i % 2 ? RL : RT);
  glass(k, F(0, 7.45, 7.56), 11.5, 8.3, [0.95, 1, 1.05], 0.3);
  for (const x of [-6.5, -3.9, -1.3, 1.3, 3.9, 6.5]) column(k, N.sandstone, F(x, 3.3, 10.4), 0.55, 8.3, RT, true, 10);
  bx(k, N.sandstone, 0, 11.6, 9.45, 16.4, 1.7, 3.9, RT);
  bx(k, N.sandstone, 0, 13.3, 9.5, 16.9, 0.35, 4.2, RL);
  quad(k, k.S, F(0, 12.45, 11.41), 8.0, 1.0, cell(ROW.volke), [1, 1, 1]);
  const ped = F(0, 13.65, 9.5, Math.PI / 2);
  b.geo(N.sandstone, frustum(4.2, 16.9, 2.8, 4.2, 0, ENDS), ped, RT);
  b.geo(M.slate, frustum(4.4, 17.2, 2.85, 4.4, 0, SLOPES), ped, [0.75, 0.8, 0.8]);
  // Front terrace walls, red-white barriers across the stair foot, two flags (faded).
  for (const sx of [-1, 1]) bx(k, N.sandstone, sx * 13.6, 0, 14.65, 12.8, 0.75, 0.6, RB);
  b.solid.excludeOccluder(() => {
    for (let i = 0; i < 6; i++) {
      const m = F(-6.0 + i * 2.4, 0, 14.82, (i % 2 ? 0.04 : -0.04));
      b.box(M.enamel, sub(m, 0, 0.6, 0), 2.2, 0.9, 0.04, [0.95, 0.95, 0.92]);
      for (const y of [0.4, 0.8]) b.box(M.enamel, sub(m, 0, y, 0.01), 2.2, 0.14, 0.05, [0.85, 0.12, 0.1]);
      b.box(M.iron, sub(m, 0, 0.04, 0), 2.0, 0.08, 0.3, [0.35, 0.35, 0.35]);
    }
    for (const sx of [-1, 1]) {
      const x = sx * 10.5;
      b.geo(M.iron, cyl(0.07, 0.1, 10, 6), F(x, 5, 12.4), [0.7, 0.72, 0.74]);
      FLAG.forEach((t, j) => b.box(M.linen, F(x - 1.1 * sx, 9.5 - j * 0.42, 12.4, 0, 0, sx * 0.08), 2.2, 0.42, 0.04, t));
    }
  });
  // The dome (Foster): drum, rib lattice with only a few panes left, the mirror cone and a survivor fire inside.
  const y0 = C + 0.65, R = 6.9, dz = cz;
  b.geo(N.sandstone, cyl(7.3, 7.3, 1.3, 20), F(0, y0 + 0.65, dz), RL);
  const yd = y0 + 1.3, st: RGB = [0.62, 0.66, 0.7];
  for (let i = 0; i < 12; i++) b.geo(M.iron, cached('mn-rib', () => new TorusGeometry(R, 0.08, 3, 8, Math.PI / 2)), F(0, yd, dz, (i * Math.PI) / 6), st);
  for (const a of [0.3, 0.62, 0.95, 1.25]) b.geo(M.iron, cached(`mn-ring${a}`, () => new TorusGeometry(R * Math.cos(a), 0.08, 3, 24)), F(0, yd + R * Math.sin(a), dz, 0, Math.PI / 2), st);
  b.geo(M.iron, cached('mn-crown', () => new TorusGeometry(0.9, 0.2, 4, 12)), F(0, yd + R - 0.06, dz, 0, Math.PI / 2), st);
  for (const [phi, th] of [[0.2, 0.9], [1.4, 1.15], [2.1, 0.55], [3.0, 1.2], [3.7, 0.8], [4.6, 1.2], [5.3, 0.5], [5.9, 1.05]] as const) {
    b.geo(N.curtain, cached(`mn-pane${phi}`, () => new SphereGeometry(R - 0.04, 3, 2, phi, 0.5, th, 0.32)), F(0, yd, dz), [0.85, 0.95, 1.05]);
  }
  b.geo(M.enamel, cyl(2.7, 0.45, 5.6, 12), F(0, yd + 2.8, dz), [0.82, 0.88, 0.95]);
  b.geo(M.rust, cyl(0.5, 0.38, 0.55, 8), F(2.9, yd + 0.27, dz + 1.4), [0.6, 0.45, 0.35]);
  b.geo(N.neon, glowGeo('flame', () => new ConeGeometry(0.34, 1.0, 6)), F(2.9, yd + 1.0, dz + 1.4), [2.6, 1.1, 0.3]);
  b.geo(N.neon, glowGeo('pool', () => new CircleGeometry(1.8, 12)), F(2.9, yd + 0.02, dz + 1.4, 0, -Math.PI / 2), [0.7, 0.28, 0.07]);
  b.light(lp(l, 2.9, yd + 1.6, dz + 1.4), 0xff9a4a, 14, 13, 0.6, 2);
  b.shadowBox(F(0, yd + R / 2, dz), R * 1.6, R, R * 1.6);
}

// ---------------------------------------------------------------- Bundestag buildings

const STONE: RGB = [0.8, 0.78, 0.74];
/** Light fair-faced concrete on the stucco base. */
const CONC: RGB = [0.9, 0.9, 0.88];

/** Jakob-Kaiser-Haus: stone-framed blocks and dark teal glass blocks with glass joints, a stepped skyline. */
function jkh(k: K): void {
  const { b, M, N, F, l } = k, BZ = -6, GL: RGB = [0.9, 1.0, 1.0];
  const blocks: Array<{ x0: number; x1: number; z: number; h: number; kind: 'stone' | 'teal' | 'joint' }> = [
    { x0: -22, x1: -12.5, z: 6, h: 15.5, kind: 'stone' }, { x0: -12.5, x1: -11, z: 4.8, h: 14, kind: 'joint' },
    { x0: -11, x1: -1.5, z: 5.4, h: 13.4, kind: 'teal' }, { x0: -1.5, x1: 0, z: 4.8, h: 14.5, kind: 'joint' },
    { x0: 0, x1: 10, z: 6, h: 16.6, kind: 'stone' }, { x0: 10, x1: 11.5, z: 4.8, h: 14, kind: 'joint' },
    { x0: 11.5, x1: 22, z: 5.6, h: 14.4, kind: 'teal' },
  ];
  for (const q of blocks) {
    const w = q.x1 - q.x0, cx = (q.x0 + q.x1) / 2, f = q.z - 0.6, d = f - BZ;
    // Body from the back to the facade plane `f`; facade parts stand in front of it up to `q.z`.
    bx(k, q.kind === 'stone' ? N.sandstone : M.concrete, cx, 0, (f + BZ) / 2, w, q.h, d, q.kind === 'stone' ? STONE : [0.45, 0.48, 0.48]);
    b.shadowBox(F(cx, q.h / 2, (q.z + BZ) / 2), w, q.h, q.z - BZ);
    if (q.kind === 'joint') {
      glass(k, F(cx, q.h / 2, f + 0.01), w, q.h, [1.0, 1.12, 1.15], cx * 0.17);
      continue;
    }
    const side = q.x0 === -22 ? -1 : q.x1 === 22 ? 1 : 0;
    if (q.kind === 'teal') {
      glass(k, F(cx, 4 + (q.h - 4) / 2, f + 0.01), w, q.h - 4, [0.5, 0.95, 0.88], cx * 0.13);
      if (side) glass(k, F(side * 22.01, q.h / 2, (f + BZ) / 2, (side * Math.PI) / 2), d, q.h, [0.48, 0.9, 0.84], 0.5);
      // Thin stone frame and roof edge.
      bx(k, N.sandstone, cx, q.h - 0.5, f + 0.25, w, 0.5, 0.5, STONE);
      for (const x of [q.x0 + 0.2, q.x1 - 0.2]) bx(k, N.sandstone, x, 4, f + 0.25, 0.4, q.h - 4.5, 0.5, STONE);
    } else {
      // Stone grid: floor slabs with rails and piers in front of the recessed glass.
      glass(k, F(cx, 4 + (q.h - 4) / 2, f + 0.01), w, q.h - 4, [0.72, 0.84, 0.84], cx * 0.11);
      for (let y = 4; y < q.h - 1; y += 3.3) bx(k, N.sandstone, cx, y, f + 0.3, w, 0.42, 0.6, STONE);
      bx(k, N.sandstone, cx, q.h - 0.8, f + 0.3, w, 0.8, 0.6, STONE);
      const n = Math.round(w / 3.2);
      for (let i = 0; i <= n; i++) bx(k, N.sandstone, q.x0 + 0.25 + (i * (w - 0.5)) / n, 4, f + 0.3, 0.5, q.h - 4.8, 0.6, STONE);
      for (let y = 7.3; y < q.h - 1; y += 3.3) bx(k, M.iron, cx, y + 0.42, q.z - 0.06, w - 0.4, 0.9, 0.04, [0.3, 0.32, 0.33]);
      if (side) for (let i = 0; i < 4; i++) glass(k, F(side * 22.01, 4 + (q.h - 4) / 2, BZ + 1.5 + i * 2.6, (side * Math.PI) / 2), 1.6, q.h - 5, [0.72, 0.84, 0.84], i * 0.3);
    }
    // Ground floor: stone piers in front of the glass lobby, a stone band over it.
    glass(k, F(cx, 1.8, f + 0.02), w, 3.6, GL, cx * 0.07, 2.8);
    const n = Math.max(2, Math.round(w / 3));
    for (let i = 0; i <= n; i++) bx(k, N.sandstone, q.x0 + 0.3 + (i * (w - 0.6)) / n, 0, f + 0.3, 0.6, 4, 0.6, STONE);
    bx(k, N.sandstone, cx, 3.6, f + 0.3, w, 0.5, 0.6, STONE);
    // Rooftop plant.
    bx(k, M.iron, cx + w * 0.15, q.h, -2, Math.min(4, w * 0.35), 1.3, 2.2, [0.4, 0.42, 0.42]);
  }
  // Entrance in the middle stone block: canopy, plaque, cold light.
  bx(k, M.concrete, 5, 3.4, 6.4, 5, 0.25, 1.2, [0.7, 0.7, 0.7]);
  b.solid.excludeOccluder(() => quad(k, k.S, F(1.25, 2.3, 6.01), 1.6, 0.4, cell(ROW.plaque, 0, 2)));
  b.light(lp(l, 5, 3.0, 7.4), 0xcfe4ff, 8, 8, 0.05, 3);
}

/** Paul-Löbe-Haus: concrete comb with rotundas in the courts, glass end halls, roof slab on thin columns. */
function plh(k: K): void {
  const { b, M, N, F, l } = k, H = 15;
  bx(k, k.Wc, 0, 0, -2, 32.8, H, 5, CONC);
  glass(k, F(0, H / 2 + 0.5, 0.51), 32.8, H - 1, [0.8, 0.9, 0.95], 0.2);
  b.shadowBox(F(0, H / 2, 0), 37.6, H, 9);
  // Comb fingers and the rotundas (committee halls) in the courts between them; ground floors glazed.
  for (const x of [-15.5, -7.75, 0, 7.75, 15.5]) {
    bx(k, k.Wc, x, 0, 2.5, 1.8, H, 4.0, CONC);
    for (let y = 3.6; y < H; y += 3.6) bx(k, k.Wc, x, y, 2.5, 2.0, 0.3, 4.1, [1.0, 1.0, 0.98]);
  }
  for (const x of [-11.6, -3.9, 3.9, 11.6]) {
    b.geo(N.curtain, cyl(1.75, 1.75, 3.2, 16), F(x, 1.6, 2.4), [1.1, 1.05, 0.9]);
    b.geo(k.Wc, cyl(1.8, 1.8, 6.0, 16), F(x, 6.2, 2.4), CONC);
    b.geo(N.curtain, cyl(1.83, 1.83, 3.0, 16), F(x, 10.7, 2.4), [0.9, 1.0, 1.05]);
    b.geo(k.Wc, cyl(1.85, 1.85, 1.6, 16), F(x, 13.0, 2.4), CONC);
    bx(k, M.concrete, x, 0, 2.5, 5.9, 0.05, 4.0, [0.55, 0.55, 0.55]);
  }
  // Glass end halls (west: the big atrium front) behind thin columns under the cantilevered roof slab.
  for (const s of [-1, 1]) {
    bx(k, k.Wc, s * 17.6, 0, 0, 2.4, H, 9, [0.5, 0.52, 0.52]);
    glass(k, F(s * 18.81, H / 2, 0, (s * Math.PI) / 2), 9, H, [1.25, 1.15, 0.9], 0.4, 3.0);
    glass(k, F(s * 17.6, H / 2, 4.51), 2.4, H, [1.2, 1.12, 0.9], 0.1, 3.0);
    for (const z of [-4.1, 4.1]) b.geo(k.Wc, cyl(0.22, 0.22, H, 8), F(s * 19.65, H / 2, z), CONC);
  }
  // The coloured diamonds in the west atrium glass.
  b.solid.excludeOccluder(() => {
    for (const [z, y, t] of [[-2.2, 9.5, [0.4, 0.6, 1.6]], [1.8, 7.0, [1.6, 0.3, 0.3]], [3.0, 11.0, [0.4, 1.4, 0.5]]] as const) quad(k, M.enamel, F(-18.85, y, z, -Math.PI / 2, 0, Math.PI / 4), 1.3, 1.3, [0, 0, 1, 1], t as RGB);
  });
  bx(k, k.Wc, 0, H, 0, 43.4, 0.7, 9.4, CONC);
  for (const x of [-9, 9]) bx(k, M.iron, x, H + 0.7, -1.5, 4, 1.0, 2.5, [0.45, 0.47, 0.47]);
  b.light(lp(l, -20.5, 3.0, 0), 0xcfe4ff, 8, 8, 0.05, 3);
}

/** Marie-Elisabeth-Lüders-Haus: round window under the cantilevered roof, glass hall, library drum, outside stair. */
function melh(k: K): void {
  const { b, M, N, F, l } = k, H = 12, rng = new Rng(2003);
  // West: concrete wall with the big round window, the roof slab cantilevered on two thin columns.
  bx(k, k.Wc, -9.5, 0, -1, 9, H, 7, CONC);
  const rw = F(-9.5, 6.4, 2.51);
  b.geo(N.curtain, cached('mn-round', () => new CircleGeometry(3.0, 24)), rw, [0.75, 0.85, 0.95]);
  b.geo(k.Wc, cached('mn-roundrim', () => new RingGeometry(3.0, 3.35, 24)), sub(rw, 0, 0, 0.02), [0.8, 0.8, 0.78]);
  for (const y of [-1.8, -0.6, 0.6, 1.8]) b.box(k.Wc, sub(rw, 0, y, 0.05), 2 * Math.sqrt(9 - y * y), 0.14, 0.08, [0.85, 0.85, 0.83]);
  for (const x of [-13.6, -5.4]) b.geo(k.Wc, cyl(0.2, 0.2, H, 8), F(x, H / 2, 4.2), CONC);
  // Middle: the glass hall, the library drum rising over the roof.
  bx(k, k.Wc, -0.5, 0, -0.7, 9, H, 7.6, [0.6, 0.62, 0.62]);
  glass(k, F(-0.5, H / 2, 3.12), 9, H, [0.9, 1.0, 1.1], 0.6, 3.0);
  for (const x of [-4.95, 3.95]) bx(k, k.Wc, x, 0, 3.1, 0.3, H, 0.3, CONC);
  b.geo(k.Wc, cyl(3.6, 3.6, 3.0, 20), F(-0.5, H + 1.5, -1.2), CONC);
  b.geo(N.curtain, cyl(3.62, 3.62, 1.0, 20, true), F(-0.5, H + 1.6, -1.2), [0.9, 1.0, 1.05]);
  // East: concrete frame and the wide outside stair up to the Spree bridge.
  bx(k, k.Wc, 9, 0, -1.75, 10, H, 5.5, CONC);
  glass(k, F(9, H / 2 + 3, 1.02), 9, H - 6, [0.8, 0.9, 0.95], 0.1);
  const steps = 14, rise = 5.6 / steps, run = 8 / steps;
  for (let i = 0; i < steps; i++) bx(k, k.Wc, 4.4 + (i + 0.5) * run, 0, 2.75, run, rise * (i + 1), 3.1, i % 2 ? CONC : [1.0, 1.0, 0.97]);
  bx(k, k.Wc, 13.2, 0, 2.75, 1.6, 5.6, 3.1, CONC);
  b.solid.excludeOccluder(() => {
    for (const z of [1.25, 4.25]) b.box(M.iron, F(8.4, 3.75, z, 0, 0, Math.atan2(5.6, 8)), 9.8, 0.06, 0.06, [0.5, 0.52, 0.52]);
  });
  b.shadowBox(F(0, H / 2, -1), 28, H, 7);
  // One roof slab over everything, overhanging at both ends.
  bx(k, k.Wc, 0, H, 0, 30.4, 0.6, 9.2, CONC);
  pane(b, F(9, 2.2, 1.02), 1.4, 2.4, rng, 0.5);
  b.light(lp(l, 4.0, 3.0, 4.6), 0xcfe4ff, 8, 8, 0.05, 3);
}

// ---------------------------------------------------------------- Kanzleramt

function kanzleramt(k: K): void {
  const { b, M, N, F, l } = k, W: RGB = [1, 1, 0.98], CL: RGB = [0.8, 0.92, 0.95], GR: RGB = [0.5, 1.1, 0.6];
  const HC = 24, HW = 8, WM = k.Wc;
  // The cube (Leitungsgebäude): round windows high on its north and south faces, tall fins east and west.
  bx(k, WM, 0, 0, -5.5, 14, HC, 13, W);
  b.shadowBox(F(0, HC / 2, -5.5), 14, HC, 13);
  for (const s of [-1, 1]) {
    const f = F(s * 7.01, 16.2, -5.5, (s * Math.PI) / 2);
    b.geo(N.curtain, cached('mn-bka-round', () => new CircleGeometry(4.2, 28)), f, [0.7, 0.82, 0.9]);
    b.geo(WM, cached('mn-bka-rim', () => new RingGeometry(4.2, 4.7, 28)), sub(f, 0, 0, 0.02), [0.9, 0.9, 0.88]);
    for (const y of [-2.1, 0, 2.1]) b.box(WM, sub(f, 0, y, 0.06), 2 * Math.sqrt(4.2 * 4.2 - y * y), 0.18, 0.1, W);
    b.box(WM, sub(f, 0, 0, 0.06), 0.18, 8.4, 0.1, W);
  }
  for (const s of [-1, 1]) {
    const z = s < 0 ? -12.01 : 1.01;
    glass(k, F(0, 10.9, z, s < 0 ? Math.PI : 0), 13, 21.2, s > 0 ? [1.2, 1.1, 0.95] : [0.85, 0.95, 1.0], 0.2);
    for (let i = 0; i < 7; i++) bx(k, WM, -6.3 + i * 2.1, 0, z + s * 0.5, 0.55, HC - 2, 1.0, W);
    bx(k, WM, 0, HC - 2.5, z + s * 0.5, 14, 2.5, 1.0, W);
  }
  bx(k, WM, 0, HC, -5.0, 15, 0.5, 15.4, W);
  // Low office wings north and south (local ±x): fins, glass bays, every third a green winter garden;
  // the outer face of the south wing is what the camera sees. Curved ends at the court.
  for (const s of [-1, 1]) {
    bx(k, WM, s * 9.4, 0, -2, 4.8, HW, 24, W);
    bx(k, WM, s * 9.4, HW, -2, 5.0, 0.4, 24.2, W);
    b.shadowBox(F(s * 9.5, HW / 2, 0), 5, HW, 28);
    for (let i = 0; i < 12; i++) {
      const z = -13 + i * 2;
      glass(k, F(s * 11.81, HW / 2, z, (s * Math.PI) / 2), 1.7, HW - 0.6, i % 3 === 1 ? GR : CL, i * 0.29, 2.6);
      bx(k, WM, s * 11.875, 0, z + 1, 0.25, HW, 0.3, W);
    }
    for (const y of [2.7, 5.3]) bx(k, WM, s * 11.9, y, -2, 0.2, 0.25, 24, W);
    // Court side (faces the court, seen through it from the south).
    for (let i = 0; i < 4; i++) {
      const z = 2 + i * 2;
      glass(k, F(s * 6.99, HW / 2, z, (-s * Math.PI) / 2), 1.7, HW - 0.6, i % 2 ? GR : CL, i * 0.41, 2.6);
      bx(k, WM, s * 6.92, 0, z + 1, 0.15, HW, 0.3, W);
    }
    // Curved east end: a quarter round and a short wall closing it to the court.
    b.geo(WM, cached('mn-bka-curve', () => new CylinderGeometry(4, 4, HW, 10, 1, false, 0, Math.PI / 2)), F(s * 8, HW / 2, 10, s < 0 ? -Math.PI / 2 : 0), W);
    bx(k, WM, s * 7.5, 0, 12, 1.0, HW, 4, W);
  }
  // Ehrenhof: paving, entrance canopy, the rusty Chillida "Berlin" (two arms reaching for each other), flags,
  // fence with the gate (2089: a Sperrzone holo sign) and the plaque.
  bx(k, M.concrete, 0, 0, 7.5, 14, 0.05, 13, [0.6, 0.6, 0.58]);
  bx(k, WM, 0, 4.0, 2.6, 6, 0.3, 3.2, W);
  b.light(lp(l, 0, 3.4, 2.8), 0xcfe4ff, 9, 9, 0.05, 3);
  b.light(lp(l, 0, 2.2, 14.6), 0x6a8cff, 6, 7, 0.1, 2.4);
  b.solid.excludeOccluder(() => {
    const RU: RGB = [0.8, 0.48, 0.32], FE: RGB = [0.25, 0.26, 0.28];
    for (const s of [-1, 1]) {
      bx(k, M.rust, s * 1.5, 0, 7.5, 1.0, 3.2, 0.9, RU);
      b.box(M.rust, F(s * 0.95, 3.6, 7.5, 0, 0, s * 0.75), 0.8, 1.9, 0.75, RU);
      b.box(M.rust, F(s * 0.25, 4.1, 7.5, 0, 0, s * 1.45), 0.6, 0.9, 0.6, RU);
    }
    for (const x of [-5.6, 5.6]) {
      b.geo(M.iron, cyl(0.06, 0.09, 8, 6), F(x, 4, 12.4), [0.7, 0.72, 0.74]);
      const flag: readonly RGB[] = x < 0 ? FLAG : [[0.1, 0.2, 0.6], [0.1, 0.2, 0.6], [0.1, 0.2, 0.6]];
      flag.forEach((t, j) => b.box(M.linen, F(x - Math.sign(x) * 0.95, 7.5 - j * 0.38, 12.4), 1.8, 0.38, 0.04, t));
    }
    for (const s of [-1, 1]) {
      for (const y of [0.12, 0.95]) bx(k, M.iron, s * 4.25, y, 13.5, 5.7, 0.08, 0.08, FE);
      for (let i = 0; i < 8; i++) bx(k, M.iron, s * (1.75 + i * 0.75), 0, 13.5, 0.06, 1.1, 0.06, FE);
      bx(k, WM, s * 1.4, 0, 13.5, 0.6, 1.6, 0.6, W);
    }
    quad(k, k.S, F(0, 1.25, 13.85), 2.2, 0.55, cell(ROW.small, 1, 2));
    bx(k, WM, -4.4, 0, 13.85, 2.2, 0.85, 0.3, W);
    quad(k, k.S, F(-4.4, 0.5, 14.01), 1.8, 0.45, cell(ROW.plaque, 1, 2));
  });
}

// ---------------------------------------------------------------- entry

export function buildNorth(c: MCtx, l: Landmark): boolean {
  const k = (): K => { const m = northMats(c.N); return { ...c, l, F: frameOf(l), S: m.signs, Wc: m.white }; };
  switch (l.kind) {
    case 'tor': tor(k()); return true;
    case 'reichstag': reichstag(k()); return true;
    case 'bundesbau': {
      const v = l.variant ?? 0;
      (v === 1 ? plh : v === 2 ? melh : jkh)(k());
      return true;
    }
    case 'kanzleramt': kanzleramt(k()); return true;
    default: return false;
  }
}
