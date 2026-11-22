// M16 Charlottenburg step 4: Schloss Charlottenburg and its garden.
// Built from photos (`docs/maps/landmarks.md`, `docs/tasks/m16-charlottenburg.md`). This file owns these kinds:
//   stuelerbau ehrenhoftor schlossmitte schlossfluegel neuerfluegel orangerie
//   gartentor mausoleum belvedere
//
// Contract: `buildSchloss` returns true when it drew the landmark, false otherwise; `buildCharlottenburgLandmark`
// asks this file, then the other two, then falls back to the step 2 massing in `charlottenburg-world.ts`.
// Helpers come from there and from `landmarks.ts`; colliders stay in `src/data`, this only draws.
//
// Photos (Wikimedia Commons, looked at 2026-11-19; scratch copies only): Schloss court front as a photochrom
// about 1900 (the main source: centre, gate, wings, red roofs), the burnt Schloss 1945 (Bundesarchiv 146-1980-121-13:
// gate piers and gladiators), the court front 2007 and an aerial view (layout, wing roofs), the garden front 2003;
// the 1987 garden front filed both as Große Orangerie and as Neuer Flügel; Belvedere 2005; Mausoleum 2019;
// Stülerbau (Museum Berggruen) 2009. The Gartentor is built without a photo.
//
// Cues (* = below 5 m, what the game camera sees):
// - Schloss (central block): pale cream plaster, white pilasters and window frames*, the three-axis risalit
//   under a pediment with the arched portal*, lanterns* and the Diva's two mirror arches beside it*, shards on
//   the steps*, a balustrade with vases, red hipped tile roofs, the lower links to the wings, the tower: square
//   base with a balustrade, the tall drum with paired pilasters and the clock, the ribbed green dome with oval
//   dormers in gilded frames, the slender lit lantern, the gilded Fortuna with her sail.
// - Wings round the Ehrenhof: two storeys, the window rhythm*, red mansards with dormers, pediment on the gate ends.
// - Neuer Flügel: two storeys, iron balcony rails*, the Golden Gallery risalit with five arched windows over an
//   open colonnade*, urns on its attic, red hipped roof (the garden front's cues moved to the south face).
// - Orangerie (burnt-out, roofless mirror gallery): tall north wall with two rows of arched mirrors in silver
//   frames* (some cracked, half fallen or down to shards), burnt window piers falling toward the camera*, low
//   broken front*, sooty attic urns, charred beams, rubble, the crashed chandelier and shards on the floor*.
// - Ehrenhof gate: sandstone base*, wrought-iron railing with gilded tips and rings*, the shut gate with its
//   crown*, mirror shards caught in it*, the broad piers with niche and oval medallion*, the lunging gladiators.
// - Stülerbauten: rusticated ground floor*, giant pilasters, risalit pediment, roof balustrade, the tempietto
//   with its ring of columns and dark dome.
// - Gartentor: two piers with urns*, iron arch with a lantern*, one gate leaf fallen flat in the passage*.
// - Belvedere: oval core and four short risalits, white ground floor*, pearl-blue upper storeys, columns and
//   balconies, iron railings on the flat risalit roofs, green dome, the gilded putti with the flower basket.
// - Mausoleum: red granite Doric portico with fluted columns, frieze and pediment (A ☧ Ω)*, bronze door*,
//   the higher light cella gable behind, steps with two vases*, two firs*.
// Wear (guideline 2026-11-18, no graffiti): the shared landmark wear (soot, cracks, broken and boarded
// windows), missing balusters, rubble heaps at the feet; the Orangerie is the burnt ruin.
//
// Cost: no new material. Mirrors and the chandelier are the shared glossy `railSteel` (sky environment
// reflection, no extra pass, no planar reflection): one batch more in the chunks of the Orangerie and the
// Ehrenhof; the drum clock is the shared `clock` (one batch in the Schloss chunk). Everything else merges
// into stucco, roof, slate, enamel (gilding), iron, glass, dark, darkWood, lampGlass, mossy and the window
// atlas. No lights. Triangles (sheet,
// measured): Schloss 6.1k, wings 0.7k / 0.7k / 1.4k, Neuer Flügel 2.2k, Orangerie 4.0k, gate 3.7k, Stülerbau
// 1.7k each, Gartentor 0.6k, Belvedere 2.5k, Mausoleum 1.0k.
import { CircleGeometry, ConeGeometry, CylinderGeometry, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, type Material } from 'three';
import { OPEN_PARTS, type LandmarkKind } from '../data/map';
import { archHead, frustum, pane, sub, type RGB } from './landmarks';
import { Rng } from '../sim/math';
import { battens, cached, lm, roof, sandbags, shade, shutter, slope, wallFace, wornFace, wornSpot, type Ctx, type Grime } from './charlottenburg-world';

/** The kinds this file owns (one builder each once step 4 is done). */
export const SCHLOSS_KINDS: ReadonlySet<LandmarkKind> = new Set<LandmarkKind>(['stuelerbau', 'ehrenhoftor', 'schlossmitte', 'schlossfluegel', 'neuerfluegel', 'orangerie', 'gartentor', 'mausoleum', 'belvedere']);

/**
 * Worn surfaces per sight (Johannes 2026-11-19: too even, too clean): the recipe of the shared pass in
 * `charlottenburg-world.ts` (`weather`). The yellow plaster of the Schloss and its wings drifts and loses
 * render to the brick (the wings more than the centre, whose portal stays clean); the burnt Orangerie is black
 * with soot; the garden stone (gate, Mausoleum) is green and streaked.
 */
export const GRIME: Partial<Record<LandmarkKind, Grime>> = {
  stuelerbau: { tris: 180, drift: 0.24, bay: 2.4, damp: 0.9, moss: 0.6, soot: 0.5, stains: 2.6, streaks: 2, spall: 0.8 },
  ehrenhoftor: { tris: 120, drift: 0.18, bay: 1.4, damp: 1.1, moss: 0.9, soot: 0.4, stains: 4, streaks: 1 },
  schlossmitte: { tris: 560, drift: 0.24, bay: 2.6, damp: 0.9, moss: 0.4, soot: 0.6, sootBays: 0.2, stains: 2.6, streaks: 2, spall: 0.9, patch: 0.8 },
  schlossfluegel: { tris: 62, drift: 0.33, bay: 2.4, damp: 1.0, moss: 0.4, soot: 0.5, sootBays: 0.3, stains: 1.9, streaks: 1, spall: 1.3, patch: 1.0 },
  neuerfluegel: { tris: 210, drift: 0.27, bay: 2.6, damp: 0.9, moss: 0.5, soot: 0.6, sootBays: 0.25, stains: 2.6, streaks: 2, spall: 0.9, patch: 0.5 },
  orangerie: { tris: 380, drift: 0.24, bay: 2.2, damp: 0.7, soot: 1.3, sootBays: 0.85, stains: 2.6, streaks: 2, spall: 1.3 },
  gartentor: { tris: 60, drift: 0.18, bay: 1.2, damp: 1.1, moss: 1.0, soot: 0.4, stains: 4.8, streaks: 1 },
  mausoleum: { tris: 100, drift: 0.15, bay: 1.8, damp: 1.0, moss: 1.0, soot: 0.4, stains: 4, streaks: 3 },
  belvedere: { tris: 170, drift: 0.24, bay: 2.2, damp: 0.7, moss: 0.5, soot: 0.5, stains: 2.6, streaks: 2, spall: 0.7 },
};

// Colours (own: this module is imported by `charlottenburg-world.ts`, so its `C` is not ready at load).
/** Linear channel of an sRGB byte. */
const lin = (v: number): number => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/**
 * Vertex tint that turns the shared stucco (base #b9a88c; vertex colours multiply in linear space) into the
 * sRGB colour `hex`, so the palette below reads as written.
 */
function onStucco(hex: number): RGB {
  return [lin((hex >> 16) & 255) / lin(0xb9), lin((hex >> 8) & 255) / lin(0xa8), lin(hex & 255) / lin(0x8c)];
}
/** Pale yellow plaster of the Schloss (photochrom about 1900: light cream-ochre). */
const YEL = onStucco(0xe4cc8e);
/** White-grey pilasters, frames and cornices. */
const TRIM = onStucco(0xeee9dc);
/** Sandstone (plinths, gate piers). */
const SAND = onStucco(0xcdbc98);
/** Clean white (Belvedere trim and ground floor). */
const WHITE = onStucco(0xf2f2ee);
/** Pale pearl-blue plaster of the Belvedere (photo: light blue; board: pearl). */
const PEARL = onStucco(0xbfd4e2);
/** Green copper on the stucco (dome, cupolas): the board's teal, lighter than the 1900 patina. */
const COPPER = onStucco(0x78b6a2);
/** Copper ribs, a shade darker than the dome. */
const RIB = onStucco(0x4f8a78);
const SLATE: RGB = [0.62, 0.66, 0.74];
/** Red tile roofs (photochrom about 1900). */
const RED: RGB = [0.95, 0.62, 0.5];
const GOLD: RGB = [1.25, 0.95, 0.45];
/** Mirror glass: silver with a faint violet cast (board: silver, glass, violet, pearl). */
const MIRROR: RGB = [1.12, 1.1, 1.24];
/** Mirror frames: silvered, little gold. */
const FRAME: RGB = [0.78, 0.77, 0.84];
const IRON: RGB = [0.42, 0.44, 0.47];
const SOOT = onStucco(0x4e463c);
const CHAR: RGB = [0.22, 0.19, 0.17];

// ---------------------------------------------------------------- helpers

/** Frame at local (x, y, z) of the landmark, turned by (ry, rx, rz). */
function F(c: Ctx, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): Matrix4 {
  return sub(lm(c.l, x, y, z), 0, 0, 0, ry, rx, rz);
}
/** Box with its bottom at y in frame m. */
function bb(c: Ctx, mat: Material, m: Matrix4, x: number, y: number, z: number, w: number, h: number, d: number, t?: RGB, ry = 0): void {
  c.b.box(mat, sub(m, x, y + h / 2, z, ry), w, h, d, t);
}
/** Cylinder (or cone, frustum) standing on y in frame m. */
function cy(c: Ctx, mat: Material, m: Matrix4, x: number, y: number, z: number, r: number, h: number, t?: RGB, seg = 10, top = r): void {
  c.b.geo(mat, cached(`sc-cy${r.toFixed(2)},${top.toFixed(2)},${h.toFixed(2)},${seg}`, () => new CylinderGeometry(top, r, h, seg)), sub(m, x, y + h / 2, z), t);
}
/** A box between two points of frame m (limbs, beams), section s. */
function limb(c: Ctx, mat: Material, m: Matrix4, a: readonly [number, number, number], e: readonly [number, number, number], s: number, t?: RGB, s2 = s): void {
  const A = new Vector3(...a), B = new Vector3(...e), d = B.clone().sub(A), len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.normalize());
  c.b.box(mat, m.clone().multiply(new Matrix4().makeRotationFromQuaternion(q).setPosition(A.add(B).multiplyScalar(0.5))), s, len, s2, t);
}
function ball(c: Ctx, mat: Material, m: Matrix4, x: number, y: number, z: number, r: number, t?: RGB, sy = 1): void {
  c.b.geo(mat, cached('sc-ball', () => new SphereGeometry(1, 8, 5)), sub(m, x, y, z).multiply(new Matrix4().makeScale(r, r * sy, r)), t);
}
/** A flat quad of `mat` on frame m (facing its +z), centred at (x, y, z). */
function quad(c: Ctx, mat: Material, m: Matrix4, x: number, y: number, z: number, w: number, h: number, t?: RGB): void {
  const p = (u: number, v: number): Vector3 => new Vector3(x + u, y + v, z).applyMatrix4(m);
  c.b.solid.of(mat).quad([p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2)], [0, 0, 1, 1], t ? [t] : undefined);
}
/** Gilded spear tip of the railing (an open three-sided cone). */
const TIP = (): ReturnType<typeof cached> => cached('sc-tip', () => new ConeGeometry(0.06, 0.22, 3, 1, true));
/** Urn or vase on a post (lathe). */
function urn(c: Ctx, m: Matrix4, x: number, y: number, z: number, s: number, t: RGB = TRIM): void {
  const g = cached('sc-urn', () => new LatheGeometry([[0.3, 0], [0.18, 0.15], [0.42, 0.55], [0.24, 0.88], [0.26, 1.0], [0, 1.08]].map(([a, b]) => new Vector2(a, b)), 6));
  c.b.geo(c.M.stucco, g, sub(m, x, y, z).multiply(new Matrix4().makeScale(s, s, s)), t);
}

interface Row { y: number; h: number; w?: number; arch?: boolean; hood?: boolean }
/**
 * Window rows on a facade face: frame m at the face (bottom centre, +z out), `len` wide, `n` axes. Each window
 * is a pane from the shared atlas in a white frame, optionally arched and with a hood; pilasters between
 * the axes when `pil` gives their height. `skip(i)` leaves an axis blank (portal, risalit edge).
 */
function face(c: Ctx, m: Matrix4, len: number, n: number, rows: Row[], pil = 0, skip?: (i: number) => boolean, lit = 0.3, trim: RGB = TRIM): void {
  const M = c.M, st = len / n;
  for (let i = 0; i < n; i++) {
    if (skip?.(i)) continue;
    const x = -len / 2 + (i + 0.5) * st;
    for (const r of rows) {
      const w = r.w ?? Math.min(1.5, st * 0.46), mm = sub(m, x, r.y, 0);
      // Worn surrounds (2026-11-19): each a little greyer or sootier, the lower ones dirtier; from the position, not `c.rng`.
      const hsh = Math.abs(Math.sin(x * 12.9898 + r.y * 78.233 + len) * 43758.5453) % 1;
      quad(c, M.stucco, mm, 0, 0, 0.03, w + 0.34, r.h + 0.3, shade(trim, 0.9 + 0.12 * hsh - (r.y < 3 ? 0.06 : 0) - (hsh > 0.85 ? 0.14 : 0)));
      pane(c.b, sub(mm, 0, 0, 0.02), w, r.h, c.rng, lit);
      if (r.arch) {
        archHead(c.b, M.stucco, sub(mm, 0, r.h / 2 + 0.15, 0), w + 0.34, false, 0.045, trim);
        archHead(c.b, M.dark, sub(mm, 0, r.h / 2, 0.02), w, false, 0.05);
      }
      if (r.hood) c.b.box(M.stucco, sub(mm, 0, r.h / 2 + (r.arch ? w / 2 + 0.35 : 0.3), 0.1), w + 0.7, 0.16, 0.22, trim);
    }
  }
  if (pil > 0) for (let i = 0; i <= n; i++) bb(c, M.stucco, m, -len / 2 + i * st, 0.6, 0.06, 0.42, pil - 0.6, 0.14, trim);
}
/** Cornice band along a face (bottom at y), `out` meters proud of it. */
function band(c: Ctx, m: Matrix4, len: number, y: number, h: number, out: number, t: RGB = TRIM): void {
  bb(c, c.M.stucco, m, 0, y, out / 2, len, h, out + 0.02, t);
}
/** Roof balustrade on a face line: plinth, balusters (a few missing), rail, posts every `post` m with urns or figures. */
function balustrade(c: Ctx, m: Matrix4, len: number, y: number, post = 6, figs = false, t: RGB = TRIM, tops = true): void {
  const M = c.M, n = Math.max(1, Math.round(len / post));
  bb(c, M.stucco, m, 0, y, 0, len, 0.18, 0.5, t);
  bb(c, M.stucco, m, 0, y + 0.78, 0, len, 0.14, 0.55, t);
  for (let x = -len / 2 + 0.35; x < len / 2 - 0.2; x += 0.62) if (c.rng.next() > 0.07) quad(c, M.stucco, m, x, y + 0.48, 0.2, 0.17, 0.6, t);
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    bb(c, M.stucco, m, x, y, 0, 0.55, 1.0, 0.6, t);
    if (!tops || c.rng.next() < 0.15) continue;
    if (figs && i % 2) statue(c, m, x, y + 1.0, 0, 1.7, t);
    else urn(c, m, x, y + 1.0, 0, 0.75, t);
  }
}
/** Standing figure (robe, torso, head, one arm raised) on frame m, height h. */
function statue(c: Ctx, m: Matrix4, x: number, y: number, z: number, h: number, t: RGB, mat: Material = c.M.stucco): void {
  const f = sub(m, x, y, z);
  cy(c, mat, f, 0, 0, 0, h * 0.17, h * 0.55, t, 7, h * 0.1);
  bb(c, mat, f, 0, h * 0.55, 0, h * 0.24, h * 0.24, h * 0.14, t);
  ball(c, mat, f, 0, h * 0.88, 0, h * 0.08, t, 1.2);
  limb(c, mat, f, [h * 0.12, h * 0.74, 0], [h * 0.22, h * 1.02, h * 0.05], h * 0.06, t);
  limb(c, mat, f, [-h * 0.12, h * 0.74, 0], [-h * 0.18, h * 0.5, h * 0.06], h * 0.06, t);
}
/** Arched mirror in a silver frame on frame m (bottom centre at y), cracked or half fallen by `state`. */
function mirror(c: Ctx, m: Matrix4, x: number, y: number, w: number, h: number, state: 0 | 1 | 2 | 3): void {
  const M = c.M, mm = sub(m, x, y, 0), mat = M.railSteel;
  // Frame: sides, sill, arch rim; a dark backing behind the glass.
  bb(c, mat, mm, 0, -0.12, 0.06, w + 0.4, h + 0.12, 0.1, FRAME);
  archHead(c.b, mat, sub(mm, 0, h, 0.06), w + 0.4, false, 0.06, FRAME);
  bb(c, mat, mm, 0, -0.26, 0.12, w + 0.6, 0.16, 0.22, FRAME);
  quad(c, M.dark, mm, 0, h / 2, 0.115, w, h);
  archHead(c.b, M.dark, sub(mm, 0, h, 0), w, false, 0.115);
  // 0 whole, 1 cracked (dark crack lines from a point), 2 lower half fallen out, 3 only shards left at the edge.
  if (state === 3) {
    for (const [sx, sy, sw, sh] of [[-0.3, 0.12, 0.4, 0.5], [0.32, 0.7, 0.3, 0.6], [-0.28, 0.82, 0.35, 0.3]] as const) quad(c, mat, mm, sx * w, sy * h, 0.125, sw * w, sh * h * 0.6, MIRROR);
    return;
  }
  const y0 = state === 2 ? h * 0.48 : 0;
  quad(c, mat, mm, 0, (y0 + h) / 2, 0.125, w, h - y0, MIRROR);
  archHead(c.b, mat, sub(mm, 0, h, 0), w, false, 0.125, MIRROR);
  if (state === 2) for (let i = 0; i < 3; i++) quad(c, mat, mm, (i - 1) * w * 0.3, y0 - 0.15 - i * 0.1, 0.125, w * 0.22, 0.4, MIRROR);
  if (state === 1) {
    const cx = c.rng.range(-0.25, 0.25) * w, cyy = c.rng.range(0.35, 0.7) * h;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + c.rng.range(0, 0.5), r = c.rng.range(0.6, 1.1) * Math.min(w, h) * 0.6;
      quad(c, M.dark, sub(mm, cx + (Math.cos(a) * r) / 2, cyy + (Math.sin(a) * r) / 2, 0.13, 0, 0, a), 0, 0, 0, r, 0.07);
    }
  }
}
/**
 * Lunging gladiator (the Borghese Fencer, as on the Ehrenhof piers in the 1900 and 1945 photos) on frame m, facing
 * +x: the long lunge, the body thrown forward, the round shield raised high in front, the sword arm back.
 */
function fighter(c: Ctx, m: Matrix4, s: number, t: RGB): void {
  const M = c.M, P = (x: number, y: number, z: number): [number, number, number] => [x * s, y * s, z * s];
  limb(c, M.stucco, m, P(0.85, 0, 0.12), P(0.55, 0.55, 0.1), 0.15 * s, t);
  limb(c, M.stucco, m, P(0.55, 0.55, 0.1), P(0, 0.95, 0.06), 0.18 * s, t);
  limb(c, M.stucco, m, P(-0.95, 0, -0.1), P(-0.45, 0.45, -0.06), 0.14 * s, t);
  limb(c, M.stucco, m, P(-0.45, 0.45, -0.06), P(0, 0.95, 0), 0.17 * s, t);
  limb(c, M.stucco, m, P(0, 0.95, 0), P(0.55, 1.45, 0), 0.3 * s, t, 0.2 * s);
  ball(c, M.stucco, m, 0.72 * s, 1.62 * s, 0, 0.13 * s, t);
  limb(c, M.stucco, m, P(0.5, 1.45, 0.12), P(0.8, 2.0, 0.16), 0.1 * s, t);
  c.b.geo(M.stucco, cached('sc-shield', () => new CylinderGeometry(0.42, 0.42, 0.06, 10)), sub(m, 0.86 * s, 2.08 * s, 0.18 * s, 0, 0, 0.9).multiply(new Matrix4().makeScale(s, s, s)), t);
  limb(c, M.stucco, m, P(0.45, 1.42, -0.12), P(-0.3, 1.0, -0.22), 0.1 * s, t);
  limb(c, M.iron, m, P(-0.3, 1.0, -0.22), P(-0.85, 0.85, -0.26), 0.04 * s, IRON);
}
/** Rubble heap at local (x, z): a few stucco lumps and a charred beam, all walk-over (below 0.3 m). */
function rubble(c: Ctx, x: number, z: number, r: number, t: RGB = onStucco(0xb4aa98), beam = true): void {
  for (let i = 0; i < 6; i++) {
    const s = c.rng.range(0.3, 0.8) * r;
    c.b.box(c.M.stucco, F(c, x + c.rng.range(-r, r), s * 0.14, z + c.rng.range(-r, r) * 0.6, c.rng.range(0, 3), c.rng.range(-0.2, 0.2)), s, s * 0.32, s * c.rng.range(0.7, 1.3), t);
  }
  if (beam) c.b.box(c.M.darkWood, F(c, x, 0.11, z, c.rng.range(0, 3), 0, 0.04), r * 2.2, 0.2, 0.24, CHAR);
}

// ---------------------------------------------------------------- Schloss, central block

/**
 * Court front of the Altes Schloss (photochrom about 1900): the three-storey centre (x ±17, front z +6.5) with
 * the three-axis risalit under a pediment, the lower two-storey links to the wings (front z +8) under red
 * mansards, a balustrade with vases over the centre, the hipped tile roof and the tower behind the pediment.
 */
function schlossmitte(c: Ctx): void {
  const M = c.M, H = 11.6, FZ = 6.5, RZ = 7.3, LH = 9.2, O = F(c, 0, 0, 0);
  const rows: Row[] = [{ y: 2.3, h: 2.3, hood: true }, { y: 6.6, h: 2.9, arch: true }, { y: 10.0, h: 1.1, w: 1.0 }];
  // Centre body and the risalit, the links (two storeys) out to the wings.
  bb(c, M.stucco, O, 0, 0, -0.75, 34, H, 14.5, YEL);
  bb(c, M.stucco, O, 0, 0, 6.9, 12, H, 0.8, YEL);
  for (const s of [-1, 1]) {
    bb(c, M.stucco, O, s * 23, 0, 0, 12, LH, 16, YEL);
    const lf = F(c, s * 23, 0, 8);
    bb(c, M.stucco, lf, 0, 0, 0.06, 12, 0.6, 0.14, SAND);
    face(c, lf, 12, 4, [{ y: 2.3, h: 2.3, hood: true }, { y: 6.4, h: 2.4, hood: true }], 0);
    band(c, lf, 12, LH - 0.5, 0.5, 0.35);
    roof(c, M.roof, s * 23, LH, 0, 12.3, 16.3, 2.8, 10, 12, RED);
    for (let i = 0; i < 4; i++) dormer(c, F(c, s * 23 - 4.5 + i * 3, LH + 0.2, 7.3));
  }
  bb(c, M.stucco, O, 0, 0, FZ + 0.06, 34, 0.7, 0.14, SAND);
  // Court front: four axes either side of the risalit, its three arched axes (portal and two mirror arches).
  for (const s of [-1, 1]) {
    const fm = F(c, s * 11.5, 0, FZ);
    face(c, fm, 11, 4, rows, H - 0.6);
    band(c, fm, 11, 4.3, 0.22, 0.18);
    band(c, fm, 11, H - 0.6, 0.6, 0.42);
  }
  const R = F(c, 0, 0, RZ);
  face(c, R, 12, 3, [rows[1]!, rows[2]!], H - 0.6);
  band(c, R, 12.2, 4.3, 0.22, 0.18);
  band(c, R, 12.4, H - 0.6, 0.6, 0.45);
  for (const x of [-6, 6]) bb(c, M.stucco, R, x, 0.6, 0.12, 0.5, H - 1.2, 0.22, TRIM);
  // Pediment over the risalit with a gilded cartouche.
  roof(c, M.stucco, 0, H, RZ - 0.8, 1.6, 12.6, 2.4, 1.6, 0, TRIM, Math.PI / 2);
  ball(c, M.enamel, R, 0, H + 0.95, 0.15, 0.55, GOLD, 0.7);
  // The portal (middle arch), the Diva's mirror arches either side, the steps with shards.
  bb(c, M.stucco, R, 0, 0, 0.0, 2.7, 3.9, 0.1, TRIM);
  archHead(c.b, M.stucco, sub(R, 0, 3.9, 0), 2.7, false, 0.05, TRIM);
  bb(c, M.dark, R, 0, 0, 0.06, 2.1, 3.6, 0.04);
  archHead(c.b, M.dark, sub(R, 0, 3.6, 0), 2.1, false, 0.08);
  for (const s of [-1, 1]) {
    mirror(c, R, s * 4, 0.6, 1.5, 3.0, s < 0 ? 0 : 1);
    // Lanterns beside the portal (glass only; the court's light comes from the map's lamps).
    bb(c, M.iron, R, s * 1.75, 2.9, 0.25, 0.08, 0.5, 0.4, IRON);
    bb(c, M.lampGlass, R, s * 1.75, 3.0, 0.45, 0.26, 0.42, 0.26);
  }
  for (let i = 0; i < 3; i++) bb(c, M.stucco, R, 0, 0, 0.25 + i * 0.2, 5.4 - i * 0.6, 0.15 * (3 - i), 0.22, SAND);
  for (let i = 0; i < 6; i++) c.b.box(M.railSteel, F(c, c.rng.range(-3, 3), 0.48, RZ + c.rng.range(0.2, 0.7), c.rng.range(0, 3)), c.rng.range(0.1, 0.3), 0.02, c.rng.range(0.1, 0.25), MIRROR);
  // Side fronts of the centre over the links (east and west), seen at a grazing angle above the link roofs.
  for (const s of [-1, 1]) face(c, F(c, s * 17, 0, -0.75, (s * Math.PI) / 2), 14.5, 4, [rows[2]!], 0, undefined, 0.2);
  // Balustrade with vases over the centre front, the hipped tile roof behind it.
  for (const s of [-1, 1]) balustrade(c, F(c, s * 11.5, 0, FZ - 0.1), 11, H, 3.7, false);
  roof(c, M.roof, 0, H, -0.75, 33.6, 14.2, 3.6, 26, 6.5, RED);
  // 2026-11-19: slipped patches showing the battens on the main roof and the west link's mansard (reveal), a shutter
  // hanging off the east link's upper window (the portal and the mirror arches stay clean).
  battens(c, slope(c, -9, H, -0.75 + 7.1, 3.85, 3.6, 0.42), 2.4, 1.4, M.roof, RED);
  battens(c, slope(c, -23, LH, 8.15, 2.15, 2.8, 0.72), 1.4, 0.9, M.roof, RED);
  shutter(c, F(c, 23 + 4.5, 6.4, 8.03), 1.38, 2.4, 1);
  rubble(c, 8.5, 7.6, 0.9);
  rubble(c, -14, 7.2, 0.7, undefined, false);
  tower(c);
}

/** Dormer on frame m (bottom at the roof foot), facing +z. */
function dormer(c: Ctx, m: Matrix4): void {
  c.b.box(c.M.stucco, sub(m, 0, 0.6, 0), 1.0, 1.2, 0.6, TRIM);
  c.b.geo(c.M.roof, frustum(1.2, 0.8, 0.5, 1.2, 0), sub(m, 0, 1.2, 0), RED);
  pane(c.b, sub(m, 0, 0.6, 0.3), 0.66, 0.85, c.rng, 0.2);
}

/**
 * The tower behind the pediment: square base with arched windows and a balustrade, the tall drum with paired
 * pilasters and the clock, the dome with oval dormers in gilded frames, the slender lantern, the Fortuna.
 */
function tower(c: Ctx): void {
  const M = c.M, T = F(c, 0, 0, 0), y0 = 11.6;
  bb(c, M.stucco, T, 0, y0, 0, 9.6, 3.4, 9.6, YEL);
  for (let k = 0; k < 4; k++) {
    const fm = sub(T, Math.sin((k * Math.PI) / 2) * 4.8, y0, Math.cos((k * Math.PI) / 2) * 4.8, (k * Math.PI) / 2);
    if (k === 0 || k === 1 || k === 3) face(c, fm, 9.6, 3, [{ y: 1.6, h: 1.5, arch: true }], 3.4);
    balustrade(c, sub(fm, 0, 0, -0.2), 9.6, 3.4, 4.8, false, TRIM, false);
  }
  // Drum: octagonal, tall arched windows between paired pilasters, the clock on the court side.
  const yd = y0 + 3.4, R = 3.6, HD = 6.4;
  cy(c, M.stucco, T, 0, yd, 0, R, HD, YEL, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, wm = sub(T, Math.sin(a) * R * 0.925, yd + 2.7, Math.cos(a) * R * 0.925, a);
    c.b.box(M.stucco, wm, 1.5, 3.4, 0.08, TRIM);
    pane(c.b, sub(wm, 0, 0, 0.02), 1.1, 2.9, c.rng, 0.8);
    archHead(c.b, M.dark, sub(wm, 0, 1.45, 0.02), 1.1, false, 0.05);
    archHead(c.b, M.stucco, sub(wm, 0, 1.6, 0), 1.5, false, 0.04, TRIM);
    for (const d of [-0.12, 0.12]) {
      const b = a + Math.PI / 8 + d;
      cy(c, M.stucco, T, Math.sin(b) * (R + 0.2), yd, Math.cos(b) * (R + 0.2), 0.17, HD - 0.4, TRIM, 6);
    }
  }
  cy(c, M.stucco, T, 0, yd + HD - 0.4, 0, R + 0.5, 0.65, TRIM, 16);
  c.b.geo(M.clock, cached('sc-clock', () => new CircleGeometry(0.75, 16)), sub(T, 0, yd + HD - 1.25, R + 0.1));
  bb(c, M.stucco, T, 0, yd + HD - 2.2, R - 0.2, 2.0, 1.95, 0.3, TRIM);
  // Dome: copper (green, as the board; dark in 1900), eight ribs, four oval dormers in gilded frames.
  const yb = yd + HD + 0.25, RD = 3.8, SY = 1.3;
  c.b.geo(M.stucco, cached('sc-dome', () => new SphereGeometry(RD, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2)), sub(T, 0, yb, 0).multiply(new Matrix4().makeScale(1, SY, 1)), COPPER);
  for (let i = 0; i < 8; i++) {
    c.b.geo(M.stucco, cached('sc-rib', () => new TorusGeometry(RD + 0.03, 0.11, 3, 7, Math.PI / 2)), sub(T, 0, yb, 0).multiply(new Matrix4().makeScale(1, SY, 1)).multiply(new Matrix4().makeRotationY((i * Math.PI) / 4 + Math.PI / 8)), RIB);
    if (i % 2) continue;
    const a = (i * Math.PI) / 4, e = 0.55, r = RD * Math.cos(e) + 0.12, om = sub(T, Math.sin(a) * r, yb + RD * SY * Math.sin(e), Math.cos(a) * r, a, -0.5);
    c.b.box(M.stucco, sub(om, 0, 0, -0.1), 1.0, 1.3, 0.5, TRIM);
    c.b.geo(M.enamel, cached('sc-ofr', () => new TorusGeometry(0.42, 0.09, 4, 12)), sub(om, 0, 0, 0.16).multiply(new Matrix4().makeScale(1, 1.3, 1)), GOLD);
    c.b.geo(M.dark, cached('sc-oculus', () => new CircleGeometry(0.4, 10)), sub(om, 0, 0, 0.16).multiply(new Matrix4().makeScale(1, 1.3, 1)));
    ball(c, M.enamel, om, 0, 0.75, 0.1, 0.16, GOLD);
  }
  // Lantern: tall, lit arches (a beacon on the axis at night), a small cap, the spike, the globe and the Fortuna.
  const yl = yb + RD * SY - 0.3;
  cy(c, M.stucco, T, 0, yl, 0, 1.15, 0.4, TRIM, 8);
  cy(c, M.stucco, T, 0, yl + 0.4, 0, 0.95, 2.6, YEL, 8);
  for (let i = 0; i < 8; i += 2) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    pane(c.b, sub(T, Math.sin(a) * 0.93, yl + 1.55, Math.cos(a) * 0.93, a), 0.5, 1.5, c.rng, 1);
  }
  cy(c, M.stucco, T, 0, yl + 3.0, 0, 1.15, 0.3, TRIM, 8);
  c.b.geo(M.stucco, cached('sc-cap', () => new SphereGeometry(1.05, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2)), sub(T, 0, yl + 3.3, 0).multiply(new Matrix4().makeScale(1, 1.4, 1)), COPPER);
  cy(c, M.enamel, T, 0, yl + 4.7, 0, 0.12, 0.5, GOLD, 6);
  ball(c, M.enamel, T, 0, yl + 5.35, 0, 0.36, GOLD);
  fortuna(c, sub(T, 0, yl + 5.65, 0), 3.4);
}

/** Fortuna (the weather vane): standing on one foot on the globe, a sail held up behind her. Gilded. */
function fortuna(c: Ctx, m: Matrix4, h: number): void {
  const M = c.M, g = GOLD, s = h / 3;
  limb(c, M.enamel, m, [0, 0, 0], [0.05 * s, 1.1 * s, 0], 0.16 * s, g);
  limb(c, M.enamel, m, [0.05 * s, 1.05 * s, 0], [-0.55 * s, 0.75 * s, -0.25 * s], 0.15 * s, g);
  cy(c, M.enamel, m, 0.05 * s, 0.85 * s, 0, 0.32 * s, 0.75 * s, g, 7, 0.2 * s);
  limb(c, M.enamel, m, [0.05 * s, 1.55 * s, 0], [0.05 * s, 2.3 * s, 0], 0.36 * s, g, 0.24 * s);
  ball(c, M.enamel, m, 0.05 * s, 2.5 * s, 0, 0.16 * s, g, 1.2);
  limb(c, M.enamel, m, [0.2 * s, 2.15 * s, 0], [0.65 * s, 2.85 * s, -0.1 * s], 0.08 * s, g);
  limb(c, M.enamel, m, [-0.1 * s, 2.15 * s, 0], [-0.6 * s, 2.8 * s, -0.1 * s], 0.08 * s, g);
  // The sail: a billowing cloth between the raised hands, curving back.
  for (let i = 0; i < 4; i++) {
    const u = -0.6 + i * 0.42, bend = Math.sin(((i + 0.5) / 4) * Math.PI) * 0.45;
    c.b.box(M.enamel, sub(m, u * s + 0.2 * s, 2.15 * s, (-0.25 - bend) * s, 0.2 - i * 0.12), 0.44 * s, 1.5 * s, 0.05 * s, g);
  }
}

// ---------------------------------------------------------------- the court wings

/**
 * The wings round the Ehrenhof (variant 0 west at the Schloss, 1 west at the gate, 2 east): two storeys under a
 * mansard roof, the court front toward the court (west wings +x, east wing −x), a pavilion end at the gate.
 */
function schlossfluegel(c: Ctx): void {
  const M = c.M, l = c.l, v = l.variant ?? 0, side = v === 2 ? -1 : 1, W = l.hx * 2, D = l.hz * 2, H = 9.2;
  const rows: Row[] = [{ y: 2.5, h: 2.4, hood: true }, { y: 6.6, h: 2.4, hood: true }];
  bb(c, M.stucco, F(c, 0, 0, 0), 0, 0, 0, W, H, D, YEL);
  const court = F(c, side * l.hx, 0, 0, (side * Math.PI) / 2);
  bb(c, M.stucco, court, 0, 0, 0.08, D, 0.6, 0.18, SAND);
  face(c, court, D, Math.max(2, Math.round(D / 3.3)), rows, 0);
  band(c, court, D, 4.4, 0.2, 0.16);
  band(c, court, D, H - 0.5, 0.5, 0.35);
  // The outer face (Orangerie forecourt or Luisenplatz side), plainer.
  face(c, F(c, -side * l.hx, 0, 0, (-side * Math.PI) / 2), D, Math.max(2, Math.round(D / 3.6)), rows, 0, undefined, 0.15);
  // Ends: the gate pavilion (v 1, v 2) and the open passage ends of the west wings (v 0 south, v 1 north).
  const ends: Array<1 | -1> = v === 2 ? [1] : v === 0 ? [1] : [1, -1];
  for (const e of ends) {
    const em = F(c, 0, 0, e * l.hz, e > 0 ? 0 : Math.PI);
    face(c, em, W, 2, rows, H - 0.9);
    band(c, em, W, H - 0.5, 0.5, 0.35);
  }
  if (v !== 0) {
    // Gate pavilion: a pediment over the end toward the Spandauer Damm.
    roof(c, M.stucco, 0, H, l.hz - 0.3, 0.6, W + 0.3, 1.4, 0.6, 0, TRIM, Math.PI / 2);
  }
  // Mansard: steep red tile slopes, dormers toward the court and the ends.
  roof(c, M.roof, 0, H, 0, W + 0.3, D + 0.3, 2.8, W - 2.6, D - 2.6, RED);
  const nd = Math.round(D / 3.3);
  for (let i = 0; i < nd; i++) dormer(c, F(c, side * (l.hx - 0.5), H + 0.2, -l.hz + (i + 0.5) * (D / nd), (side * Math.PI) / 2));
  // 2026-11-19: a shutter hanging off an upper window of the outer face.
  { const st = D / Math.max(2, Math.round(D / 3.6)); shutter(c, F(c, -side * (l.hx + 0.03), 6.6, -side * (-D / 2 + 1.5 * st), (-side * Math.PI) / 2), Math.min(1.5, st * 0.46), 2.4, 1); }
  rubble(c, side * (l.hx + 0.2), c.rng.range(-l.hz + 2, l.hz - 2), 0.6, undefined, false);
}

// ---------------------------------------------------------------- Neuer Flügel

/**
 * Knobelsdorff's Neuer Flügel (photo 1987 of the garden front; its cues go on the south face the route sees): two
 * storeys, iron balcony rails at the tall upper windows, the risalit of the Golden Gallery with five arched windows
 * over an open colonnade and urns on its attic, a red hipped tile roof.
 */
function neuerfluegel(c: Ctx): void {
  const M = c.M, l = c.l, W = l.hx * 2, D = l.hz * 2, H = 10.2, FZ = l.hz - 1.0;
  const rows: Row[] = [{ y: 2.1, h: 1.9, hood: true }, { y: 6.9, h: 3.2, hood: true }];
  bb(c, M.stucco, F(c, 0, 0, 0), 0, 0, -1.0, W, H, D - 2, YEL);
  bb(c, M.stucco, F(c, 0, 0, 0), 0, 0, FZ - 0.3, 13, H + 1.0, 1.2 + 0.3, YEL);
  bb(c, M.stucco, F(c, 0, 0, 0), 0, 0, FZ + 0.06, W, 0.6, 0.14, SAND);
  // Side parts: small ground floor windows, tall upper windows behind iron balcony rails, pilasters.
  for (const s of [-1, 1]) {
    const fm = F(c, s * 12.75, 0, FZ);
    face(c, fm, 12.5, 4, rows, H - 0.6);
    band(c, fm, 12.5, 4.5, 0.3, 0.3);
    band(c, fm, 12.5, H - 0.55, 0.55, 0.42);
    for (let i = 0; i < 4; i++) {
      const x = -6.25 + (i + 0.5) * (12.5 / 4);
      bb(c, M.iron, fm, x, 4.8, 0.32, 1.6, 0.05, 0.05, IRON);
      bb(c, M.iron, fm, x, 5.55, 0.32, 1.6, 0.05, 0.05, IRON);
      for (let k = 0; k < 6; k++) quad(c, M.iron, fm, x - 0.75 + k * 0.3, 5.18, 0.33, 0.03, 0.75, IRON);
    }
  }
  // The risalit (the Golden Gallery): five tall arched windows over an open colonnade, urns on the attic.
  const P = F(c, 0, 0, FZ + 0.45);
  face(c, P, 13, 5, [{ y: 7.0, h: 3.4, arch: true }], H + 0.4, undefined, 0.45);
  for (let i = 0; i < 5; i++) {
    const x = -6.5 + (i + 0.5) * 2.6;
    bb(c, M.dark, P, x, 0.4, 0.02, 1.6, 3.6, 0.04);
  }
  // (Columns stand within the footprint: the risalit front is 0.55 m inside its edge.)
  for (const x of [-5.2, -3.9, -1.3, 0, 1.3, 3.9, 5.2]) cy(c, M.stucco, P, x, 0, 0.28, 0.24, 4.6, TRIM, 8, 0.21);
  bb(c, M.stucco, P, 0, 4.6, 0.25, 12.4, 0.4, 0.6, TRIM);
  for (let k = 0; k < 24; k++) quad(c, M.iron, P, -6 + k * 0.52, 5.4, 0.53, 0.03, 0.8, IRON);
  bb(c, M.iron, P, 0, 5.75, 0.5, 12.2, 0.05, 0.06, IRON);
  band(c, P, 13, H - 0.2, 0.55, 0.42);
  bb(c, M.stucco, P, 0, H + 0.35, -0.3, 13, 0.85, 0.6, YEL);
  for (let i = 0; i < 6; i++) if (i !== 4) urn(c, P, -5.5 + i * 2.2, H + 1.2, -0.3, 1.25, TRIM);
  // East end (toward the garden gate).
  face(c, F(c, l.hx, 0, -1.0, Math.PI / 2), D - 2, 3, rows, H - 0.6);
  // Red hipped tile roof (photo 1987; the shape is the old one), dormers toward the court.
  roof(c, M.roof, 0, H, -1.0, W + 0.3, D - 1.7, 3.6, W - 7, 1.0, RED);
  roof(c, M.roof, 0, H + 1.0, FZ - 1.2, 13.4, 3.5, 2.6, 13.4, 0.2, RED);
  // 2026-11-19: sandbags in one colonnade opening, a shutter off an upper window of the east part.
  sandbags(c, sub(P, 2.6, 0, 0.05), 1.5, 3, new Rng(1746));
  shutter(c, F(c, 12.75 + 4.69, 6.9, FZ + 0.03), 1.4, 3.2, 1);
  rubble(c, -8, FZ + 1.2, 0.8);
  rubble(c, 4.2, FZ + 1.6, 0.5, undefined, false);
}

// ---------------------------------------------------------------- Orangerie ruin (mirror gallery)

/** The burnt-out Große Orangerie: roofless, the tall north wall a gallery of mirrors, falling side walls, a broken front. */
function orangerie(c: Ctx): void {
  const M = c.M, l = c.l, parts = OPEN_PARTS.orangerie ?? [], TALL = 10, LOW = 3, hz = l.hz;
  const north = parts.filter((p) => p.hz < 1 && p.z < 0), south = parts.filter((p) => p.hz < 1 && p.z > 0), sides = parts.filter((p) => p.hz >= 1);
  const burnt = onStucco(0xc2a872);
  // North wall (the garden front): yellow plaster, black above where the roof burnt; mirrors inside.
  for (const p of north) {
    bb(c, M.stucco, F(c, p.x, 0, p.z), 0, 0, 0, p.hx * 2, TALL - 1.6, p.hz * 2, burnt);
    bb(c, M.stucco, F(c, p.x, 0, p.z), 0, TALL - 1.6, 0, p.hx * 2, 1.6 * c.rng.range(0.6, 1), p.hz * 2, SOOT);
    const inner = F(c, p.x, 0, p.z + p.hz), n = Math.round((p.hx * 2) / 2.9);
    band(c, inner, p.hx * 2, 5.6, 0.28, 0.2, TRIM);
    band(c, inner, p.hx * 2, 0, 0.4, 0.12, SAND);
    for (let i = 0; i < n; i++) {
      const x = -p.hx + (i + 0.5) * ((p.hx * 2) / n), r = c.rng.next();
      mirror(c, inner, x, 0.8, 1.7, 3.6, r < 0.5 ? 0 : r < 0.72 ? 1 : r < 0.9 ? 2 : 3);
      const r2 = c.rng.next();
      mirror(c, inner, x, 6.4, 1.1, 1.5, r2 < 0.6 ? 0 : r2 < 0.85 ? 1 : 3);
      // Pilasters between the mirrors.
      if (i > 0) bb(c, M.stucco, inner, x - (p.hx * 2) / n / 2, 0.4, 0.1, 0.36, 5.2, 0.18, TRIM);
    }
    // Garden face: tall arched windows, all burnt out (dark).
    const out = F(c, p.x, 0, p.z - p.hz, Math.PI);
    for (let i = 0; i < n; i++) {
      const x = -p.hx + (i + 0.5) * ((p.hx * 2) / n);
      bb(c, M.dark, out, x, 0.9, 0.02, 1.5, 4.2, 0.04);
      archHead(c.b, M.dark, sub(out, x, 5.1, 0), 1.5, false, 0.03);
    }
  }
  // What is left of the attic urns over the middle (the garden front had a row of them), one fallen inside.
  for (const x of [-6.5, -4.2, 5.2, 7.6]) urn(c, F(c, 0, 0, 0), x, TALL - 0.65, -hz + 0.5, 1.2, SOOT);
  c.b.geo(M.stucco, cached('sc-urnfall', () => new CylinderGeometry(0.4, 0.3, 1.1, 6)), F(c, -5.2, -0.12, -hz + 1.6, 0.6, 0, Math.PI / 2), SOOT);
  // The garden door: lintel and arch over the gap of the north wall.
  const xs = [...north].sort((a, b) => a.x - b.x);
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1]!, q = xs[i]!, x0 = a.x + a.hx, x1 = q.x - q.hx, w = x1 - x0, cx = (x0 + x1) / 2;
    bb(c, M.stucco, F(c, cx, 0, a.z), 0, 5.4, 0, w + 0.1, TALL - 5.4 - 1, a.hz * 2, burnt);
    bb(c, M.stucco, F(c, cx, 0, a.z), 0, TALL - 1, 0, w + 0.1, 0.7, a.hz * 2, SOOT);
    archHead(c.b, M.stucco, sub(F(c, cx, 0, a.z + a.hz), 0, 5.4, 0), w + 0.1, false, -0.02, burnt);
    archHead(c.b, M.stucco, sub(F(c, cx, 0, a.z - a.hz, Math.PI), 0, 5.4, 0), w + 0.1, false, -0.02, burnt);
    band(c, F(c, cx, 0, a.z + a.hz), w + 1.2, 5.3, 0.3, 0.25, TRIM);
  }
  // Side walls: piers and burnt window arches, falling from the north wall toward the camera.
  const hAt = (z: number): number => LOW + (TALL - LOW) * Math.max(0, Math.min(1, (hz - 1 - z) / (2 * hz - 2)));
  for (const p of sides) {
    const n = Math.round((p.hz * 2) / 3);
    for (let i = 0; i < n; i++) {
      const z0 = p.z - p.hz + (i * p.hz * 2) / n, z1 = p.z - p.hz + ((i + 1) * p.hz * 2) / n, zm = (z0 + z1) / 2, st = z1 - z0;
      const h = Math.max(1.2, hAt(zm) * c.rng.range(0.85, 1.05));
      // Pier at the bay's north end, sill under the opening, the lintel only where the wall still stands high.
      bb(c, M.stucco, F(c, p.x, 0, z0 + 0.6), 0, 0, 0, p.hx * 2, h, 1.2, burnt);
      bb(c, M.stucco, F(c, p.x, 0, zm + 0.6), 0, 0, 0, p.hx * 2, Math.min(h, 0.9), st - 1.2, burnt);
      if (h > 6.5) {
        bb(c, M.stucco, F(c, p.x, 0, zm + 0.6), 0, 5.6, 0, p.hx * 2, h - 5.6, st - 1.2, burnt);
        archHead(c.b, M.stucco, sub(F(c, p.x, 0, zm + 0.6, Math.PI / 2), 0, 5.6, 0), st - 1.2, false, -0.5, burnt);
      }
      if (h > 4) bb(c, M.stucco, F(c, p.x, 0, z0 + 0.6), 0, h - 0.9, 0, p.hx * 2 + 0.05, 0.9, 1.22, SOOT);
    }
    // Inner face: a pilaster band at the mirror cornice height where the wall still reaches it.
  }
  // The broken front onto the forecourt: stubs, low and ragged.
  for (const p of south) {
    const n = Math.ceil((p.hx * 2) / 1.5);
    for (let i = 0; i < n; i++) {
      const x0 = p.x - p.hx + (i * p.hx * 2) / n, x1 = p.x - p.hx + ((i + 1) * p.hx * 2) / n;
      bb(c, M.stucco, F(c, (x0 + x1) / 2, 0, p.z), 0, 0, 0, x1 - x0 + 0.02, c.rng.range(0.6, 2.2), p.hz * 2, burnt);
    }
  }
  // Fallen roof: charred beams lying along the walls (walk-over, the hall floor stays free), rubble at the walls.
  for (const [x, z, len, a] of [[-9.5, -9.9, 6.5, 0.12], [7.5, -9.8, 7.2, -0.08], [12.4, 1, 5, 1.45], [-12.2, -3, 4.5, 1.7]] as const) {
    c.b.box(M.darkWood, F(c, x, 0.13, z, a + Math.PI / 2), 0.26, 0.26, len, CHAR);
  }
  for (const [x, z, r] of [[-12, -9, 1.1], [-5, -9.6, 0.8], [9, -9.4, 1.0], [12.2, -2, 0.9], [-12.4, 3, 0.9], [11.5, 7.5, 0.8], [-10, 9.4, 0.8]] as const) rubble(c, x, z, r, burnt);
  // The chandelier, crashed flat in the middle (walk-over), mirror shards scattered over the floor.
  const ch = F(c, 1.5, 0, 0.5);
  c.b.geo(M.railSteel, cached('sc-chand', () => new TorusGeometry(1.4, 0.08, 4, 14)), sub(ch, 0, 0.12, 0, 0, Math.PI / 2), FRAME);
  c.b.geo(M.railSteel, cached('sc-chand2', () => new TorusGeometry(0.7, 0.06, 4, 10)), sub(ch, 0.2, 0.1, -0.1, 0, Math.PI / 2 + 0.1), FRAME);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.b.geo(M.glass, cached('sc-drop', () => new ConeGeometry(0.1, 0.28, 4)), sub(ch, Math.cos(a) * 1.4, 0.1, Math.sin(a) * 1.4, a, Math.PI / 2), [1.4, 1.35, 1.6]);
  }
  for (let i = 0; i < 26; i++) {
    const x = c.rng.range(-l.hx + 2, l.hx - 2), z = c.rng.range(-hz + 1.6, hz - 2);
    c.b.box(M.railSteel, F(c, x, 0.03, z, c.rng.range(0, 3)), c.rng.range(0.15, 0.5), 0.03, c.rng.range(0.1, 0.35), MIRROR);
  }
}

// ---------------------------------------------------------------- Ehrenhof gate

/** Sandstone base, wrought-iron railing with gilded tips, the shut gate, the gladiator piers (collider: the whole line). */
function ehrenhoftor(c: Ctx): void {
  const M = c.M, l = c.l, G = F(c, 0, 0, 0), PH = 5.0, GP = 4.1;
  // Railing between the gate piers and the wings, intermediate piers with urns.
  const posts = [-l.hx + 0.4, -15, -8, 8, 15, l.hx - 0.4];
  for (const x of posts) {
    bb(c, M.stucco, G, x, 0, 0, 0.9, 3.0, 0.9, SAND);
    bb(c, M.stucco, G, x, 3.0, 0, 1.05, 0.22, 1.05, TRIM);
    urn(c, G, x, 3.22, 0, 0.9, SAND);
  }
  const run = (x0: number, x1: number, h: number): void => {
    bb(c, M.stucco, G, (x0 + x1) / 2, 0, 0, x1 - x0, 0.55, 0.7, SAND);
    bb(c, M.stucco, G, (x0 + x1) / 2, 0.55, 0, x1 - x0, 0.1, 0.8, TRIM);
    const n = Math.round((x1 - x0) / 0.2);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      if (c.rng.next() < 0.03) continue;
      quad(c, M.iron, G, x, 0.65 + h / 2, 0.03, 0.04, h, IRON);
      if (i % 3 === 0) c.b.geo(M.enamel, TIP(), sub(G, x, 0.65 + h + 0.1, 0.03), GOLD);
    }
    for (const y of [0.85, 0.65 + h - 0.25]) bb(c, M.iron, G, (x0 + x1) / 2, y, 0, x1 - x0, 0.05, 0.05, IRON);
    // Scroll band with rings under the top rail.
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 1.6) c.b.geo(M.iron, cached('sc-ring', () => new TorusGeometry(0.17, 0.025, 2, 8)), sub(G, x, 0.65 + h - 0.48, 0), IRON);
  };
  const ends = [...posts, -GP, GP].sort((a, b) => a - b);
  for (let i = 1; i < ends.length; i++) {
    const a = ends[i - 1]!, q = ends[i]!;
    if (a === -GP) continue;
    run(a + (a === GP ? 1.1 : 0.45), q - (q === -GP ? 1.1 : 0.45), 2.4);
  }
  // 2026-11-19: rust runs from the railing feet down the sandstone bases (the court side, +z).
  for (let i = 1; i < ends.length; i++) {
    const a = ends[i - 1]!, q = ends[i]!;
    if (a === -GP || q - a < 2) continue;
    wornFace(c, wallFace(c, sub(G, (a + q) / 2, 0, 0.351), q - a - 1, 0.55, SAND), (w) => { for (let x = -(q - a) / 2 + 1; x < (q - a) / 2 - 1; x += 1.7) wornSpot(w, 'rust', x, 0.55, 0.12, 0.42 + 0.1 * Math.sin(x * 3)); }, i);
  }
  // The shut gate: two leaves, taller bars, a gilded crown and scrolls over the middle.
  for (let i = 0; i <= 28; i++) {
    const x = -3.0 + (6.0 * i) / 28;
    quad(c, M.iron, G, x, 1.9, 0.03, 0.05, 3.6, IRON);
    if (i % 2 === 0) c.b.geo(M.enamel, TIP(), sub(G, x, 3.8, 0.03), GOLD);
  }
  for (const y of [0.3, 1.4, 3.4]) bb(c, M.iron, G, 0, y, 0, 6.0, 0.07, 0.07, IRON);
  bb(c, M.iron, G, 0, 0.1, 0, 0.12, 3.6, 0.1, IRON);
  for (const s of [-1, 1]) for (const y of [0.85, 2.4]) c.b.geo(M.iron, cached('sc-ring2', () => new TorusGeometry(0.4, 0.035, 3, 10)), sub(G, s * 1.5, y, 0), IRON);
  for (let i = 0; i < 9; i++) {
    const a0 = Math.PI * (i / 9), a1 = Math.PI * ((i + 1) / 9), r = 3.0;
    const x0 = -Math.cos(a0) * r, y0 = 3.7 + Math.sin(a0) * 0.9, x1 = -Math.cos(a1) * r, y1 = 3.7 + Math.sin(a1) * 0.9;
    c.b.box(M.iron, sub(G, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0)), Math.hypot(x1 - x0, y1 - y0) + 0.04, 0.07, 0.07, IRON);
  }
  c.b.geo(M.enamel, cached('sc-crown', () => new CylinderGeometry(0.42, 0.3, 0.4, 8)), sub(G, 0, 4.85, 0), GOLD);
  ball(c, M.enamel, G, 0, 5.2, 0, 0.18, GOLD);
  ball(c, M.enamel, G, 0, 4.45, 0.04, 0.32, GOLD, 0.4);
  // Mirror shards caught in the gate (sparingly: the Diva's court).
  for (const [x, y] of [[-1.9, 2.0], [0.8, 1.1], [2.3, 2.7]] as const) c.b.box(M.railSteel, sub(G, x, y, 0.04, 0, 0, c.rng.range(0, 3)), 0.35, 0.22, 0.02, MIRROR);
  // The gate piers (photochrom about 1900: broad sandstone piers with a niche and an oval medallion) and the
  // fighting gladiators on them, lunging toward the gate.
  for (const s of [-1, 1]) {
    const x = s * GP, ST = onStucco(0xd2c4a6);
    bb(c, M.stucco, G, x, 0, 0, 2.2, 0.6, 1.2, SAND);
    bb(c, M.stucco, G, x, 0.6, 0, 2.0, PH - 0.6, 1.1, ST);
    for (const z of [-1, 1]) {
      const fm = sub(G, x, 0, z * 0.55, z > 0 ? 0 : Math.PI);
      bb(c, M.dark, fm, 0, 0.9, 0.0, 0.9, 1.9, 0.04);
      archHead(c.b, M.dark, sub(fm, 0, 2.8, -0.02), 0.9, false, 0.04);
      archHead(c.b, M.stucco, sub(fm, 0, 2.85, -0.02), 1.3, false, 0.035, TRIM);
      c.b.geo(M.stucco, cached('sc-medal', () => new TorusGeometry(0.34, 0.08, 4, 12)), sub(fm, 0, 3.85, 0.04).multiply(new Matrix4().makeScale(1, 1.3, 1)), TRIM);
      c.b.geo(M.dark, cached('sc-medal2', () => new CircleGeometry(0.3, 10)), sub(fm, 0, 3.85, 0.03).multiply(new Matrix4().makeScale(1, 1.3, 1)));
      for (const sx of [-0.85, 0.85]) bb(c, M.stucco, fm, sx, 0.6, 0.03, 0.3, PH - 0.6, 0.06, TRIM);
    }
    bb(c, M.stucco, G, x, PH, 0, 2.4, 0.35, 1.2, TRIM);
    bb(c, M.stucco, G, x, PH + 0.35, 0, 1.9, 0.5, 1.0, ST);
    const top = sub(G, x, PH + 0.85, 0, s > 0 ? Math.PI : 0);
    fighter(c, sub(top, -0.1, 0, 0), 1.45, onStucco(0xd8ccb2));
  }
}

// ---------------------------------------------------------------- Stülerbauten

/**
 * Stülerbau (1859; photo 2009 of the western one, Museum Berggruen): cream plaster, rusticated ground floor, two
 * upper storeys between giant pilasters, a three-axis risalit with a low pediment on the street front, the roof
 * balustrade and the round tempietto of columns with its dark dome. Variant 1 is its twin across the street.
 */
function stuelerbau(c: Ctx): void {
  const M = c.M, l = c.l, W = l.hx * 2, D = l.hz * 2, H = 12, FZ = l.hz - 0.5, CR = onStucco(0xe6dfcc), G1 = 3.6;
  const rows: Row[] = [{ y: 1.9, h: 1.5 }, { y: 5.4, h: 2.0, hood: true }, { y: 8.8, h: 1.6 }];
  bb(c, M.stucco, F(c, 0, 0, 0), 0, 0, -0.25, W, H, D - 0.5, CR);
  const fronts: Array<[Matrix4, number]> = [[F(c, 0, 0, FZ), W], [F(c, l.hx, 0, -0.25, Math.PI / 2), D - 0.5], [F(c, -l.hx, 0, -0.25, -Math.PI / 2), D - 0.5]];
  for (const [fm, len] of fronts) {
    // Rusticated ground floor: horizontal joints, a cornice over it.
    for (const y of [0.9, 1.8, 2.7]) quad(c, M.stucco, fm, 0, y, 0.32, len, 0.06, onStucco(0x9c937e));
    band(c, fm, len, G1, 0.3, 0.25);
    face(c, fm, len, len === W ? 5 : 3, rows, 0, undefined, 0.3);
    // Giant pilasters with capitals at the corners and the risalit edges.
    for (const x of len === W ? [-len / 2 + 0.3, -3, 3, len / 2 - 0.3] : [-len / 2 + 0.3, len / 2 - 0.3]) {
      bb(c, M.stucco, fm, x, G1 + 0.3, 0.42, 0.55, H - G1 - 1.5, 0.16, TRIM);
      bb(c, M.stucco, fm, x, H - 1.2, 0.42, 0.75, 0.4, 0.22, TRIM);
    }
    band(c, fm, len, H - 0.8, 0.8, 0.35);
    balustrade(c, sub(fm, 0, 0, -0.2), len - 0.4, H, len / 2, false, TRIM, false);
  }
  // Low pediment over the risalit (it rises in front of the balustrade).
  roof(c, M.stucco, 0, H - 0.05, FZ - 0.2, 1.1, 6.6, 1.3, 1.1, 0, TRIM, Math.PI / 2);
  bb(c, M.slate, F(c, 0, 0, 0), 0, H - 0.1, -0.25, W - 1.4, 0.3, D - 1.8, SLATE);
  // The tempietto: base drum, the ring of columns round the light core, entablature, the dark dome.
  const T = F(c, 0, H + 0.2, -0.25);
  cy(c, M.stucco, T, 0, 0, 0, 2.7, 1.5, CR, 14);
  cy(c, M.stucco, T, 0, 1.5, 0, 1.95, 3.0, CR, 12);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cy(c, M.stucco, T, Math.sin(a) * 2.45, 1.5, Math.cos(a) * 2.45, 0.15, 2.7, TRIM, 6);
    if (i % 3 === 0) pane(c.b, sub(T, Math.sin(a) * 1.97, 2.9, Math.cos(a) * 1.97, a), 0.6, 1.4, c.rng, 0.4);
  }
  cy(c, M.stucco, T, 0, 4.2, 0, 2.75, 0.5, TRIM, 14);
  c.b.geo(M.slate, cached('sc-sdome', () => new SphereGeometry(2.45, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)), sub(T, 0, 4.7, 0).multiply(new Matrix4().makeScale(1, 0.85, 1)), SLATE);
  cy(c, M.slate, T, 0, 6.7, 0, 0.32, 0.4, SLATE, 8, 0.18);
  // 2026-11-19: a shutter hanging off an upper window of the street front.
  shutter(c, F(c, W / 5, 8.8, FZ + 0.03), Math.min(1.5, (W / 5) * 0.46), 1.6, -1);
  rubble(c, l.variant ? 2.6 : -2.6, FZ + 0.5, 0.5, undefined, false);
}

// ---------------------------------------------------------------- garden gate

/** Two piers with urns, an iron arch with a lantern; one leaf fell flat into the passage (walk-over). */
function gartentor(c: Ctx): void {
  const M = c.M, parts = OPEN_PARTS.gartentor ?? [], G = F(c, 0, 0, 0), PH = 3.2;
  for (const p of parts) {
    bb(c, M.stucco, G, p.x, 0, p.z, p.hx * 2, 0.4, p.hz * 2, SAND);
    bb(c, M.stucco, G, p.x, 0.4, p.z, p.hx * 2 - 0.15, PH - 0.4, p.hz * 2 - 0.15, YEL);
    for (const s of [-1, 1]) bb(c, M.stucco, G, p.x, 1.0, p.z + s * (p.hz - 0.07), 0.7, 1.6, 0.04, TRIM);
    bb(c, M.stucco, G, p.x, PH, p.z, p.hx * 2 + 0.15, 0.25, p.hz * 2 + 0.15, TRIM);
    urn(c, G, p.x, PH + 0.25, p.z, 1.1, SAND);
  }
  // 2026-11-19: lichen and rain streaks on the narrow pier faces (too narrow for the surface pass).
  for (const [k, p] of parts.entries()) for (const z of [-1, 1]) {
    const fm = sub(G, p.x, 0.4, p.z + z * (p.hz - 0.075), z > 0 ? 0 : Math.PI);
    wornFace(c, wallFace(c, fm, p.hx * 2 - 0.15, PH - 0.4, YEL), (w) => {
      wornSpot(w, 'stain', 0.15 * z, 0.5, 1.2, 1.0, 0.62, [0.82, 1, 0.7]);
      wornSpot(w, 'streak', -0.3 * z, PH - 0.5, 0.3, 1.8);
    }, k * 2 + z + 5);
  }
  const r = parts[1] ? parts[1].x - parts[1].hx : 2.5;
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI * (i / 8), a1 = Math.PI * ((i + 1) / 8);
    const x0 = -Math.cos(a0) * r, y0 = PH - 0.5 + Math.sin(a0) * 1.1, x1 = -Math.cos(a1) * r, y1 = PH - 0.5 + Math.sin(a1) * 1.1;
    c.b.box(M.iron, sub(G, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, Math.atan2(y1 - y0, x1 - x0)), Math.hypot(x1 - x0, y1 - y0) + 0.03, 0.08, 0.08, IRON);
  }
  bb(c, M.iron, G, 0, PH - 0.5, 0, 2 * r, 0.08, 0.08, IRON);
  for (let i = 1; i < 6; i++) { const x = -r + (2 * r * i) / 6; bb(c, M.iron, G, x, PH - 0.5, 0, 0.04, Math.sin(Math.acos(x / r)) * 1.05, 0.04, IRON); }
  // Lantern hanging in the arch (no light: the gate is lit by the path lanterns).
  bb(c, M.iron, G, 0, PH - 0.05, 0, 0.03, 0.6, 0.03, IRON);
  bb(c, M.lampGlass, G, 0, PH - 0.4, 0, 0.26, 0.38, 0.26);
  bb(c, M.iron, G, 0, PH - 0.05, 0, 0.36, 0.06, 0.36, IRON);
  // The fallen leaf: a bar frame flat on the ground, turned a little.
  const leaf = F(c, -0.6, 0.03, 0.9, 0.35);
  for (const z of [-1.1, 1.1]) bb(c, M.iron, leaf, 0, 0, z, 2.1, 0.06, 0.06, IRON);
  for (let i = 0; i <= 8; i++) bb(c, M.iron, leaf, -1.05 + i * 0.26, 0, 0, 0.04, 0.05, 2.2, IRON);
}

// ---------------------------------------------------------------- Belvedere

/**
 * Langhans' Belvedere (1788; photo 2005, restored): oval core with four short three-storey risalits, white
 * ground floor, pale pearl-blue upper storeys with white pilasters, columns and balconies on the risalits,
 * iron railings on their flat roofs, the green copper dome with the gilded putti carrying the flower basket.
 */
function belvedere(c: Ctx): void {
  const M = c.M, l = c.l, B = F(c, 0, 0, 0), RX = l.hx - 1.4, RZ = l.hz - 1.0, H = 11.4, G1 = 3.8;
  const oval = (y: number, h: number, sx: number, sz: number, mat: Material, t: RGB, top = 1, seg = 20): void => {
    c.b.geo(mat, cached(`sc-ov${top}-${seg}`, () => new CylinderGeometry(top, 1, 1, seg)), sub(B, 0, y + h / 2, 0).multiply(new Matrix4().makeScale(sx, h, sz)), t);
  };
  oval(0, G1, RX, RZ, M.stucco, WHITE);
  oval(G1, H - G1 + 1.2, RX, RZ, M.stucco, PEARL);
  const rows: Row[] = [{ y: 1.9, h: 1.8 }, { y: 5.6, h: 2.2, hood: true }, { y: 9.1, h: 1.7 }];
  for (const [ax, az, w] of [[1, 0, 3.6], [-1, 0, 3.6], [0, 1, 4.0], [0, -1, 4.0]] as const) {
    const out = ax ? l.hx : l.hz, inn = (ax ? RX : RZ) - 1.2, len = out - inn, ry = Math.atan2(ax, az);
    const wm = F(c, ax * (inn + len / 2), 0, az * (inn + len / 2), ry);
    bb(c, M.stucco, wm, 0, 0, 0, w, G1, len, WHITE);
    bb(c, M.stucco, wm, 0, G1, 0, w, H - G1, len, PEARL);
    const fm = sub(wm, 0, 0, len / 2);
    face(c, fm, w, 1, rows, 0, undefined, 0.3, WHITE);
    for (const s of [-1, 1]) {
      bb(c, M.stucco, fm, s * (w / 2 - 0.25), G1, 0.05, 0.4, H - G1 - 0.5, 0.12, WHITE);
      cy(c, M.stucco, fm, s * 0.95, G1 + 0.35, 0.3, 0.17, 3.0, WHITE, 8);
    }
    band(c, fm, w, G1, 0.35, 0.3, WHITE);
    band(c, fm, w, H - 0.5, 0.5, 0.35, WHITE);
    // Balcony rail on the first floor, iron railing on the flat risalit roof.
    bb(c, M.stucco, fm, 0, G1 + 0.35, 0.35, 2.0, 0.08, 0.3, WHITE);
    for (let k = 0; k < 7; k++) quad(c, M.stucco, fm, -0.9 + k * 0.3, G1 + 0.7, 0.48, 0.09, 0.6, WHITE);
    bb(c, M.stucco, fm, 0, G1 + 1.0, 0.35, 2.0, 0.08, 0.3, WHITE);
    bb(c, M.stucco, wm, 0, H, 0, w + 0.2, 0.25, len + 0.1, WHITE);
    for (let k = 0; k <= Math.round(w / 0.25); k++) quad(c, M.iron, fm, -w / 2 + k * 0.25, H + 0.65, 0.0, 0.03, 0.8, IRON);
    bb(c, M.iron, fm, 0, H + 1.0, -0.02, w, 0.05, 0.05, IRON);
  }
  // Windows round the oval between the risalits.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.sin(a) * RX, z = Math.cos(a) * RZ, ry = Math.atan2(x / (RX * RX), z / (RZ * RZ));
    const m = F(c, x * 1.005, 0, z * 1.005, ry);
    for (const r of rows) { quad(c, M.stucco, m, 0, r.y, 0.01, 1.3, r.h + 0.3, WHITE); pane(c.b, sub(m, 0, r.y, 0.02), 0.95, r.h, c.rng, 0.3); }
  }
  oval(G1 - 0.1, 0.35, RX + 0.12, RZ + 0.12, M.stucco, WHITE);
  oval(H - 0.3, 0.5, RX + 0.25, RZ + 0.25, M.stucco, WHITE);
  // The dome: a low skirt, then the green copper cupola, the lantern platform with the gilded group.
  const bell = cached('sc-bell', () => new LatheGeometry([[1.04, 0], [0.92, 0.3], [0.86, 0.42], [0.8, 0.62], [0.62, 0.85], [0.38, 0.97], [0.0, 1.0]].map(([a, b]) => new Vector2(a, b)), 20));
  c.b.geo(M.stucco, bell, sub(B, 0, H + 0.2, 0).multiply(new Matrix4().makeScale(RX + 0.3, 3.4, RZ + 0.3)), COPPER);
  cy(c, M.stucco, B, 0, H + 3.5, 0, 0.75, 0.35, WHITE, 10);
  cy(c, M.enamel, B, 0, H + 3.85, 0, 0.35, 0.5, GOLD, 8, 0.25);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, pm = sub(B, Math.sin(a) * 0.38, H + 4.3, Math.cos(a) * 0.38, a);
    cy(c, M.enamel, pm, 0, 0, 0, 0.17, 0.55, GOLD, 6, 0.14);
    ball(c, M.enamel, pm, 0, 0.72, 0, 0.16, GOLD);
    limb(c, M.enamel, pm, [0, 0.5, 0.1], [0, 1.0, -0.3], 0.08, GOLD);
  }
  c.b.geo(M.enamel, cached('sc-basket', () => new CylinderGeometry(0.5, 0.28, 0.42, 8)), sub(B, 0, H + 5.5, 0), GOLD);
  ball(c, M.enamel, B, 0, H + 5.85, 0, 0.36, GOLD, 0.6);
  ball(c, M.enamel, B, 0, H + 6.25, 0, 0.12, GOLD);
  rubble(c, 2.6, l.hz - 0.4, 0.5, undefined, false);
  rubble(c, -l.hx + 0.6, 2.0, 0.5, undefined, false);
}

// ---------------------------------------------------------------- Mausoleum

/**
 * Mausoleum of Queen Luise (photo 2019; the 1920 building with its extensions): a Doric portico of four fluted
 * columns in polished red granite, the granite front wall with the bronze door, the pediment with A ☧ Ω, the
 * higher light sandstone gable of the extended cella behind, the steps with two vases, two firs.
 */
function mausoleum(c: Ctx): void {
  const M = c.M, l = c.l, G = onStucco(0x8c5a48), GL = onStucco(0x9e6c58), CELLA = onStucco(0xd9cfba);
  const m = F(c, 0, 0, 0), CH = 5.0, PZ = l.hz - 2.3, FW = PZ - 1.7, Y0 = 0.75;
  // Steps up to the portico.
  for (let i = 0; i < 5; i++) bb(c, M.stucco, m, 0, 0, PZ + 1.6 - i * 0.35, 5.2, 0.15 * (i + 1), 0.4, CELLA);
  bb(c, M.stucco, m, 0, 0, -0.9, 8.4, Y0, PZ - 0.2 + 0.9 + 3.2, GL);
  // Cella (extended, light sandstone): higher than the portico, its own gable behind the pediment.
  bb(c, M.stucco, m, 0, Y0, -2.6, 8.0, CH + 2.6, 4.6, CELLA);
  roof(c, M.stucco, 0, Y0 + CH + 2.6, -2.6, 4.8, 8.4, 1.8, 4.8, 0, CELLA, Math.PI / 2);
  roof(c, M.slate, 0, Y0 + CH + 2.65, -2.6, 4.4, 8.6, 1.8, 4.4, 0, SLATE, Math.PI / 2);
  // Granite front wall of the old cella with the bronze door.
  bb(c, M.stucco, m, 0, Y0, (FW - 0.3) / 2 - 0.4, 6.6, CH + 1.1, FW + 0.5, G);
  for (const y of [1.6, 2.6, 3.6, 4.6]) bb(c, M.dark, m, 0, Y0 + y, FW + 0.06, 6.6, 0.03, 0.03);
  bb(c, M.dark, m, 0, Y0, FW + 0.06, 1.5, 3.0, 0.04);
  bb(c, M.iron, m, 0, Y0, FW + 0.1, 1.4, 2.9, 0.04, [0.45, 0.6, 0.5]);
  bb(c, M.stucco, m, 0, Y0 + 3.0, FW + 0.08, 1.9, 0.3, 0.12, GL);
  // Portico: four fluted Doric columns, architrave, triglyph frieze, the pediment.
  for (const x of [-2.55, -0.85, 0.85, 2.55]) {
    c.b.geo(M.stucco, cached('sc-flute', () => {
      const g = new CylinderGeometry(0.3, 0.36, 1, 16, 1, true), p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) if ((i % 17) % 2) p.setXYZ(i, p.getX(i) * 0.88, p.getY(i), p.getZ(i) * 0.88);
      g.computeVertexNormals();
      return g;
    }), sub(m, x, Y0 + (CH - 0.4) / 2, PZ).multiply(new Matrix4().makeScale(1, CH - 0.4, 1)), G);
    bb(c, M.stucco, m, x, Y0 + CH - 0.4, PZ, 0.8, 0.4, 0.8, GL);
  }
  bb(c, M.stucco, m, 0, Y0 + CH, PZ - 0.85, 6.4, 0.5, 2.3, G);
  bb(c, M.stucco, m, 0, Y0 + CH + 0.5, PZ - 0.85, 6.4, 0.5, 2.3, GL);
  for (let i = 0; i < 8; i++) quad(c, M.stucco, m, -2.8 + i * 0.8, Y0 + CH + 0.75, PZ + 0.31, 0.2, 0.4, onStucco(0x5e3c30));
  bb(c, M.stucco, m, 0, Y0 + CH + 1.0, PZ - 0.85, 6.7, 0.18, 2.5, G);
  roof(c, M.stucco, 0, Y0 + CH + 1.18, PZ - 0.85, 2.5, 6.8, 1.3, 2.5, 0, G, Math.PI / 2);
  roof(c, M.slate, 0, Y0 + CH + 1.22, PZ - 0.85, 2.3, 7.0, 1.3, 2.3, 0, SLATE, Math.PI / 2);
  // A ☧ Ω in the tympanum.
  for (const [x, w] of [[-1.0, 0.28], [0, 0.34], [1.0, 0.28]] as const) quad(c, M.enamel, m, x, Y0 + CH + 1.6, PZ + 0.42, w, 0.3, GOLD);
  // Urns on pedestals beside the steps (LA2: the local AI model, `glb-props.ts`), two firs.
  for (const s of [-1, 1]) {
    M.glbProps.push({ kind: 'urn', m: sub(m, s * 3.4, 0, PZ + 1.2) });
    const x = s * (l.hx - 0.8), z = l.hz - 1.6;
    cy(c, M.darkWood, m, x, 0, z, 0.14, 1.2, [0.4, 0.32, 0.26], 5);
    for (let k = 0; k < 4; k++) c.b.geo(M.mossy, cached(`sc-fir${k}`, () => new ConeGeometry(0.8 - k * 0.15, 1.6, 7)), sub(m, x, 1.4 + k * 1.05, z, k), [0.16, 0.26, 0.17]);
  }
  rubble(c, 2.2, l.hz - 0.5, 0.35, CELLA, false);
}

/** Draws `c.l` if it is one of this file's kinds; false otherwise. */
export function buildSchloss(c: Ctx): boolean {
  switch (c.l.kind) {
    case 'schlossmitte': schlossmitte(c); return true;
    case 'schlossfluegel': schlossfluegel(c); return true;
    case 'neuerfluegel': neuerfluegel(c); return true;
    case 'orangerie': orangerie(c); return true;
    case 'ehrenhoftor': ehrenhoftor(c); return true;
    case 'stuelerbau': stuelerbau(c); return true;
    case 'gartentor': gartentor(c); return true;
    case 'belvedere': belvedere(c); return true;
    case 'mausoleum': mausoleum(c); return true;
    default: return false;
  }
}

